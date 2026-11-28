// 독백 기준 (11-27 송무): 관리자 화면에서 「제작 기준」「검수 기준」을 한글 그대로 넣고 고친다.
// - 제작 기준이 있으면 독백 프롬프트의 기본 '쓰는 기준 7줄' 자리를 그 글로 바꾼다(SOKMAL이 꼭 지킬 몇 줄은 붙여 둠).
// - 검수가 켜져 있으면: 1차로 쓴 독백을 검수 기준으로 평가·수정·재평가하게 한 번 더 부르고, 최종 독백만 배우에게 보낸다.
//   검수 내용(점수·감점 이유)은 관리자만 본다.
// 기준 글은 저장소(Upstash Redis)에만 있고 공개 저장소에는 없다.

export type MonoGuide = {
  /** 창작 독백 제작 기준 (비면 기본 7줄) */
  make: string;
  /** 평가 및 검수 기준 (비면 검수 안 함) */
  review: string;
  /** 검수 단계 켜기 */
  reviewOn: boolean;
  /** 11-28: 해석(입시·전문)·내 이미지·연기 대화 관리자 기준. 있으면 그 기능 프롬프트 끝에 덧붙임 */
  exam: string;
  pro: string;
  /** 전문 해석 '깊은 분석'(배우가 켰을 때만, 11-28) */
  proDeep: string;
  image: string;
  talk: string;
  updatedAt: string | null;
};
export type GuideKey = 'exam' | 'pro' | 'image' | 'talk';

export const GUIDE_MAX = 60_000; // 11-28 독백 지침 V2.1이 약 4만 8천 자
export const EMPTY_GUIDE: MonoGuide = { make: '', review: '', reviewOn: false, exam: '', pro: '', proDeep: '', image: '', talk: '', updatedAt: null };

export function cleanGuide(v: unknown): MonoGuide {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const txt = (x: unknown) => (typeof x === 'string' ? x.replace(/\r\n/g, '\n').trim().slice(0, GUIDE_MAX) : '');
  return {
    make: txt(o.make),
    review: txt(o.review),
    reviewOn: o.reviewOn === true,
    exam: txt(o.exam),
    pro: txt(o.pro),
    proDeep: txt(o.proDeep),
    image: txt(o.image),
    talk: txt(o.talk),
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : null,
  };
}

const RULES_START = '[쓰는 기준 — ';
const FORMAT = '형식: 맨 첫 줄에';

/** 독백 프롬프트에 관리자 '제작 기준'을 넣는다 (형식 줄 바로 앞). 11-28 송무 결정으로 기본 7줄·예시·SOKMAL 약속 줄은 모두 뺐음.
 *  예전 기본 기준이 남아 있는 글이면 그 자리를 통째로 바꾼다. 형식 줄이 없으면 그대로 */
export function applyMakeGuide(text: string, make: string, _mtype?: string): string {
  if (!make.trim()) return text;
  const f = text.indexOf(FORMAT);
  if (f < 0) return text;
  const r0 = text.indexOf(RULES_START);
  const start = r0 >= 0 && r0 < f ? r0 : f;
  return text.slice(0, start) + `[쓰는 기준 — 창작 독백 제작 기준]\n${make.trim()}\n\n[이 앱의 출력 형식] 위 기준의 출력 형식·필드와 아래 형식이 다르면, 아래 형식을 따릅니다.\n` + text.slice(f);
}

export const FINAL_MARK = '===최종 독백===';

/** 검수 요청 (1차 독백을 받은 뒤 같은 대화에 이어서 보냄) */
export function reviewWrap(criteria: string): string {
  return `[검수 단계 — 배우에게는 보이지 않습니다]
방금 쓴 독백을 아래 [검수 기준]에 따라 검수하고 고칩니다.
- 평가표 항목마다 점수와 구체적인 감점 이유를 적고, 어색하거나 작위적인 대사는 직접 인용해 문제를 설명합니다.
- 원본의 장점은 살리고 문제만 고칩니다. 배우가 말한 경험·답·사실은 바꾸지 않습니다.
- 고친 독백을 같은 기준으로 다시 평가합니다. 점수를 높이려고 기준을 느슨하게 하지 않습니다.
- 고치기는 최대 두 번까지. 최종 점검 질문을 통과한 버전을 냅니다. 점수보다 실제 사람의 말인지가 먼저입니다.
- 연기 방식(호흡·강약·표정·속도)을 지시하는 지문을 더하지 않습니다.

[검수 기준]
${criteria.trim()}

[출력 형식 — 반드시 이 순서]
[검수]
(항목별 점수와 감점 이유, 인용한 대사와 고친 방향)
수정 전 총점: (숫자)/100
수정 후 총점: (숫자)/100
${FINAL_MARK}
(처음 받은 [출력 형식] 그대로: 맨 첫 줄 [설계] 한 줄, 그다음 ## 독백 …, 끝까지. 검수 이야기는 여기 쓰지 않습니다)`;
}

export type ReviewParsed = { final: string | null; review: string; before: number | null; after: number | null };

