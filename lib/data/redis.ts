// Upstash Redis (Vercel의 Storage/Marketplace에서 연결). 연결하면 Vercel이 값을 넣어 준다:
// KV_REST_API_URL / KV_REST_API_TOKEN 또는 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (둘 다 읽음)
import { Redis } from '@upstash/redis';
import type { Kv } from './kv';
import { KvStore } from './kvstore';

const env = (k: string) => (process.env[k] ?? '').trim();
export const redisOn = () => !!((env('KV_REST_API_URL') && env('KV_REST_API_TOKEN')) || (env('UPSTASH_REDIS_REST_URL') && env('UPSTASH_REDIS_REST_TOKEN')));

/** 값을 자동으로 풀지 않는 Upstash 클라이언트(문자열 그대로)를 Kv 모양으로.
    자동 풀기를 끄면 HGETALL 이 [필드, 값, 필드, 값 …] 목록으로 오므로 객체로 바꿔 준다(11-27 배포에서 발견) */
export function redisKv(r: Pick<Redis, keyof Kv>): Kv {
  const call = r as unknown as Record<keyof Kv, (...a: unknown[]) => Promise<unknown>>;
  return {
    hincrby: (k, f, by) => call.hincrby(k, f, by).then(Number),
    hincrbyfloat: (k, f, by) => call.hincrbyfloat(k, f, by).then(Number),
    hgetall: async (k) => {
      const v = await call.hgetall(k);
      if (v == null) return null;
      if (Array.isArray(v)) {
        if (!v.length) return null;
        const o: Record<string, unknown> = {};
        for (let i = 0; i + 1 < v.length; i += 2) o[String(v[i])] = v[i + 1];
        return o;
      }
      return v as Record<string, unknown>;
    },
    hset: (k, kv) => call.hset(k, kv),
    hsetnx: (k, f, v) => call.hsetnx(k, f, v),
    hdel: (k, f) => call.hdel(k, f),
    sadd: (k, m) => call.sadd(k, m),
    smembers: (k) => call.smembers(k).then((v) => (Array.isArray(v) ? v.map(String) : [])),
    lpush: (k, v) => call.lpush(k, v),
    ltrim: (k, s, e) => call.ltrim(k, s, e),
    lrange: (k, s, e) => call.lrange(k, s, e).then((v) => (Array.isArray(v) ? v : [])),
    incrbyfloat: (k, by) => call.incrbyfloat(k, by).then(Number),
    get: (k) => call.get(k),
    set: (k, v) => call.set(k, v),
  };
}

export class RedisStore extends KvStore {
  constructor() {
    super(redisKv(Redis.fromEnv({ automaticDeserialization: false })));
  }
}
