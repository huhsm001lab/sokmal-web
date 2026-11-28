// 의견·후기 (테스터 본인 문서만). 화면은 그대로이고, 브라우저 저장에 더해 서버에도 남겨 관리자가 볼 수 있게
import { cleanFeedback } from '@/lib/feedback';
import { gateOf, getStore, json, userIdOf } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function who(req: Request) {
  const gate = await gateOf(req);
  if (gate) return { error: json({ error: gate }, 403) };
  const store = getStore();
  if (!store) return { error: json({ error: 'not_configured' }, 503) };
  const uid = await userIdOf(req);
  if (!uid) return { error: json({ error: 'session_expired' }, 401) };
  return { store, uid };
}

export async function GET(req: Request) {
  const w = await who(req);
  if ('error' in w) return w.error;
  return json({ doc: await w.store.getFeedback(w.uid) });
}

export async function PUT(req: Request) {
  const w = await who(req);
  if ('error' in w) return w.error;
  const raw = await req.text();
  if (raw.length > 300_000) return json({ error: 'too_large' }, 413);
  let doc;
  try {
    doc = cleanFeedback(JSON.parse(raw));
  } catch {
    doc = null;
  }
  if (!doc) return json({ error: 'bad_request' }, 400);
  await w.store.putFeedback(w.uid, doc);
  return json({ ok: true });
}
