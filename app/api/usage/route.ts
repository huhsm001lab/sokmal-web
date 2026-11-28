// 오늘 남은 횟수 보기(GET) / 화면에서 미리 막혔을 때 '한도에 걸림' 기록(POST {hit})
import { aiNotReady, config } from '@/lib/config';
import { COUNTER_KEYS, kstDay, LIMITS, type CounterKey } from '@/lib/limits';
import { usingExamplePrompts } from '@/lib/prompts/build';
import { gateOf, getStore, inviteCodeOf, json, userIdOf } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEYS: CounterKey[] = COUNTER_KEYS;

export async function GET(req: Request) {
  const store = getStore();
  const gate = await gateOf(req);
  if (gate) return json({ ready: false, error: gate }, 403);
  if (!store) return json({ ready: false, error: 'not_configured' }, 503);
  const uid = await userIdOf(req);
  if (!uid) return json({ ready: false, error: 'session_expired' }, 401);
  const day = kstDay();
  await store.touch(uid, day, inviteCodeOf(req)).catch((e) => console.error('[sokmal] 방문 기록 실패', e));
  return json({ ready: !aiNotReady(), mock: config.mockAi, examplePrompts: usingExamplePrompts, day, limits: LIMITS.daily, usage: await store.usage(uid, day) });
}

export async function POST(req: Request) {
  const store = getStore();
  const gate = await gateOf(req);
  if (gate) return json({ error: gate }, 403);
  if (!store) return json({ error: 'not_configured' }, 503);
  const uid = await userIdOf(req);
  if (!uid) return json({ error: 'session_expired' }, 401);
  let key: unknown;
  try {
    key = (await req.json())?.hit;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!KEYS.includes(key as CounterKey)) return json({ error: 'bad_request' }, 400);
  const day = kstDay();
  await store.hit(uid, day, key as CounterKey);
  return json({ ok: true, usage: await store.usage(uid, day) });
}
