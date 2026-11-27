import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@/lib/data/memory';
import { costOf } from '@/lib/budget';
import { kstDay, kstMonthStartIso } from '@/lib/limits';

describe('하루 횟수', () => {
  it('5번까지 예약되고 6번째는 막히며 "한도에 걸림"이 올라감', async () => {
    const s = new MemoryStore();
    for (let i = 0; i < 4; i++) expect(await s.reserve('u', 'd', 'exam', 'run', 5)).toBe(true);
    expect(await s.reserve('u', 'd', 'exam', 'follow', 5)).toBe(true); // 이어서 묻기도 같이 셈
    expect(await s.reserve('u', 'd', 'exam', 'run', 5)).toBe(false);
    const u = await s.usage('u', 'd');
    expect(u.exam).toEqual({ run: 4, follow: 1, hits: 1 });
    expect(u.pro.run).toBe(0); // 모드별로 따로 셈
  });
  it('오류·[확인]·중단이면 돌려줌', async () => {
    const s = new MemoryStore();
    await s.reserve('u', 'd', 'mono', 'run', 10);
    await s.refund('u', 'd', 'mono', 'run');
    expect((await s.usage('u', 'd')).mono.run).toBe(0);
    await s.refund('u', 'd', 'mono', 'run'); // 0 아래로 내려가지 않음
    expect((await s.usage('u', 'd')).mono.run).toBe(0);
  });
  it('날이 바뀌면 새로 셈', async () => {
    const s = new MemoryStore();
    for (let i = 0; i < 5; i++) await s.reserve('u', '2026-11-26', 'exam', 'run', 5);
    expect(await s.reserve('u', '2026-11-26', 'exam', 'run', 5)).toBe(false);
    expect(await s.reserve('u', '2026-11-27', 'exam', 'run', 5)).toBe(true);
  });
});

describe('한국 시간', () => {
  it('UTC 15시는 한국 다음 날 0시', () => {
    expect(kstDay(new Date('2026-11-26T14:59:00Z'))).toBe('2026-11-26');
    expect(kstDay(new Date('2026-11-26T15:00:00Z'))).toBe('2026-11-27');
  });
  it('이번 달 시작은 한국 1일 0시', () => {
    expect(kstMonthStartIso(new Date('2026-11-30T16:00:00Z'))).toBe('2026-11-30T15:00:00.000Z'); // 한국 12-01 01:00 → 12-01 0시
    expect(kstMonthStartIso(new Date('2026-11-26T03:00:00Z'))).toBe('2026-10-31T15:00:00.000Z');
  });
});

describe('비용', () => {
  it('Sonnet 5.5: 입력 100만 $2, 출력 100만 $10, 캐시 읽기 $0.10', () => {
    const u = { input_tokens: 1_000_000, output_tokens: 1_000_000, cache_creation_input_tokens: 0, cache_read_input_tokens: 1_000_000, iterations: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(costOf(u as any, 'claude-sonnet-5-5', 1000).krw).toBe(12100);
  });
  it('거절 뒤 다른 모델로 넘어가면 시도마다 그 모델 값으로 셈', () => {
    const u = {
      input_tokens: 0,
      output_tokens: 0,
      iterations: [
        { type: 'message', model: null, input_tokens: 1_000_000, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        { type: 'fallback_message', model: 'claude-sonnet-5', input_tokens: 1_000_000, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      ],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = costOf(u as any, 'claude-sonnet-5-5', 1000);
    expect(r.krw).toBe(4000);
    expect(r.tokens.input).toBe(2_000_000);
  });
  it('모르는 모델은 비싼 쪽으로 셈', () => {
    const u = { input_tokens: 1_000_000, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, iterations: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(costOf(u as any, 'some-new-model', 1000).krw).toBe(4000);
  });
});

describe('내 컴퓨터용 파일 저장소', () => {
  it('서버를 다시 켜도(새로 읽어도) 횟수·비용이 남음', async () => {
    const { FileStore } = await import('@/lib/data/file');
    const os = await import('node:os');
    const fsm = await import('node:fs');
    const pathm = await import('node:path');
    const f = pathm.join(fsm.mkdtempSync(pathm.join(os.tmpdir(), 'sokmal-')), 'sub', 'sokmal.json');
    const a = new FileStore(f);
    for (let i = 0; i < 5; i++) expect(await a.reserve('u', 'd', 'exam', 'run', 5)).toBe(true);
    expect(await a.reserve('u', 'd', 'exam', 'run', 5)).toBe(false);
    await a.logCall({ uid: 'u', feature: 'f', model: 'm', status: 'ok', inputTokens: 1, outputTokens: 1, cacheWriteTokens: 0, cacheReadTokens: 0, costKrw: 12.5 });
    const b = new FileStore(f);
    expect((await b.usage('u', 'd')).exam).toEqual({ run: 5, follow: 0, hits: 1 });
    expect(await b.costSince(kstMonthStartIso())).toBe(12.5); // 이번 달(한국 시간) 합계
  });
});
