// 독백 기준 (11-27): 관리자가 넣은 제작 기준으로 '쓰는 기준'을 바꾸고, 검수 답에서 최종본을 나눈다
import { describe, expect, it } from 'vitest';
import { applyMakeGuide, cleanGuide, EMPTY_GUIDE, FINAL_MARK, parseReview, reviewWrap } from '@/lib/guide';
import { MemoryStore } from '@/lib/data/memory';

const RULES = '[쓰는 기준 — 이것만 지키고 나머지는 자유롭게 씁니다]\n1. 규칙 하나\n7. 규칙 일곱\n';
const EX = '\n아래는 사람(SOKMAL 공동 창업자, 배우)이 직접 쓴 독백 5편입니다.\n<사람이 쓴 예시 1>\n예시\n</사람이 쓴 예시 1>\n';
const FORMAT = '형식: 맨 첫 줄에 [설계] 한 줄. 그다음 ## 독백.';
const HEAD = '당신은 극작가입니다.\n\n[배우의 이야기]\n친구 이야기\n\n';
const full = HEAD + RULES + EX + '\n' + FORMAT;

describe('제작 기준 넣기 (11-28: 기본 지침·약속 줄 없음)', () => {
  it('예전 기본 기준·예시 자리는 통째로 제작 기준으로, 약속 줄은 붙지 않음', () => {
    const t = applyMakeGuide(full, '01. 대사의 자연스러움', '입시 독백');
    expect(t).not.toContain('규칙 하나');
    expect(t).not.toContain('사람이 쓴 예시');
    expect(t).not.toContain('SOKMAL에서 꼭 지킬 것');
    expect(t).toBe(HEAD + '[쓰는 기준 — 창작 독백 제작 기준]\n01. 대사의 자연스러움\n\n' + FORMAT);
  });
  it('기본 기준이 없는 글이면 형식 줄 바로 앞에', () => {
    expect(applyMakeGuide(HEAD + FORMAT, '기준', '매체·오디션 독백')).toBe(HEAD + '[쓰는 기준 — 창작 독백 제작 기준]\n기준\n\n' + FORMAT);
  });
  it('기준이 비었거나 형식 줄이 없으면 그대로', () => {
    expect(applyMakeGuide(full, '  ', '입시 독백')).toBe(full);
    expect(applyMakeGuide('다른 프롬프트', '기준', '입시 독백')).toBe('다른 프롬프트');
  });
});

describe('검수 답 나누기', () => {
  it('점수와 최종본', () => {
    const r = parseReview(`[검수]\n자연스러움 10/15\n수정 전 총점: 68/100\n수정 후 총점: 83/100\n${FINAL_MARK}\n[설계] 한 줄\n## 독백\n고친 대사\n## 더 나답게 만들려면\n- 질문`);
    expect(r.before).toBe(68);
    expect(r.after).toBe(83);
    expect(r.final!.startsWith('[설계]')).toBe(true);
    expect(r.review).toContain('자연스러움 10/15');
  });
  it('표시가 없거나 ## 독백이 없으면 최종본 없음', () => {
    expect(parseReview('[검수] 좋아요').final).toBeNull();
    expect(parseReview(`[검수]\n${FINAL_MARK}\n그냥 글`).final).toBeNull();
  });
  it('검수 요청에 기준이 들어가고 연기 지시를 막음', () => {
    const w = reviewWrap('01. 평가표');
    expect(w).toContain('01. 평가표');
    expect(w).toContain(FINAL_MARK);
    expect(w).toContain('연기 방식');
  });
});

describe('저장', () => {
  it('기준 저장·읽기, 너무 긴 글은 자름, 검수 기록', async () => {
    const s = new MemoryStore();
    expect(await s.getGuide()).toEqual(EMPTY_GUIDE);
    await s.setGuide(cleanGuide({ make: 'a'.repeat(40_000), review: '검수', reviewOn: true }));
    const g = await s.getGuide();
    expect(g.make.length).toBe(30_000);
    expect(g.reviewOn).toBe(true);
    await s.logReview({ uid: 'u1', feature: '독백·new', before: 70, after: 85, used: true, review: 'r', draft: 'd', final: 'f' });
    const rv = await s.reviews();
    expect(rv[0].after).toBe(85);
    expect(typeof rv[0].at).toBe('string');
  });
});

