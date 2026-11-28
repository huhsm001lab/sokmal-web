// 내 정보 (11-28): 로그인한 사람의 프로필·승인 상태 / 처음 로그인하면 프로필 저장
// 로그인 방식(Supabase 또는 시험용 가짜)이 꺼져 있으면 { mode: null } — 화면은 예전 초대 코드로 동작
import { accessOf, getStore, json } from '@/lib/server';
import { authMode, cleanProfile, ownerEmails, syncProfileToSupabase, verifyUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const mode = authMode();
  if (!mode) return json({ mode: null });
  const user = await verifyUser(req);
  if (!user) return json({ mode, user: null });
  const store = getStore();
  if (!store) return json({ error: 'not_configured' }, 503);
  const profile = await store.getProfile(user.id);
  const access = profile ? await accessOf(user, store.getAccess.bind(store)) : null;
  return json({ mode, user: { email: user.email }, profile, access });
}

export async function POST(req: Request) {
  const mode = authMode();
  if (!mode) return json({ error: 'bad_request' }, 400);
  const user = await verifyUser(req);
  if (!user) return json({ error: 'login_required' }, 401);
  const store = getStore();
  if (!store) return json({ error: 'not_configured' }, 503);
  let body: { profile?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const prev = await store.getProfile(user.id);
  const p = cleanProfile(body.profile, user.email, prev);
  if ('error' in p) return json({ error: 'bad_profile', field: p.error }, 400);
  await store.putProfile(user.id, p);
  if (!prev && !(await store.getAccess(user.id))) await store.setAccess(user.id, ownerEmails().includes(user.email) ? 'approved' : 'pending');
  await syncProfileToSupabase(user, p);
  return json({ ok: true, profile: p, access: await accessOf(user, store.getAccess.bind(store)) });
}