/** 검수 답에서 최종 독백과 검수 내용을 나눈다. 표시가 없으면 final = null (1차 독백을 그대로 씀) */
export function parseReview(text: string): ReviewParsed {
  const i = text.lastIndexOf(FINAL_MARK);
  const review = (i >= 0 ? text.slice(0, i) : text).trim();
  const num = (re: RegExp) => {
    const m = review.match(re);
    const n = m ? Number(m[1]) : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
  };
  let final = i >= 0 ? text.slice(i + FINAL_MARK.length).trim() : null;
  if (final && !/##\s*독백/.test(final)) final = null; // 형식이 깨졌으면 쓰지 않음
  return { final, review, before: num(/수정\s*전\s*총점\s*[:：]?\s*(\d{1,3})/), after: num(/수정\s*후\s*총점\s*[:：]?\s*(\d{1,3})/) };
}

/** 해석·내 이미지 등: 관리자 기준을 프롬프트 끝에 붙인다 (원문 구조를 자르지 않음) */
export function appendGuide(text: string, extra: string): string {
  const t = extra.trim();
  if (!t) return text;
  return `${text}\n\n[관리자 기준 — 위 내용과 부딪히면 이 기준을 따릅니다. 출력 형식은 위의 것을 지킵니다]\n${t}`;
}

/** 독백 갈래 (11-28): 한 편 대신 같은 재료로 짧은 버전 여러 개. 배우가 고르거나 섞는다 */
export const VARIANT_TAG = '[갈래 보기]';
export function variantsWrap(n: number): string {
  return `${VARIANT_TAG} 이번에는 완성된 한 편 대신, 같은 재료로 짧은 독백 ${n}개를 씁니다. 배우가 보고 고르거나 섞습니다.
- 인물·상대·상황·배우의 경험과 답은 ${n}개 모두 같습니다. 인물이 상대를 움직이려는 방법(말을 꺼내는 방식, 상대를 대하는 태도, 숨기는 정도)만 서로 다르게 합니다.
- 갈래마다 요청한 길이의 절반쯤으로 짧게 씁니다.
- 갈래 이름은 그 갈래의 말하는 방법을 4~10자로만 적습니다(예: 먼저 따지며 / 끝까지 감추며 / 슬쩍 떠보며). 감정 상태나 연기 방법(호흡·표정·속도)을 적지 않습니다.

[이번 출력 형식 — 위의 출력 형식 대신 이것을 씁니다]
맨 첫 줄에 [설계] 한 줄(화면에는 보이지 않습니다).
${Array.from({ length: n }, (_, i) => `## 갈래 ${i + 1} — (말하는 방법)\n(대사)`).join('\n')}
그 밖의 섹션(더 나답게 만들려면 등)은 쓰지 않습니다.`;
}

export type Variant = { label: string; text: string };
/** "## 갈래 1 — 라벨" 단위로 나눈다 */
export function parseVariants(text: string): Variant[] {
  const out: Variant[] = [];
  const re = /^##[ \t]*갈래[ \t]*(\d+)[ \t]*[—\-–:]?[ \t]*(.*)$/gm;
  const marks = [...text.matchAll(re)];
  marks.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index ?? text.length : text.length;
    const body = text.slice(start, end).trim();
    if (body) out.push({ label: m[2].trim() || `갈래 ${m[1]}`, text: body });
  });
  return out;
}

/** 내 말로 고치기 (11-28): 독백의 한 줄을 다른 말 3가지로. 배우가 고르거나 직접 고친다 */
export const LINE_TAG = '[고칠 줄]';
export function linePrompt(monologue: string, line: string): string {
  return `당신은 배우의 독백을 같이 다듬는 극작가입니다. 아래 독백에서 ${LINE_TAG} 하나만 다른 말로 3가지 씁니다.
- 같은 인물, 같은 상대, 같은 순간입니다. 앞뒤 줄과 자연스럽게 이어져야 합니다.
- 그 줄이 상대에게 하려던 일은 그대로 두고 말만 바꿉니다. 세 가지는 서로 다른 말맛으로 씁니다.
- 형식: "- "로 시작하는 3줄만 씁니다. 다른 말은 쓰지 않습니다.

[독백]
${monologue}

${LINE_TAG}
${line}`;
}
export function parseLineOptions(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-•*]\s+/.test(l))
    .map((l) => l.replace(/^[-•*]\s+/, '').replace(/^["“](.*)["”]$/, '$1').trim())
    .filter(Boolean)
    .slice(0, 3);
}

/** 연기 대화 (11-28): 배우가 연기에 대해 묻는 대화. 원리는 분명하게, 선택은 여러 갈래로 */
export const TALK_TAG = '[연기 대화]';
export function talkPrompt(expert: string, attach: { title: string; body: string } | null): string {
  return `${expert}

${TALK_TAG} 당신은 배우와 연기에 대해 이야기하는 연기 교육자이자 동료입니다. 목적은 정답을 주는 것이 아니라 배우가 스스로 생각하고 고르게 돕는 것입니다.

[대화 규칙]
- 길이: 짧게, 300~500자 안팎. 한 번에 다 풀지 않습니다.
- 개념과 원리(행동동사, 목적과 장애물, 사실·주장·추측·선택, 서브텍스트 등)는 분명하게 설명합니다.
- 연기를 어떻게 할지는 정해 주지 않습니다. 가능성을 "이렇게 보면 ~, 저렇게 보면 ~"으로 나란히 보여 주고, 고르는 건 배우의 몫이라고 둡니다.
- 호흡·강약·톤·템포·표정 같은 연기 방식은 먼저 꺼내지 않습니다. 배우가 직접 물으면 원리와 선택지까지만 보여 줍니다.
- 실존 배우를 평가하거나 서로 비교하지 않습니다. 실제 작품의 대사를 옮기지 않습니다.
- 모르거나 확실하지 않으면 그렇다고 말합니다. 마음의 어려움이나 건강 문제가 보이면 가까운 사람이나 전문가와 이야기해 보길 권합니다.
- 끝은 배우가 자기 생각을 꺼내게 하는 짧은 되묻는 질문 1개로 마칩니다.
- 형식: 제목(##) 없이 짧은 문단과 "- 항목"만 씁니다.${
    attach ? `\n\n[배우가 붙인 내 기록 — 이 글에 대한 질문일 수 있습니다]\n제목: ${attach.title}\n${attach.body}` : ''
  }`;
}
