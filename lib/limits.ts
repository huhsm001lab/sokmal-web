// 설정값 (PRD 9절). 숫자는 여기서만 바꿔요.
export type CounterKey = 'exam' | 'pro' | 'mono';

export const LIMITS = {
  /** 하루 횟수. 해석은 모드별(정리·이어서 묻기 모두 1회) [확정], 독백은 모드 합산 10회 [기본안] */
  daily: { exam: 5, pro: 5, mono: 10 } as Record<CounterKey, number>,
  /** 한 번에 받는 본문 글자 수 [임시값] */
  maxText: 80000,
  /** 번안 원문 글자 수 [개발값] */
  adaptText: 4000,
};

/** 하루 기준: 정식은 서버 한국 시간 [기본안] */
export function kstDay(now = new Date()): string {
  // en-CA 형식은 YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** 한국 시간으로 이번 달 1일 0시를 UTC ISO 문자열로 */
export function kstMonthStartIso(now = new Date()): string {
  const [y, m] = kstDay(now).split('-');
  return new Date(`${y}-${m}-01T00:00:00+09:00`).toISOString();
}
