import { afterEach, describe, expect, it } from 'vitest';
import { inviteBlocked, inviteOk, inviteOn, inviteValid, noteInviteFail, resetInviteFails } from '@/lib/invite';

afterEach(() => {
  delete process.env.SOKMAL_INVITE_CODES;
  resetInviteFails();
});
const req = (code?: string, ip = '1.2.3.4') =>
  new Request('http://x/', { headers: { 'x-forwarded-for': ip, ...(code ? { 'x-sokmal-invite': code } : {}) } });

describe('초대 코드', () => {
  it('코드를 정하지 않으면 누구나 통과', () => {
    expect(inviteOn()).toBe(false);
    expect(inviteOk(req())).toBe(true);
  });
  it('정한 숫자 코드만 통과 (쉼표·줄바꿈 구분, 앞뒤 공백 무시)', () => {
    process.env.SOKMAL_INVITE_CODES = '482913, 705162\n031557';
    expect(inviteValid('482913')).toBe(true);
    expect(inviteValid(' 705162 ')).toBe(true);
    expect(inviteValid('031557')).toBe(true);
    expect(inviteValid('31557')).toBe(false);
    expect(inviteValid('')).toBe(false);
    expect(inviteOk(req())).toBe(false);
    expect(inviteOk(req('031557'))).toBe(true);
  });
  it('같은 주소에서 10번 틀리면 맞는 코드도 15분간 막힘, 다른 주소는 그대로', () => {
    process.env.SOKMAL_INVITE_CODES = '482913';
    for (let i = 0; i < 9; i++) expect(inviteOk(req(String(100000 + i)))).toBe(false);
    expect(inviteBlocked(req())).toBe(false);
    expect(inviteOk(req('999999'))).toBe(false); // 10번째
    expect(inviteBlocked(req())).toBe(true);
    expect(inviteOk(req('482913'))).toBe(false);
    expect(inviteOk(req('482913', '5.6.7.8'))).toBe(true);
    expect(inviteBlocked(req(), Date.now() + 16 * 60_000)).toBe(false);
  });
  it('10분이 지나면 틀린 횟수를 새로 셈', () => {
    process.env.SOKMAL_INVITE_CODES = '482913';
    const t0 = Date.now();
    for (let i = 0; i < 9; i++) noteInviteFail(req(), t0);
    noteInviteFail(req(), t0 + 11 * 60_000);
    expect(inviteBlocked(req(), t0 + 11 * 60_000)).toBe(false);
  });
});
