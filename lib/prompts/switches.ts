// 관리자 스위치 (11-27): 독백 지침을 켜고 끄며 비교해 보기 위한 것.
// 프롬프트 원문(sokmal-prompts.js)은 건드리지 않고, 서버가 만든 독백 프롬프트에서 해당 부분만 빼낸다.
// 표시 문구를 못 찾으면(예시 프롬프트 등) 아무것도 빼지 않는다.

export type PromptSwitches = {
  /** 독백 쓰는 기준 7줄 */
  monoRules: boolean;
  /** 송무가 쓴 예시 독백 5편 */
  monoExamples: boolean;
};

export const DEFAULT_SWITCHES: PromptSwitches = { monoRules: true, monoExamples: true };

const RULES_START = '[쓰는 기준 — ';
const EX_START = '\n아래는 사람(SOKMAL 공동 창업자';
const EX_END_TAG = '</사람이 쓴 예시 5>';
const FORMAT = '형식: 맨 첫 줄에';

export function cleanSwitches(v: unknown): PromptSwitches {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  return {
    monoRules: typeof o.monoRules === 'boolean' ? o.monoRules : DEFAULT_SWITCHES.monoRules,
    monoExamples: typeof o.monoExamples === 'boolean' ? o.monoExamples : DEFAULT_SWITCHES.monoExamples,
  };
}

/** 기록용 꼬리표: 기본과 다르면 "(지침 끔)" 같은 표시 */
export function switchTag(s: PromptSwitches): string {
  if (s.monoRules && s.monoExamples) return '';
  if (!s.monoRules && !s.monoExamples) return ' (지침·예시 끔)';
  return !s.monoRules ? ' (지침 끔)' : ' (예시 끔)';
}

export function applyMonoSwitches(text: string, s: PromptSwitches): string {
  if (s.monoRules && s.monoExamples) return text;
  const r0 = text.indexOf(RULES_START);
  const f = r0 >= 0 ? text.indexOf(FORMAT, r0) : -1;
  if (r0 < 0 || f < 0) return text;
  const e0 = text.indexOf(EX_START, r0);
  const hasEx = e0 >= 0 && e0 < f;
  const eEnd = hasEx ? text.indexOf(EX_END_TAG, e0) : -1;
  const exEnd = eEnd >= 0 && eEnd < f ? eEnd + EX_END_TAG.length + 1 : -1; // 뒤 줄바꿈까지

  if (!s.monoRules && !s.monoExamples) return text.slice(0, r0) + text.slice(f);
  if (!s.monoRules) return text.slice(0, r0) + (hasEx ? text.slice(e0 + 1) : text.slice(f));
  // 예시만 끔
  if (!hasEx || exEnd < 0) return text;
  return text.slice(0, e0) + '\n' + text.slice(exEnd);
}
