import type { CounterKey } from '../limits';

export type DayUsage = Record<CounterKey, { run: number; follow: number; hits: number }>;

export type CallLog = {
  uid: string;
  feature: string;
  model: string;
  status: 'ok' | 'meta' | 'refused' | 'error' | 'cancelled';
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costKrw: number;
};

/** 사용 횟수·비용 기록을 다루는 곳. 개발용 메모리 구현과 Supabase 구현이 있다 */
export interface DataStore {
  /** 횟수 1번 예약. 남은 횟수가 없으면 false (이때 '한도에 걸림'도 1 올림) */
  reserve(uid: string, day: string, key: CounterKey, kind: 'run' | 'follow', limit: number): Promise<boolean>;
  /** 예약 취소 (오류, [확인]·[모름] 답, 중단) */
  refund(uid: string, day: string, key: CounterKey, kind: 'run' | 'follow'): Promise<void>;
  /** 브라우저에서 미리 막혔을 때 '한도에 걸림'만 기록 */
  hit(uid: string, day: string, key: CounterKey): Promise<void>;
  usage(uid: string, day: string): Promise<DayUsage>;
  /** sinceIso 이후 AI 비용 합계(원) */
  costSince(sinceIso: string): Promise<number>;
  logCall(row: CallLog): Promise<void>;
}

export const emptyUsage = (): DayUsage => ({
  exam: { run: 0, follow: 0, hits: 0 },
  pro: { run: 0, follow: 0, hits: 0 },
  mono: { run: 0, follow: 0, hits: 0 },
});
