// 독백 기준 (11-27): 관리자가 넣은 제작 기준으로 '쓰는 기준'을 바꾸고, 검수 답에서 최종본을 나눈다
import { describe, expect, it } from 'vitest';
import { applyMakeGuide, cleanGuide, EMPTY_GUIDE, FINAL_MARK, parseReview, reviewWrap } from '@/lib/guide';
import { MemoryStore } from '@/lib/data/memory';

const RULES = '[쓰는 기준 — 이것만 지키고 나머지는 자유롭게 씁니다]\n1. 규칙 하나\n7. 규칙 일곱\n';
const EX = '\n아래는 사람(SOKMAL 공동 창업자, 배우)이 직접 쓴 독백 5편입니다.\n<사람이 쓴 예시 1>\n예시\n</사람이 쓴 예시 1>\n';
const FORMAT = '형식: 맨 첫 줄에 [설계] 한 줄. 그다음 ## 독백.';
const HEAD = '당신은 극작가입니다.\n\n[배우의 이야기]\n친구 이야기\n\n';
const full = HEAD + RULES + EX + '\n' + FORMAT;

describe('제작 기준 바꿔 끼우기', () => {
  it('7줄 자리에 제작 기준 + SOKMAL 약속, 예시·형식은 그대로', () => {
    const t = applyMakeGuide(full, '01. 대사의 자연스러움\n* 말하기 좋은 대사', '입시 독백');
    expect(t).not.toContain('규칙 하나');
    expect(t).toContain('01. 대사의 자연스러움');
    expect(t).toContain('[SOKMAL에서 꼭 지킬 것]');
    expect(t).toContain('입시 독백입니다');
    expect(t).toContain('흔한 이별 소품');
    expect(t).toContain('<사람이 쓴 예시 1>');
    expect(t).toContain(FORMAT);
    expect(t.startsWith(HEAD)).toBe(true);
  });
  it('예시가 꺼져 있어도 형식은 남음', () => {
    const noEx = HEAD + RULES + '\n' + FORMAT;
    const t = applyMakeGuide(noEx, '기준', '매체·오디션 독백');
    expect(t).toContain('매체·오디션 독백입니다');
    expect(t).toContain(FORMAT);
  });
  it('기준이 비었거나 표시 문구가 없으면 그대로', () => {
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
