// 관리자 스위치 (11-27): 독백 지침·예시를 끄면 그 부분만 빠지고, 재료와 형식은 남는다
import { describe, expect, it } from 'vitest';
import { applyMonoSwitches, cleanSwitches, DEFAULT_SWITCHES, switchTag } from '@/lib/prompts/switches';
import { MemoryStore } from '@/lib/data/memory';

// 실제 독백 프롬프트와 같은 모양(원문은 공개 저장소에 없어서 모양만 흉내)
const RULES = '[쓰는 기준 — 이것만 지키고 나머지는 자유롭게 씁니다]\n1. 규칙 하나\n7. 규칙 일곱\n';
const EX = '\n아래는 사람(SOKMAL 공동 창업자, 배우)이 직접 쓴 독백 5편입니다.\n<사람이 쓴 예시 1>\n예시\n</사람이 쓴 예시 1>\n\n<사람이 쓴 예시 5>\n예시\n</사람이 쓴 예시 5>\n';
const FORMAT = '형식: 맨 첫 줄에 [설계] 한 줄. 그다음 ## 독백.';
const HEAD = '당신은 극작가입니다.\n\n[재료]\n감정: 서운함\n\n[배우의 이야기]\n친구 이야기\n\n';
const TAIL = '\n\n[출력 형식]\n[설계] 한 줄\n## 독백\n(본문)';
const full = HEAD + RULES + EX + '\n' + FORMAT + TAIL;

describe('독백 지침 스위치', () => {
  it('기본(둘 다 켬)이면 그대로', () => {
    expect(applyMonoSwitches(full, DEFAULT_SWITCHES)).toBe(full);
  });
  it('기준만 끄면 7줄이 빠지고 예시·재료·형식은 남음', () => {
    const t = applyMonoSwitches(full, { monoRules: false, monoExamples: true });
    expect(t).not.toContain('[쓰는 기준');
    expect(t).not.toContain('규칙 하나');
    expect(t).toContain('<사람이 쓴 예시 5>');
    expect(t).toContain('친구 이야기');
    expect(t).toContain(FORMAT);
    expect(t).toContain('## 독백');
  });
  it('예시만 끄면 예시가 빠지고 기준은 남음', () => {
    const t = applyMonoSwitches(full, { monoRules: true, monoExamples: false });
    expect(t).toContain('규칙 일곱');
    expect(t).not.toContain('사람이 쓴 예시');
    expect(t).not.toContain('아래는 사람');
    expect(t).toContain(FORMAT);
  });
  it('둘 다 끄면 재료와 형식만', () => {
    const t = applyMonoSwitches(full, { monoRules: false, monoExamples: false });
    expect(t).toBe(HEAD + FORMAT + TAIL);
  });
  it('표시 문구가 없는 프롬프트(예시 프롬프트)는 건드리지 않음', () => {
    const other = '당신은 극작가입니다. 독백을 쓰세요.';
    expect(applyMonoSwitches(other, { monoRules: false, monoExamples: false })).toBe(other);
  });
  it('잘못된 값은 기본으로, 기록 꼬리표', () => {
    expect(cleanSwitches({ monoRules: 'no', x: 1 })).toEqual(DEFAULT_SWITCHES);
    expect(switchTag(DEFAULT_SWITCHES)).toBe('');
    expect(switchTag({ monoRules: false, monoExamples: true })).toBe(' (지침 끔)');
    expect(switchTag({ monoRules: false, monoExamples: false })).toBe(' (지침·예시 끔)');
  });
  it('저장소에 저장하고 다시 읽음 (처음엔 둘 다 켬)', async () => {
    const s = new MemoryStore();
    expect(await s.getSwitches()).toEqual(DEFAULT_SWITCHES);
    await s.setSwitches({ monoRules: false, monoExamples: true });
    expect(await s.getSwitches()).toEqual({ monoRules: false, monoExamples: true });
  });
});
