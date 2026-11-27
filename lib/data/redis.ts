// Upstash Redis (Vercel의 Storage/Marketplace에서 연결). 연결하면 Vercel이 값을 넣어 준다:
// KV_REST_API_URL / KV_REST_API_TOKEN 또는 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (둘 다 읽음)
import { Redis } from '@upstash/redis';
import type { Kv } from './kv';
import { KvStore } from './kvstore';

const env = (k: string) => (process.env[k] ?? '').trim();
export const redisOn = () => !!((env('KV_REST_API_URL') && env('KV_REST_API_TOKEN')) || (env('UPSTASH_REDIS_REST_URL') && env('UPSTASH_REDIS_REST_TOKEN')));

export class RedisStore extends KvStore {
  constructor() {
    // 값을 자동으로 풀지 않게(문자열 그대로) — 메모리·파일 저장소와 같은 모양
    super(Redis.fromEnv({ automaticDeserialization: false }) as unknown as Kv);
  }
}
