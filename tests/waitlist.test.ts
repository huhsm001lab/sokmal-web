// 대기 명단 (11-27): 소개 페이지에서 연락처를 남김 → 관리자에서 보고 지움
import { afterEach, describe, expect, it } from 'vitest';
import { cleanWaitlist, resetWaitTries, waitKey, waitTooMany } from '@/lib/waitlist';
import { MemoryStore } from '@/lib/data/memory';

const ok = { contact: 'Actor@Example.com', role: '배우', note: '  2차   지정희곡이 막막해요 ', consent: true };

describe('대기 명단 값 검사', () => {
  it('이메일·휴대폰만 받고 정리', () => {
    const e = cleanWaitlist(ok)!;
    expect(e.kind).toBe('email');
    expect(e.note).toBe('2차 지정희곡이 막막해요');
    expect(cleanWaitlist({ ...ok, contact: '010 1234 5678' })!.contact).toBe('010-1234-5678');
    expect(cleanWaitlist({ ...ok, contact: '0111234567' })!.contact).toBe('011-123-4567');
    expect(cleanWaitlist({ ...ok, contact: '02-123-4567' })).toBeNull();
    expect(cleanWaitlist({ ...ok, contact: 'not-an-email' })).toBeNull();
  });
  it('동의 없거나 자동 등록 칸에 값이 있으면 거절, 모르는 하는 일은 기타', () => {
    expect(cleanWaitlist({ ...ok, consent: false })).toBeNull();
    expect(cleanWaitlist({ ...ok, website: 'http://spam' })).toBeNull();
    expect(cleanWaitlist({ ...ok, role: '해커' })!.role).toBe('기타');
  });
  it('같은 사람 열쇠: 이메일 대소문자, 번호 모양 무시', () => {
    expect(waitKey({ contact: 'A@B.com', kind: 'email' })).toBe(waitKey({ contact: 'a@b.com', kind: 'email' }));
    expect(waitKey({ contact: '010-1234-5678', kind: 'phone' })).toBe('01012345678');
  });
});

describe('대기 명단 저장', () => {
  afterEach(() => resetWaitTries());
  it('새로 올리고, 같은 연락처는 고쳐 쓰고, 지움', async () => {
    const s = new MemoryStore();
    expect(await s.addWaitlist(cleanWaitlist(ok)!)).toBe('new');
    expect(await s.addWaitlist(cleanWaitlist({ ...ok, contact: 'actor@example.com', note: '다시' })!)).toBe('updated');
    expect(await s.addWaitlist(cleanWaitlist({ ...ok, contact: '010-1111-2222' })!)).toBe('new');
    const list = await s.waitlist();
    expect(list).toHaveLength(2);
    expect(list.find((w) => w.kind === 'email')!.note).toBe('다시');
    await s.removeWaitlist({ contact: 'ACTOR@example.com', kind: 'email' });
    expect((await s.waitlist()).map((w) => w.contact)).toEqual(['010-1111-2222']);
  });
  it('한 곳에서 10분에 5번까지', () => {
    for (let i = 0; i < 5; i++) expect(waitTooMany('1.2.3.4', 1000)).toBe(false);
    expect(waitTooMany('1.2.3.4', 1000)).toBe(true);
    expect(waitTooMany('1.2.3.4', 1000 + 11 * 60_000)).toBe(false);
  });
});
