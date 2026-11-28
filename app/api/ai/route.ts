// AI 호출 하나. 순서: 사용자 확인 → 입력 검사·프롬프트 조립 → 월 예산 확인 → 하루 횟수 예약 → 스트리밍 → 비용 기록
// 응답은 한 줄에 JSON 하나씩(NDJSON): {"t":"글자"} … 마지막에 {"done":true,…} 또는 {"error":"코드"}
import { aiErrorCode, aiErrorDetail, pricesKnown, runAi, type AiResult } from '@/lib/ai';
import { toKrw } from '@/lib/budget';
import { aiNotReady, appBudgetActive, config, modelFor } from '@/lib/config';
import { kstDay, kstMonthStartIso, LIMITS, type CounterKey } from '@/lib/limits';
import { BadInput, buildJob, isMetaReply, type Job } from '@/lib/prompts/build';
import { DEFAULT_SWITCHES } from '@/lib/prompts/switches';
import { EMPTY_GUIDE, parseReview, reviewWrap } from '@/lib/guide';
import { inviteOk } from '@/lib/invite';
import { getStore, inviteCodeOf, json, userIdOf } from '@/lib/server';
import type { CallLog } from '@/lib/data/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_BODY = 400_000; // 글자 수. 본문 8만 자 + 대화 기록을 넉넉히

