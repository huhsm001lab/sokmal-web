// 로그인 (11-28, 송무 결정): 배우의 저장소와 같은 Supabase 프로젝트로 이메일 숫자 코드 로그인.
// - 처음 로그인하면 프로필(이름·하는 일·소속·만 14세 이상·개인정보 동의)을 받고, 관리자가 승인해야 AI를 쓴다.
// - 서버는 Supabase의 공개 키(anon)로 로그인 토큰만 확인한다. 비밀 키(service_role)는 쓰지 않는다.
// - 승인·프로필 사본은 속말 저장소(Upstash Redis)에 둔다. 프로필은 사용자 토큰으로 Supabase profiles 표에도 남긴다(두 서비스가 같이 씀).
// - 시험용 가짜 로그인: SOKMAL_FAKE_AUTH=1 일 때만(배포에서 켜지 말 것). 코드는 12345678.
import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = (k: string) => (process.env[k] || '').trim();

export const authCfg = () => ({
  url: env('NEXT_PUBLIC_SUPABASE_URL') || env('SUPABASE_URL'),
  anon: env('NEXT_PUBLIC_SUPABASE_ANON_KEY') || env('SUPABASE_ANON_KEY'),
});
export const fakeAuthOn = () => env('SOKMAL_FAKE_AUTH') === '1';
/** 로그인 방식이 켜져 있는지 (켜지면 초대 코드 대신 로그인) */
export const authOn = () => fakeAuthOn() || !!(authCfg().url && authCfg().anon);
export const authMode = (): 'supabase' | 'fake' | null => (fakeAuthOn() ? 'fake' : authCfg().url && authCfg().anon ? 'supabase' : null);
/** 승인제: 끄면(SOKMAL_APPROVAL=off) 프로필만 넣으면 바로 사용 */
export const approvalOn = () => env('SOKMAL_APPROVAL').toLowerCase() !== 'off';
/** 처음부터 승인되는 이메일 (송무 등, 쉼표로) */
export const ownerEmails = () =>
  env('SOKMAL_OWNER_EMAILS')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const FAKE_CODE = '12345678';
export const fakeToken = (email: string) => 'fake.' + Buffer.from(email.toLowerCase(), 'utf8').toString('base64url');

export type AuthUser = { id: string; email: string; token: string };

const g = globalThis as unknown as { __sokmalAnon?: SupabaseClient; __sokmalTok?: Map<string, { u: AuthUser | null; at: number }> };
const anonClient = () => (g.__sokmalAnon ??= createClient(authCfg().url, authCfg().anon, { auth: { persistSession: false, autoRefreshToken: false } }));
const cache = () => (g.__sokmalTok ??= new Map());

/** 요청의 로그인 토큰을 확인해 사용자를 돌려준다. 없거나 틀리면 null (60초 동안 기억) */
export async function verifyUser(req: Request): Promise<AuthUser | null> {
  const m = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  if (fakeAuthOn()) {
    if (!token.startsWith('fake.')) return null;
    const email = Buffer.from(token.slice(5), 'base64url').toString('utf8');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return { id: 'fake-' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 24), email, token };
  }
  if (!authOn()) return null;
  const c = cache();
  const hit = c.get(token);
  if (hit && Date.now() - hit.at < 60_000) return hit.u;
  let u: AuthUser | null = null;
  try {
    const { data, error } = await anonClient().auth.getUser(token);
    if (!error && data.user && data.user.email) u = { id: data.user.id, email: data.user.email.toLowerCase(), token };
  } catch {
    u = null;
  }
  c.set(token, { u, at: Date.now() });
  if (c.size > 2000) c.clear();
  return u;
}

/* ---------- 프로필 ---------- */
export const ROLES = ['입시생', '배우', '창작자', '감독·연출', '작가', '기타'] as const;
export type Profile = {
  email: string;
  name: string;
  role: string;
  affiliation: string;
  over14: true;
  consentAt: string;
  createdAt: string;
  updatedAt: string;
};
export type Access = 'approved' | 'pending' | 'blocked';

/** 들어온 프로필 값 검사. 맞지 않으면 무엇이 문제인지 */
export function cleanProfile(v: unknown, email: string, prev: Profile | null, now = new Date()): Profile | { error: string } {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const s = (x: unknown, n: number) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, n) : '');
  const name = s(o.name, 40);
  const role = s(o.role, 20);
  const affiliation = s(o.affiliation, 60);
  if (!name) return { error: 'name' };
  if (!(ROLES as readonly string[]).includes(role)) return { error: 'role' };
  if (o.over14 !== true) return { error: 'over14' };
  if (o.consent !== true) return { error: 'consent' };
  const iso = now.toISOString();
  return { email, name, role, affiliation, over14: true, consentAt: prev?.consentAt || iso, createdAt: prev?.createdAt || iso, updatedAt: iso };
}

/** 사용자 토큰으로 Supabase profiles 표에 남긴다 (두 서비스가 같이 씀). 표가 아직 없으면 조용히 넘어감 */
export async function syncProfileToSupabase(user: AuthUser, p: Profile): Promise<boolean> {
  if (authMode() !== 'supabase') return false;
  try {
    const c = createClient(authCfg().url, authCfg().anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: 'Bearer ' + user.token } },
    });
    const { error } = await c.from('profiles').upsert({ id: user.id, name: p.name, role: p.role, affiliation: p.affiliation, over14: true, consent_at: p.consentAt });
    if (error) console.error('[sokmal] profiles 저장 실패(표를 만들었는지 확인)', error.code, error.message);
    return !error;
  } catch (e) {
    console.error('[sokmal] profiles 저장 실패', e);
    return false;
  }
}
