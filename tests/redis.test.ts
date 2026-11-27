// Upstash 클라이언트가 자동 풀기를 끄면 돌려주는 모양(HGETALL = 평평한 목록, 숫자 = 문자열)을 흉내 내서 확인
import { describe, expect, it } from 'vitest';
import { MemKv } from '@/lib/data/kv';
import { KvStore } from '@/lib/data/kvstore';
import { redisKv } from '@/lib/data/redis';

/** 메모리 키-값을 Upstash 원시 응답 모양으로 바꿔 내놓는 가짜 */
function rawUpstash() {
  const m = new MemKv();
  return {
    hincrby: async (k: string, f: string, by: number) => m.hincrby(k, f, by),
    hincrbyfloat: async (k: string, f: string, by: number) => String(await m.hincrbyfloat(k, f, by)),
    hgetall: async (k: string) => Object.entries((await m.hgetall(k)) ?? {}).flat(),
    hset: (k: string, kv: Record<string, string | number>) => m.hset(k, kv),
    hsetnx: (k: string, f: string, v: string) => m.hsetnx(k, f, v),
    hdel: (k: string, f: string) => m.hdel(k, f),
    sadd: (k: string, v: string) => m.sadd(k, v),
    smembers: (k: string) => m.smembers(k),
    lpush: (k: string, v: string) => m.lpush(k, v),
    ltrim: (k: string, s: number, e: number) => m.ltrim(k, s, e),
    lrange: (k: string, s: number, e: number) => m.lrange(k, s, e),
    incrbyfloat: async (k: string, by: number) => String(await m.incrbyfloat(k, by)),
    get: (k: string) => m.get(k),
    set: (k: string, v: string) => m.set(k, v),
  };
}

describe('Upstash 원시 응답 모양', () => {
  it('HGETALL 평평한 목록을 객체로 바꿔 테스터 정보·하루 횟수가 제대로 읽힘', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = new KvStore(redisKv(rawUpstash() as any));
    await s.touch('inv-x', '2026-11-27', '289548');
    await s.reserve('inv-x', '2026-11-27', 'exam', 'run', 5);
    await s.logCall({ uid: 'inv-x', feature: 'f', model: 'm', status: 'ok', inputTokens: 1, outputTokens: 1, cacheWriteTokens: 0, cacheReadTokens: 0, costKrw: 3 });
    expect((await s.usage('inv-x', '2026-11-27')).exam.run).toBe(1);
    const t = (await s.adminSnapshot())!.testers[0];
    expect(t).toMatchObject({ code: '289548', first: '2026-11-27', last: '2026-11-27', days: 1, calls: 1, costKrw: 3 });
    expect(t.totals.exam.run).toBe(1);
  });
});
