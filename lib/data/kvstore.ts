// 키-값 저장소 하나로 운영(Upstash Redis)·개발(메모리·파일)을 모두 처리한다.
// 키 모양:
//   u:<uid>:<day>     해시  exam:run / exam:follow / exam:hits / exam:total …  (하루 횟수)
//   user:<uid>        해시  first, last, code, exam_run … (합계), calls, krw
//   days:<uid>        집합  쓴 날들
//   users             집합  모든 테스터
//   calls             목록  최근 AI 호출(JSON, 최신이 앞) 5,000건
//   cost:<YYYY-MM>    값    그 달(한국 시간) AI 비용 합계(원)
//   fb:<uid>          값    의견·후기 문서(JSON)
//   admin:names       해시  uid → 이름 메모
//   admin:approved    해시  uid → '1' (랜딩에 쓸 후기)
//   admin:switches    값    관리자 스위치 JSON (독백 지침·예시 켜기/끄기)
import { cleanSwitches, type PromptSwitches } from '../prompts/switches';
import type { CounterKey } from '../limits';
import type { Kv } from './kv';
import { emptyUsage, type AdminSnapshot, type CallLog, type DataStore, type FeedbackDoc, type TesterRow } from './types';

const KEYS: CounterKey[] = ['exam', 'pro', 'mono'];
const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (v == null ? '' : String(v));
/** 시각(ISO) → 한국 시간 기준 'YYYY-MM' */
export const kstMonthOf = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 7);
const parse = <T>(v: unknown): T | null => {
  if (v == null) return null;
  if (typeof v === 'object') return v as T; // 자동으로 풀어 주는 클라이언트 대비
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return null;
  }
};

export class KvStore implements DataStore {
  constructor(protected kv: Kv) {}

  async reserve(uid: string, day: string, key: CounterKey, kind: 'run' | 'follow', limit: number) {
    const k = `u:${uid}:${day}`;
    // 합계를 먼저 올리고 넘으면 되돌림 → 동시에 눌러도 한도를 넘지 않음
    const total = await this.kv.hincrby(k, `${key}:total`, 1);
    if (total > limit) {
      await this.kv.hincrby(k, `${key}:total`, -1);
      await this.kv.hincrby(k, `${key}:hits`, 1);
      await this.kv.hincrby(`user:${uid}`, `${key}_hits`, 1);
      return false;
    }
    await this.kv.hincrby(k, `${key}:${kind}`, 1);
    await this.kv.hincrby(`user:${uid}`, `${key}_${kind}`, 1);
    return true;
  }

  async refund(uid: string, day: string, key: CounterKey, kind: 'run' | 'follow') {
    const k = `u:${uid}:${day}`;
    const v = await this.kv.hincrby(k, `${key}:${kind}`, -1);
    if (v < 0) {
      await this.kv.hincrby(k, `${key}:${kind}`, 1); // 0 아래로 내려가지 않게
      return;
    }
    await this.kv.hincrby(k, `${key}:total`, -1);
    await this.kv.hincrby(`user:${uid}`, `${key}_${kind}`, -1);
  }

  async hit(uid: string, day: string, key: CounterKey) {
    await this.kv.hincrby(`u:${uid}:${day}`, `${key}:hits`, 1);
    await this.kv.hincrby(`user:${uid}`, `${key}_hits`, 1);
  }

  async usage(uid: string, day: string) {
    const h = (await this.kv.hgetall(`u:${uid}:${day}`)) ?? {};
    const u = emptyUsage();
    for (const key of KEYS) u[key] = { run: num(h[`${key}:run`]), follow: num(h[`${key}:follow`]), hits: num(h[`${key}:hits`]) };
    return u;
  }

  async costSince(sinceIso: string) {
    return num(await this.kv.get(`cost:${kstMonthOf(sinceIso)}`));
  }

  async logCall(row: CallLog) {
    const at = new Date().toISOString();
    await this.kv.lpush('calls', JSON.stringify({ ...row, at }));
    await this.kv.ltrim('calls', 0, 4999);
    if (row.costKrw) await this.kv.incrbyfloat(`cost:${kstMonthOf(at)}`, row.costKrw);
    await this.kv.hincrby(`user:${row.uid}`, 'calls', 1);
    if (row.costKrw) await this.kv.hincrbyfloat(`user:${row.uid}`, 'krw', row.costKrw);
  }

  async touch(uid: string, day: string, code?: string | null) {
    await this.kv.sadd('users', uid);
    await this.kv.sadd(`days:${uid}`, day);
    await this.kv.hsetnx(`user:${uid}`, 'first', day);
    await this.kv.hset(`user:${uid}`, code ? { last: day, code } : { last: day });
  }

  async getFeedback(uid: string) {
    return parse<FeedbackDoc>(await this.kv.get(`fb:${uid}`));
  }
  async putFeedback(uid: string, doc: FeedbackDoc) {
    await this.kv.sadd('users', uid);
    await this.kv.set(`fb:${uid}`, JSON.stringify(doc));
  }

  async setName(uid: string, name: string) {
    if (name) await this.kv.hset('admin:names', { [uid]: name });
    else await this.kv.hdel('admin:names', uid);
  }
  async setApproved(uid: string, approved: boolean) {
    if (approved) await this.kv.hset('admin:approved', { [uid]: '1' });
    else await this.kv.hdel('admin:approved', uid);
  }

  async getSwitches(): Promise<PromptSwitches> {
    return cleanSwitches(parse<unknown>(await this.kv.get('admin:switches')));
  }
  async setSwitches(s: PromptSwitches) {
    await this.kv.set('admin:switches', JSON.stringify(cleanSwitches(s)));
  }

  async adminSnapshot(callLimit = 1000): Promise<AdminSnapshot> {
    const [uids, names, approved, rawCalls, month] = await Promise.all([
      this.kv.smembers('users'),
      this.kv.hgetall('admin:names'),
      this.kv.hgetall('admin:approved'),
      this.kv.lrange('calls', 0, Math.max(0, callLimit - 1)),
      this.kv.get(`cost:${kstMonthOf(new Date().toISOString())}`),
    ]);
    const testers: TesterRow[] = await Promise.all(
      uids.map(async (uid) => {
        const [u, days, fb] = await Promise.all([this.kv.hgetall(`user:${uid}`), this.kv.smembers(`days:${uid}`), this.getFeedback(uid)]);
        const h = u ?? {};
        const totals = emptyUsage();
        for (const key of KEYS) totals[key] = { run: num(h[`${key}_run`]), follow: num(h[`${key}_follow`]), hits: num(h[`${key}_hits`]) };
        return {
          uid,
          code: str(h.code) || null,
          name: str((names ?? {})[uid]),
          first: str(h.first),
          last: str(h.last),
          days: days.length,
          totals,
          calls: num(h.calls),
          costKrw: num(h.krw),
          feedback: fb,
        };
      }),
    );
    const calls = rawCalls.map((c) => parse<CallLog & { at: string }>(c)).filter((c): c is CallLog & { at: string } => !!c);
    const ap: Record<string, boolean> = {};
    for (const k of Object.keys(approved ?? {})) ap[k] = true;
    return { testers, calls, monthCostKrw: num(month), approved: ap };
  }
}
