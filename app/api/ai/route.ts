// AI 호출 하나. 순서: 사용자 확인 → 입력 검사·프롬프트 조립 → 월 예산 확인 → 하루 횟수 예약 → 스트리밍 → 비용 기록
// 응답은 한 줄에 JSON 하나씩(NDJSON): {"t":"글자"} … 마지막에 {"done":true,…} 또는 {"error":"코드"}
import Anthropic from '@anthropic-ai/sdk';
import { runAi } from '@/lib/ai';
import { costOf } from '@/lib/budget';
import { aiNotReady, config } from '@/lib/config';
import { kstDay, kstMonthStartIso, LIMITS, type CounterKey } from '@/lib/limits';
import { BadInput, buildJob, isMetaReply, type Job } from '@/lib/prompts/build';
import { getStore, json, userIdOf } from '@/lib/server';
import type { CallLog } from '@/lib/data/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_BODY = 400_000; // 글자 수. 본문 8만 자 + 대화 기록을 넉넉히

function errorCode(e: unknown): string {
  if (e instanceof Anthropic.APIUserAbortError) return 'cancelled';
  if (e instanceof Anthropic.RateLimitError) return 'busy';
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return 'not_configured';
  if (e instanceof Anthropic.BadRequestError) return 'bad_request';
  if (e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) return 'busy';
  return 'error';
}

export async function POST(req: Request) {
  const notReady = aiNotReady();
  const store = getStore();
  if (notReady || !store) {
    console.error('[sokmal] AI 설정이 안 됨:', notReady ?? '저장소 없음');
    return json({ error: 'not_configured' }, 503);
  }
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
  const usage = await store.usage(uid, day);
  const left = (k: CounterKey) => Math.max(0, LIMITS.daily[k] - (usage[k].run + usage[k].follow));

  let job: Job;
  try {
    job = buildJob(body, left);
  } catch (e) {
    if (e instanceof BadInput) return json({ error: e.code }, e.code === 'prompt_too_large' ? 413 : 400);
    throw e;
  }

  // 월 예산 상한: 닿으면 새 호출을 막는다 (가짜 답일 때는 비용이 없으니 건너뜀)
  if (!config.mockAi) {
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
  const model = job.tier === 'light' ? config.modelLight : config.modelMain;

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
      const log = (status: CallLog['status'], u: Parameters<typeof costOf>[0], usedModel: string) => {
        const { tokens, krw } = costOf(u, usedModel, config.usdKrw);
        return store
          .logCall({
            uid,
            feature: job.feature,
            model: usedModel,
            status,
            inputTokens: tokens.input,
            outputTokens: tokens.output,
            cacheWriteTokens: tokens.cacheWrite,
            cacheReadTokens: tokens.cacheRead,
            costKrw: krw,
          })
          .catch((e) => console.error('[sokmal] 비용 기록 실패', e));
      };
      try {
        const r = await runAi(job, ctl.signal, (d) => {
          text += d;
          send({ t: d });
        });
        if (r.stopReason === 'refusal') {
          await refund();
          await log('refused', r.usage, r.model);
          // 중간에 거절되면 그때까지 나온 글은 버린다
          send({ error: 'refused' });
        } else {
          const meta = isMetaReply(r.text);
          if (meta && job.refundMeta) await refund();
          await log(meta ? 'meta' : 'ok', r.usage, r.model);
          send({ done: true, text: r.text, truncated: r.stopReason === 'max_tokens', base: job.base, usage: await store.usage(uid, day) });
        }
      } catch (e) {
        const code = ctl.signal.aborted ? 'cancelled' : errorCode(e);
        if (code !== 'cancelled') console.error('[sokmal] AI 호출 실패', e);
        await refund();
        // 중단·오류 때는 사용량을 알 수 없어 토큰 0으로 기록된다 (비용이 조금 덜 잡힐 수 있음)
        await log(code === 'cancelled' ? 'cancelled' : 'error', null, model);
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