describe('독백 갈래 (11-28)', () => {
  it('갈래 요청 문구와 나누기', async () => {
    const { variantsWrap, parseVariants, VARIANT_TAG } = await import('@/lib/guide');
    const w = variantsWrap(3);
    expect(w.startsWith(VARIANT_TAG)).toBe(true);
    expect(w).toContain('## 갈래 3 — (말하는 방법)');
    expect(w).toContain('연기 방법(호흡·표정·속도)을 적지 않습니다');
    const v = parseVariants('[설계] x\n## 갈래 1 — 먼저 따지며\n왜 말 안 했어?\n## 갈래 2 - 끝까지 감추며\n괜찮아.\n## 갈래 3\n혹시?');
    expect(v.map((x) => x.label)).toEqual(['먼저 따지며', '끝까지 감추며', '갈래 3']);
    expect(v[0].text).toBe('왜 말 안 했어?');
  });
  it('서버: 새로 쓰기에서만, 횟수는 독백 1회, 검수 안 함', async () => {
    const { buildJob } = await import('@/lib/prompts/build');
    const { EMPTY_GUIDE } = await import('@/lib/guide');
    const c = { pro: false, kw: { mtype: '입시 독백', writer: '', emotion: [], situation: [], listener: [], mood: [], temper: [], hide: '', length: '1분' }, story: '이야기', draft: '초안', memo: '', src: '', srcFrom: '', mat: '' };
    const g = { ...EMPTY_GUIDE, review: '검수', reviewOn: true };
    const sw = { monoRules: true, monoExamples: true };
    const j = buildJob({ kind: 'mono', c, qa: null, mMode: 'new', hist: [], variants: 3 }, () => 5, sw, g);
    expect(j.feature).toBe('독백·갈래 [지침 없음]');
    expect(j.review).toBeUndefined();
    expect(j.counter).toEqual({ key: 'mono', kind: 'run', limit: 10 });
    expect(String(j.messages[0].content)).toContain('[갈래 보기]');
    const r = buildJob({ kind: 'mono', c, qa: null, mMode: 'refine', hist: [], variants: 3 }, () => 5, sw, g);
    expect(r.feature).toBe('독백·refine [지침 없음]');
    expect(r.review).toBe('검수');
  });
});

describe('내 말로 고치기 (11-28)', () => {
  it('한 줄 다른 말: 가벼운 모델, line 횟수 30, 지침 없음(11-28)', async () => {
    const { buildJob } = await import('@/lib/prompts/build');
    const { parseLineOptions } = await import('@/lib/guide');
    const j = buildJob({ kind: 'mono_line', text: '왔네.\n물 마시러 나온 거야.', line: '물 마시러 나온 거야.' }, () => 5);
    expect(j.tier).toBe('light');
    expect(j.counter).toEqual({ key: 'line', kind: 'run', limit: 30 });
    const t = String(j.messages[0].content);
    expect(t).toContain('[고칠 줄]\n물 마시러 나온 거야.');
    expect(t).not.toContain('연기 방식');
    expect(() => buildJob({ kind: 'mono_line', text: '', line: 'x' }, () => 5)).toThrow();
    expect(parseLineOptions('- 하나\n• "둘"\n그냥 글\n- 셋\n- 넷')).toEqual(['하나', '둘', '셋']);
  });
});

describe('연기 대화 (11-28)', () => {
  it('첫 메시지에 규칙·관리자 기준·붙인 기록, 이어 묻기는 follow로 셈', async () => {
    const { buildJob } = await import('@/lib/prompts/build');
    const { EMPTY_GUIDE } = await import('@/lib/guide');
    const g = { ...EMPTY_GUIDE, talk: '행동동사는 배우가 고른다' };
    const sw = { monoRules: true, monoExamples: true };
    const j1 = buildJob({ kind: 'talk', q: '행동동사가 뭐예요?', turns: [] }, () => 5, sw, g);
    const t = String(j1.messages[0].content);
    expect(t).toContain('[연기 대화]');
    expect(t).toContain('실존 배우를 평가하거나');
    expect(t).toContain('행동동사는 배우가 고른다');
    expect(t.endsWith('[배우의 말]\n행동동사가 뭐예요?')).toBe(true);
    expect(j1.counter).toEqual({ key: 'talk', kind: 'run', limit: 20 });
    const j2 = buildJob({ kind: 'talk', q: '그럼 장애물은요?', turns: [{ q: '행동동사가 뭐예요?', a: '답1' }], attach: { title: '내 독백', body: '왔네.' } }, () => 5, sw, g);
    expect(j2.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(String(j2.messages[0].content)).toContain('[배우가 붙인 내 기록');
    expect(j2.messages[2].content).toBe('그럼 장애물은요?');
    expect(j2.counter?.kind).toBe('follow');
    expect(() => buildJob({ kind: 'talk', q: ' ', turns: [] }, () => 5)).toThrow();
  });
});
