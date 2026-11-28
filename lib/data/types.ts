import type { MonoGuide } from '../guide';
import type { WaitEntry } from '../waitlist';
import type { PromptSwitches } from '../prompts/switches';
import type { CounterKey } from '../limits';

export type DayUsage = Record<CounterKey, { run: number; follow: number; hits: number }>;

export type ReviewLog = {
  uid: string;
  feature: string;
  before: number | null;
  after: number | null;
  /** 최종본을 썼는지 (형식이 깨져 1차 독백을 그대로 보냈으면 false) */
  used: boolean;
  review: string;
  draft: string;
  final: string;
};

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
  /** 오류일 때 원인 (예: "401 invalid_api_key …"). 키 같은 비밀은 가려서 남김 */
  detail?: string;
};

/** 테스터 한 명의 의견·후기 문서 (시제품 feedback/<사용자> 와 같은 모양) */
export type FeedbackDoc = {
  entries?: Record<string, unknown>[];
  review?: Record<string, unknown> | null;
  reviewSkip?: number | null;
  updatedAt?: number;
};

/** 관리자 화면에 보이는 테스터 한 명 */
export type TesterRow = {
  uid: string;
  /** 초대 코드 (초대 코드로 들어온 사람만) */
  code: string | null;
  /** 송무가 붙인 이름 메모 */
  name: string;
  first: string;
  last: string;
  days: number;
  /** 모드별 합계 */
  totals: Record<CounterKey, { run: number; follow: number; hits: number }>;
  calls: number;
  costKrw: number;
  feedback: FeedbackDoc | null;
};

export type AdminSnapshot = {
  testers: TesterRow[];
  /** 최근 AI 호출 (최신이 먼저) */
  calls: (CallLog & { at: string })[];
  monthCostKrw: number;
  approved: Record<string, boolean>;
};

/** 사용 횟수·비용·의견을 다루는 곳 */
export interface DataStore {
  /** 횟수 1번 예약. 남은 횟수가 없으면 false (이때 '한도에 걸림'도 1 올림) */
  reserve(uid: string, day: string, key: CounterKey, kind: 'run' | 'follow', limit: number): Promise<boolean>;
  /** 예약 취소 (오류, [확인]·[모름] 답, 중단) */
  refund(uid: string, day: string, key: CounterKey, kind: 'run' | 'follow'): Promise<void>;
  /** 브라우저에서 미리 막혔을 때 '한도에 걸림'만 기록 */
  hit(uid: string, day: string, key: CounterKey): Promise<void>;
  usage(uid: string, day: string): Promise<DayUsage>;
  /** sinceIso 가 속한 달(한국 시간)의 AI 비용 합계(원) */
  costSince(sinceIso: string): Promise<number>;
  logCall(row: CallLog): Promise<void>;
  /** 이 사람이 오늘 들어왔음 (관리자 테스터 목록용) */
  touch(uid: string, day: string, code?: string | null): Promise<void>;
  getFeedback(uid: string): Promise<FeedbackDoc | null>;
  putFeedback(uid: string, doc: FeedbackDoc): Promise<void>;
  /** 관리자 화면 데이터. 지원하지 않는 저장소는 null */
  adminSnapshot(callLimit?: number): Promise<AdminSnapshot | null>;
  setName(uid: string, name: string): Promise<void>;
  setApproved(uid: string, approved: boolean): Promise<void>;
  /** 관리자 스위치 (독백 지침 켜기·끄기) */
  getSwitches(): Promise<PromptSwitches>;
  setSwitches(s: PromptSwitches): Promise<void>;
  /** 대기 명단: 새 사람이면 'new', 같은 연락처면 'updated', 가득 차면 'full' */
  addWaitlist(e: WaitEntry): Promise<'new' | 'updated' | 'full'>;
  waitlist(): Promise<WaitEntry[]>;
  removeWaitlist(e: Pick<WaitEntry, 'contact' | 'kind'>): Promise<void>;
  /** 관리자가 넣는 독백 제작·검수 기준 */
  getGuide(): Promise<MonoGuide>;
  setGuide(g: MonoGuide): Promise<void>;
  /** 검수 기록 (관리자만 봄, 최근 300건) */
  logReview(r: ReviewLog): Promise<void>;
  reviews(limit?: number): Promise<(ReviewLog & { at: string })[]>;
}

export const emptyUsage = (): DayUsage => ({
  exam: { run: 0, follow: 0, hits: 0 },
  pro: { run: 0, follow: 0, hits: 0 },
  mono: { run: 0, follow: 0, hits: 0 },
});
