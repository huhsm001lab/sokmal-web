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
  image: string;
  talk: string;
  updatedAt: string | null;
};
export type GuideKey = 'exam' | 'pro' | 'image' | 'talk';

export const GUIDE_MAX = 30_000;
export const EMPTY_GUIDE: MonoGuide = { make: '', review: '', reviewOn: false, exam: '', pro: '', image: '', talk: '', updatedAt: null };

export function cleanGuide(v: unknown): MonoGuide {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const txt = (x: unknown) => (typeof x === 'string' ? x.replace(/\r\n/g, '\n').trim().slice(0, GUIDE_MAX) : '');
  return {
    make: txt(o.make),
    review: txt(o.review),
    reviewOn: o.reviewOn === true,
    exam: txt(o.exam),
    pro: txt(o.pro),
    image: txt(o.image),
    talk: txt(o.talk),
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : null,
  };
}

const RULES_START = '[쓰는 기준 — ';
const EX_START = '\n아래는 사람(SOKMAL 공동 창업자';
const FORMAT = '형식: 맨 첫 줄에';

/** 제작 기준만으로는 빠지는 SOKMAL의 약속 (원칙: 배우의 경험이 재료, 소품 강요 금지, 연기 방식 지시 금지, 상대 줄 표시) */
function sokmalMust(mtype: string): string {
  return [
    '[SOKMAL에서 꼭 지킬 것]',
    mtype === '매체·오디션 독백'
      ? '- 매체·오디션 독백입니다. 일상 대화 형식이어도 됩니다.'
      : '- 입시 독백입니다. 짧아도 시작 → 쌓임 → 전환 → 상대에게 하는 요구나 결정이 보여야 합니다.',
    '- 배우가 직접 말한 경험과 답을 가장 중요한 재료로 씁니다. 지어낸 사연으로 덮지 않습니다.',
    '- 배우가 말하지 않은 소품은 넣지 않고, 흔한 이별 소품(칫솔·우산·반지·사진·편지)과 상투적인 장면은 쓰지 않습니다.',
    '- 호흡·강약·표정·속도 같은 연기 방식을 지시하지 않습니다.',
    '- 상대의 반응은 인물이 되받는 말 속에 드러내고, [상대]로 시작하는 줄은 꼭 필요할 때만 한두 곳 씁니다.',
  ].join('\n');
}

/** 독백 프롬프트의 기본 '쓰는 기준'을 제작 기준으로 바꾼다. 표시 문구가 없으면(예시 프롬프트 등) 그대로 */
export function applyMakeGuide(text: string, make: string, mtype: string): string {
  if (!make.trim()) return text;
  const r0 = text.indexOf(RULES_START);
  const f = r0 >= 0 ? text.indexOf(FORMAT, r0) : -1;
  if (r0 < 0 || f < 0) return text;
  const e0 = text.indexOf(EX_START, r0);
  const end = e0 >= 0 && e0 < f ? e0 : f;
  const block = `[쓰는 기준 — 창작 독백 제작 기준 (SOKMAL)]\n${make.trim()}\n\n${sokmalMust(mtype)}\n`;
  return text.slice(0, r0) + block + (end === e0 ? text.slice(e0) : '\n' + text.slice(f));
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
- 위의 쓰는 기준은 갈래마다 모두 지킵니다.

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
- 실제 사람이 하는 입말로 씁니다. 설명하지 않고, 상대가 이미 아는 일을 풀지 않습니다.
- 연기 방식(호흡·강약·표정·속도)이나 지문은 적지 않습니다.
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
