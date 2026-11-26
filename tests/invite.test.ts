import { afterEach, describe, expect, it } from 'vitest';
import { inviteOk, inviteOn, inviteValid } from '@/lib/invite';

afterEach(() => {
  delete process.env.SOKMAL_INVITE_CODES;
});

describe('초대 코드', () => {
  it('코드를 정하지 않으면 누구나 통과', () => {
    expect(inviteOn()).toBe(false);
    expect(inviteOk(new Request('http://x/'))).toBe(true);
  });
  it('정한 코드만 통과 (쉼표·줄바꿈 구분, 대소문자·앞뒤 공백 무시)', () => {
    process.env.SOKMAL_INVITE_CODES = 'mina-7Q4K, junho-2XW9\nteacher-01';
    expect(inviteValid('mina-7q4k')).toBe(true);
    expect(inviteValid('  JUNHO-2XW9 ')).toBe(true);
    expect(inviteValid('teacher-01')).toBe(true);
    expect(inviteValid('mina')).toBe(false);
    expect(inviteValid('')).toBe(false);
    expect(inviteOk(new Request('http://x/'))).toBe(false);
    expect(inviteOk(new Request('http://x/', { headers: { 'x-sokmal-invite': 'teacher-01' } }))).toBe(true);
  });
});
