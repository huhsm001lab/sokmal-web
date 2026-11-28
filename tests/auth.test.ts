// 로그인·프로필·승인 (11-28)
import { afterEach, describe, expect, it } from 'vitest';
import { cleanProfile, fakeToken, verifyUser } from '@/lib/auth';
import { accessOf } from '@/lib/server';
import { MemoryStore } from '@/lib/data/memory';

const ok = { name: '  김배우 ', role: '입시생', affiliation: '입시반', over14: true, consent: true };
const req = (t?: string) => new Request('http://x/', { headers: t ? { authorization: 'Bearer ' + t } : {} });
afterEach(() => {
  delete process.env.SOKMAL_FAKE_AUTH;
  delete process.env.SOKMAL_OWNER_EMAILS;
  delete process.env.SOKMAL_APPROVAL;
});

describe('프로필', () => {
  it('필수 항목 검사 (이름·하는 일·14세·동의)', () => {
    const p = cleanProfile(ok, 'a@b.kr', null);
    expect('error' in p).toBe(false);
    if (!('error' in p)) expect(p.name).toBe('김배우');
    expect(cleanProfile({ ...ok, name: ' ' }, 'a@b.kr', null)).toEqual({ error: 'name' });
    expect(cleanProfile({ ...ok, role: '해커' }, 'a@b.kr', null)).toEqual({ error: 'role' });
    expect(cleanProfile({ ...ok, over14: false }, 'a@b.kr', null)).toEqual({ error: 'over14' });
    expect(cleanProfile({ ...ok, consent: false }, 'a@b.kr', null)).toEqual({ error: 'consent' });
  });
  it('고쳐도 처음 동의한 때는 남음', () => {
    const first = cleanProfile(ok, 'a@b.kr', null, new Date('2026-11-01'));
    if ('error' in first) throw new Error();
    const again = cleanProfile({ ...ok, name: '새 이름' }, 'a@b.kr', first, new Date('2026-11-28'));
    if ('error' in again) throw new Error();
    expect(again.consentAt).toBe(first.consentAt);
    expect(again.name).toBe('새 이름');
  });
});

describe('로그인 확인·승인', () => {
  it('시험용 가짜 로그인은 켰을 때만', async () => {
    expect(await verifyUser(req(fakeToken('a@b.kr')))).toBeNull();
    process.env.SOKMAL_FAKE_AUTH = '1';
    const u = await verifyUser(req(fakeToken('A@B.kr')));
    expect(u?.email).toBe('a@b.kr');
    expect(await verifyUser(req('fake.' + Buffer.from('not-email').toString('base64url')))).toBeNull();
    expect(await verifyUser(req())).toBeNull();
  });
  it('관리자 이메일은 늘 승인, 기본은 대기, 승인제 끄면 바로, 막으면 막힘', async () => {
    const s = new MemoryStore();
    const u = { id: 'u1', email: 'a@b.kr', token: 't' };
    const get = s.getAccess.bind(s);
    expect(await accessOf(u, get)).toBe('pending');
    process.env.SOKMAL_OWNER_EMAILS = 'x@y.kr, A@B.kr';
    expect(await accessOf(u, get)).toBe('approved');
    delete process.env.SOKMAL_OWNER_EMAILS;
    process.env.SOKMAL_APPROVAL = 'off';
    expect(await accessOf(u, get)).toBe('approved');
    await s.setAccess('u1', 'blocked');
    expect(await accessOf(u, get)).toBe('blocked');
  });
  it('가입자 목록', async () => {
    const s = new MemoryStore();
    const p = cleanProfile(ok, 'a@b.kr', null);
    if ('error' in p) throw new Error();
    await s.putProfile('u1', p);
    await s.setAccess('u1', 'approved');
    expect((await s.members()).map((m) => [m.uid, m.profile.name, m.access])).toEqual([['u1', '김배우', 'approved']]);
  });
});
