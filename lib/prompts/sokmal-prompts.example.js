// 예시 프롬프트 (공개 저장소용).
// 실제 프롬프트 원문(sokmal-prompts.js)은 공개 저장소에 올리지 않아요. 원문이 없으면 이 파일이 대신 쓰여서
// 앱이 켜지고 화면 흐름을 시험할 수 있어요. 답의 형식(## 제목, [설계], [상대], Q., [메모])만 맞춰 둔 짧은 예시예요.
// 원문을 쓰려면 lib/prompts/sokmal-prompts.js 를 넣거나, 배포할 때 SOKMAL_PROMPTS_JS_BASE64 환경변수를 쓰세요(README).
/* eslint-disable */

export const IS_EXAMPLE = true;

export const EXPERT = `[예시 기반] 당신은 연기·극작을 돕는 조력자입니다. 해석과 연기의 선택은 사람의 몫으로 남깁니다. 한국어로 답합니다.`;
export const MONO_EXAMPLE = '';
export const SRC_RULE = `[본문] 본문이 있으면 본문을 기준으로 씁니다.`;
export const TITLE_RULE = `[작품명만] 모르는 작품이면 "[모름]"으로 시작해 본문을 요청합니다.`;
export const CHECK_RULE = `[확인] 희곡처럼 보이지 않으면 "[확인]"으로 시작하는 질문 한 줄만 씁니다.`;
export const PRO_RULES = `[대화] 짧게 답하고 질문 하나로 끝냅니다. 마지막 줄: [메모] 원하는 것: … ｜ 숨기는 것: … ｜ 읽기: …`;
export const CLOSING = `\n\n[마지막 답] 지금까지의 읽기와 열린 질문을 정리합니다.`;

export function imagePromptOf({ f, purpose, answers }) {
  return `${EXPERT}\n\n[예시: 내 이미지] 찾는 것: ${purpose}\n${Object.entries(f).map(([k, v]) => k + ': ' + (v || '(비움)')).join('\n')}\n${answers.join('\n')}\n\n형식: ## 내 답에서 보이는 모습 / ## 이미지 키워드 / ## 나에게 물어볼 것\n독백 키워드: (쉼표로 4개)`;
}
export function parseDesign(t) {
  const m = String(t).match(/^\s*\[설계\]\s*(.+)$/m);
  return m ? m[1].slice(0, 240) : null;
}
export function monoRules(mtype) {
  return `[예시 기준] ${mtype}. 본문 사이에 [상대] 줄을 넣습니다. 형식: 첫 줄 [설계] 한 줄, 그다음 ## 독백.`;
}
export function memoBlock(memo) {
  return memo ? `\n\n[메모]\n${memo}` : '';
}
export function qaBlock(qa) {
  const a = (qa || []).filter((x) => x.a);
  return a.length ? `\n\n[배우의 답]\n${a.map((x) => 'Q. ' + x.q + '\nA. ' + x.a).join('\n')}` : '';
}
export function monoPrompt(c, qa, mMode, hist) {
  const head = mMode === 'adapt' ? `[예시: 번안]\n${c.src}` : mMode === 'refine' ? `[예시: 초안 다듬기]\n${c.draft}` : '[예시: 새로 쓰기]';
  return `${head}\n\n${c.mat}\n\n${c.story || '(없음)'}${qaBlock(qa)}${memoBlock(c.memo)}\n\n${monoRules(c.kw.mtype)}${hist && hist.length ? '\n이전과 다르게: ' + hist.join(' / ') : ''}\n## 더 나답게 만들려면\n- 질문 2개`;
}
export function askPrompt(c) {
  return `[예시: 쓰기 전 질문] 아래 재료에 맞춰 "Q. "로 시작하는 짧은 질문 3줄만 씁니다.\n\n${c.mat}\n\n${c.story || '(없음)'}`;
}
export function examPromptOf({ text, work, part, mine }) {
  return `${EXPERT}\n\n${SRC_RULE}\n${text ? CHECK_RULE : TITLE_RULE}\n[예시: 입시 정리]${part ? ' (일부 본문)' : ''}\n작품명: ${work || '(없음)'}\n내 생각: ${mine || '(없음)'}\n본문:\n${text || '(없음)'}\n\n형식: ## 줄거리 / ## 주요 인물과 관계 / ## 주제로 읽을 수 있는 것 / ## 인물별로 보이는 것 / ## 독백 후보 구간 (- 항목) / ## 내 분석을 위한 한 가지`;
}
export function proPromptOf({ text, work, char, part, mine, last }) {
  return `${EXPERT}\n\n${SRC_RULE}\n${CHECK_RULE}\n${PRO_RULES}\n[예시: 전문 해석] 작품: ${work || '(없음)'} 인물: ${char || '(없음)'}${part ? ' (일부 본문)' : ''}\n본문:\n${text}\n배우의 생각: ${mine || '(없음)'}${last ? CLOSING : ''}`;
}
export const examFollowWrap = (q) => `[후속 질문]\n${q}\n\n짧게 답합니다.`;
export const proFollowWrap = (q, info) => `[배우의 말 — ${info.turn}번째]\n${q}\n\n짧게, 질문 하나로 끝내고 [메모]를 붙입니다.${info.last ? CLOSING : ''}`;
export const monoChatWrap = (q) => `[다듬기 요청]\n${q}\n\n요청한 곳만 고칩니다. 형식: ## 고친 독백 / ## 바꾼 곳`;
export function designText(d) {
  return Object.entries(d).map(([k, v]) => k + ': ' + (v && v.trim() ? v.trim() : '(비어 있음)')).join('\n');
}
export function designPromptOf(d) {
  return `${EXPERT}\n\n[예시: 설계 점검]\n${designText(d)}`;
}
