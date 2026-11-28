// 검수된 작품 노트 (11-28): 이름 맞추기, 프롬프트 블록, 저장
import { describe, expect, it } from 'vitest';
import { appendNote, cleanNote, matchNote, noteBlock, normTitle } from '@/lib/notes';
import { MemoryStore } from '@/lib/data/memory';

const n1 = cleanNote({ title: '빈 집', aliases: '빈집, The Empty House', author: '가상 작가', summary: '어머니와 딸이 집을 정리한다.', characters: '딸: 떠나려 함', monoSpots: '2막 3장 / 딸이 짐을 싸는 장면', status: '검수됨' })!;
const draft = cleanNote({ title: '초안 작품', status: '초안' })!;

describe('작품 노트 맞추기', () => {
  it('제목·다른 이름, 괄호·띄어쓰기 무시', () => {
    expect(normTitle('〈빈 집〉')).toBe('빈집');
    expect(matchNote([n1], '〈빈 집〉', '')?.title).toBe('빈 집');
    expect(matchNote([n1], 'the empty house', '')?.title).toBe('빈 집');
    expect(matchNote([n1], '빈 방', '')).toBeNull();
  });
  it('작품명이 없으면 본문 첫 줄에서, 초안은 쓰지 않음', () => {
    expect(matchNote([n1], '', '\n빈 집 — 1막\n어머니: 가니?')?.title).toBe('빈 집');
    expect(matchNote([draft], '초안 작품', '')).toBeNull();
  });
  it('프롬프트 블록: 사실 우선, [모름] 금지, 내용 포함', () => {
    const b = noteBlock(n1);
    expect(b).toContain('[모름]으로 답하지 않습니다');
    expect(b).toContain('2막 3장');
    expect(appendNote('원래 프롬프트', n1).startsWith('원래 프롬프트\n\n[SOKMAL 검수된 작품 노트')).toBe(true);
    expect(appendNote('원래 프롬프트', null)).toBe('원래 프롬프트');
  });
  it('작품명 없으면 거절, 다른 이름 정리', () => {
    expect(cleanNote({ title: '  ' })).toBeNull();
    expect(n1.aliases).toEqual(['빈집', 'The Empty House']);
  });
});

describe('작품 노트 저장', () => {
  it('저장·고치기·지우기', async () => {
    const s = new MemoryStore();
    await s.putNote(n1);
    await s.putNote({ ...n1, summary: '고친 줄거리' });
    expect((await s.notes()).map((n) => n.summary)).toEqual(['고친 줄거리']);
    await s.removeNote(n1.id);
    expect(await s.notes()).toEqual([]);
  });
});
