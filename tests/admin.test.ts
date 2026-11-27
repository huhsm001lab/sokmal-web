import { afterEach, describe, expect, it } from 'vitest';
import { MemoryStore } from '@/lib/data/memory';
import { kstMonthOf } from '@/lib/data/kvstore';
import { cleanFeedback } from '@/lib/feedback';
import { adminCheck } from '@/lib/admin';
import { resetInviteFails } from '@/lib/invite';

describe('저장소: 관리자 데이터', () => {
  it('테스터별 합계·쓴 날·코드·호출·비용·의견이 모임', async () => {
    const s = new MemoryStore();
    await s.touch('inv-a', '2026-11-26', '482913');
    await s.touch('inv-a', '2026-11-27', '482913');
    await s.touch('inv-a', '2026-11-27', '482913'); // 같은 날 두 번은 하루
    await s.reserve('inv-a', '2026-11-27', 'exam', 'run', 5);
    await s.reserve('inv-a', '2026-11-27', 'exam', 'follow', 5);
    await s.reserve('inv-a', '2026-11-27', 'mono', 'run', 10);
    await s.refund('inv-a', '2026-11-27', 'mono', 'run');
    await s.hit('inv-a', '2026-11-27', 'pro');
    await s.logCall({ uid: 'inv-a', feature: '해석·exam', model: 'm', status: 'ok', inputTokens: 10, outputTokens: 5, cacheWriteTokens: 0, cacheReadTokens: 0, costKrw: 12.5 });
    await s.putFeedback('inv-a', { entries: [{ feature: '해석', fit: '맞았다', note: '좋아요', at: 1 }], review: null, reviewSkip: null });
    await s.setName('inv-a', '김배우');
    await s.setApproved('inv-a', true);
    const snap = (await s.adminSnapshot())!;
    expect(snap.testers).toHaveLength(1);
    const t = snap.testers[0];
    expect(t).toMatchObject({ uid: 'inv-a', code: '482913', name: '김배우', first: '2026-11-26', last: '2026-11-27', days: 2, calls: 1, costKrw: 12.5 });
    expect(t.totals.exam).toEqual({ run: 1, follow: 1, hits: 0 });
    expect(t.totals.mono).toEqual({ run: 0, follow: 0, hits: 0 });
    expect(t.totals.pro.hits).toBe(1);
    expect(t.feedback?.entries).toHaveLength(1);
    expect(snap.calls[0]).toMatchObject({ uid: 'inv-a', costKrw: 12.5 });
    expect(snap.approved).toEqual({ 'inv-a': true });
    expect(await s.costSince(new Date().toISOString())).toBe(12.5);
    await s.setName('inv-a', '');
    expect((await s.adminSnapshot())!.testers[0].name).toBe('');
  });
  it('한도는 동시에 눌러도 넘지 않음', async () => {
    const s = new MemoryStore();
    const r = await Promise.all(Array.from({ length: 12 }, () => s.reserve('u', 'd', 'exam', 'run', 5)));
    expect(r.filter(Boolean)).toHaveLength(5);
    expect((await s.usage('u', 'd')).exam).toEqual({ run: 5, follow: 0, hits: 7 });
  });
  it('비용 달은 한국 시간 기준', () => {
    expect(kstMonthOf('2026-11-30T15:30:00Z')).toBe('2026-12');
    expect(kstMonthOf('2026-11-30T14:30:00Z')).toBe('2026-11');
  });
});

describe('의견 문서 검사', () => {
  it('글자·숫자만 남기고 길이·개수 제한', () => {
    const d = cleanFeedback({
      entries: Array.from({ length: 310 }, (_, i) => ({ note: 'x'.repeat(500), at: i, fn: () => 1, nested: { a: 1 }, 'bad key': 1 })),
      review: { role: '배우', text: 'y'.repeat(2000), consent: true, answers: { career: '1년 안', evil: { x: 1 } } },
      reviewSkip: 'no',
    })!;
    expect(d.entries).toHaveLength(300);
    expect(d.entries![0]).toEqual({ note: 'x'.repeat(300), at: 10 });
    expect((d.review as { text: string }).text).toHaveLength(1000);
    expect((d.review as { answers: object }).answers).toEqual({ career: '1년 안' });
    expect(d.reviewSkip).toBeNull();
    expect(cleanFeedback('nope')).toBeNull();
  });
});

describe('관리자 코드', () => {
  afterEach(() => {
    delete process.env.SOKMAL_ADMIN_CODE;
    resetInviteFails();
  });
  const req = (code?: string) => new Request('http://x/', { headers: { 'x-forwarded-for': '9.9.9.9', ...(code ? { 'x-sokmal-admin': code } : {}) } });
  it('정하지 않으면 off, 맞으면 ok, 틀리면 wrong, 계속 틀리면 blocked', () => {
    expect(adminCheck(req('x'))).toBe('off');
    process.env.SOKMAL_ADMIN_CODE = 'Admin-Long-Code-1';
    expect(adminCheck(req('Admin-Long-Code-1'))).toBe('ok');
    expect(adminCheck(req('nope'))).toBe('wrong');
    for (let i = 0; i < 9; i++) adminCheck(req('nope'));
    expect(adminCheck(req('Admin-Long-Code-1'))).toBe('blocked');
  });
});