export async function POST(req: Request) {
  const notReady = aiNotReady();
  const store = getStore();
  if (notReady || !store) {
    console.error('[sokmal] AI 설정이 안 됨:', notReady ?? '저장소 없음');
    return json({ error: 'not_configured' }, 503);
  }
  if (!inviteOk(req)) return json({ error: 'invite_required' }, 403);
  const uid = await userIdOf(req);
  if (!uid) return json({ error: 'session_expired' }, 401);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: 'prompt_too_large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const day = kstDay();
  await store.touch(uid, day, inviteCodeOf(req)).catch((e) => console.error('[sokmal] 방문 기록 실패', e));
  const usage = await store.usage(uid, day);
  const left = (k: CounterKey) => Math.max(0, LIMITS.daily[k] - (usage[k].run + usage[k].follow));

  let job: Job;
  try {
    const [sw, guide, notes] = await Promise.all([
      store.getSwitches().catch(() => DEFAULT_SWITCHES),
      store.getGuide().catch(() => EMPTY_GUIDE),
      store.notes().catch(() => []),
    ]);
    job = buildJob(body, left, sw, guide, notes);
  } catch (e) {
    if (e instanceof BadInput) return json({ error: e.code }, e.code === 'prompt_too_large' ? 413 : 400);
    throw e;
  }

  // 월 예산 상한: 닿으면 새 호출을 막는다. 금액·환율·가격을 알 때만 셈(OpenAI는 대시보드 한도가 진짜 천장)
  if (appBudgetActive(pricesKnown())) {
    const spent = await store.costSince(kstMonthStartIso());
    if (spent >= config.monthlyBudgetKrw) {
      console.error('[sokmal] 월 예산 상한 도달', spent, config.monthlyBudgetKrw);
      return json({ error: 'budget' }, 503);
    }
  }

  // 하루 횟수 예약 (먼저 올리고, 실패하면 돌려줌)
  const c = job.counter;
  if (c && !(await store.reserve(uid, day, c.key, c.kind, c.limit))) {
    return json({ error: 'daily_limit', key: c.key, usage: await store.usage(uid, day) }, 429);
  }
  const refund = async () => {
    if (c) await store.refund(uid, day, c.key, c.kind).catch((e) => console.error('[sokmal] 횟수 돌려주기 실패', e));
  };

  const ctl = new AbortController();
  req.signal.addEventListener('abort', () => ctl.abort());
  const enc = new TextEncoder();
  const model = modelFor(job.tier);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (o: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(JSON.stringify(o) + '\n'));
        } catch {
          closed = true;
        }
      };
      let text = '';
      const log = (status: CallLog['status'], r: Pick<AiResult, 'tokens' | 'usd'> | null, usedModel: string, detail?: string, feature = job.feature) => {
        const tokens = r?.tokens ?? { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
        const krw = r?.usd != null && config.usdKrw > 0 ? toKrw(r.usd, config.usdKrw) : 0;
        return store
          .logCall({
            uid,
            feature,
            model: usedModel,
            status,
            inputTokens: tokens.input,
            outputTokens: tokens.output,
            cacheWriteTokens: tokens.cacheWrite,
            cacheReadTokens: tokens.cacheRead,
            costKrw: krw,
            ...(detail ? { detail } : {}),
          })
          .catch((e) => console.error('[sokmal] 비용 기록 실패', e));
      };
      try {
        if (job.review) {
          // 검수 켜짐 (11-27): 1차로 쓰고(배우에게 흘려보내지 않음) → 검수 기준으로 평가·수정 → 최종본만 보냄
          send({ p: 'write' });
          const first = await runAi(job, ctl.signal, () => {});
          if (first.stop === 'refusal') {
            await refund();
            await log('refused', first, first.model);
            send({ error: 'refused' });
            return;
          }
          const meta = isMetaReply(first.text);
          await log(meta ? 'meta' : 'ok', first, first.model);
          let finalText = first.text;
          let truncated = first.stop === 'length';
          if (meta) {
            if (job.refundMeta) await refund();
          } else {
            send({ p: 'review' });
            const reviewFeature = job.feature + '·검수';
            try {
              const r2 = await runAi(
                { ...job, feature: reviewFeature, counter: null, messages: [...job.messages, { role: 'assistant', content: first.text }, { role: 'user', content: reviewWrap(job.review) }] },
                ctl.signal,
                () => {},
              );
              await log(r2.stop === 'refusal' ? 'refused' : 'ok', r2, r2.model, undefined, reviewFeature);
              const pr = parseReview(r2.text);
              if (pr.final) {
                finalText = pr.final;
                truncated = false;
              }
              await store
                .logReview({ uid, feature: job.feature, before: pr.before, after: pr.after, used: !!pr.final, review: pr.review, draft: first.text, final: finalText })
                .catch((e) => console.error('[sokmal] 검수 기록 실패', e));
            } catch (e2) {
              if (ctl.signal.aborted) throw e2;
              // 검수가 실패해도 1차 독백은 보낸다
              console.error('[sokmal] 검수 실패', e2);
              await log('error', null, model, aiErrorDetail(e2), reviewFeature);
            }
          }
          send({ t: finalText });
          send({ done: true, text: finalText, truncated, base: job.base, usage: await store.usage(uid, day) });
          return;
        }
        const r = await runAi(job, ctl.signal, (d) => {
          text += d;
          send({ t: d });
        });
        if (r.stop === 'refusal') {
          await refund();
          await log('refused', r, r.model);
          // 중간에 거절되면 그때까지 나온 글은 버린다
          send({ error: 'refused' });
        } else {
          const meta = isMetaReply(r.text);
          if (meta && job.refundMeta) await refund();
          await log(meta ? 'meta' : 'ok', r, r.model);
          send({ done: true, text: r.text, truncated: r.stop === 'length', base: job.base, ...(job.note ? { note: job.note } : {}), usage: await store.usage(uid, day) });
        }
      } catch (e) {
        const code = ctl.signal.aborted ? 'cancelled' : aiErrorCode(e);
        if (code !== 'cancelled') console.error('[sokmal] AI 호출 실패', e);
        await refund();
        // 중단·오류 때는 사용량을 알 수 없어 토큰 0으로 기록된다 (비용이 조금 덜 잡힐 수 있음)
        await log(code === 'cancelled' ? 'cancelled' : 'error', null, model, code === 'cancelled' ? undefined : aiErrorDetail(e));
        send({ error: code, text });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      ctl.abort();
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  });
}
