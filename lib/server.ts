// 서버 공통: 사용자 확인 + 저장소
import { approvalOn, authOn, ownerEmails, verifyUser, type Access, type AuthUser } from './auth';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, supabaseOn } from './config';
import path from 'node:path';
import crypto from 'node:crypto';
import { FileStore } from './data/file';
import { inviteOk, inviteOn, inviteValid } from './invite';
import { MemoryStore } from './data/memory';
import { redisOn, RedisStore } from './data/redis';
import { SupabaseStore } from './data/supabase';
import type { DataStore } from './data/types';

const g = globalThis as unknown as { __sokmalMem?: MemoryStore; __sokmalFile?: FileStore; __sokmalRedis?: RedisStore; __sokmalSb?: SupabaseClient };

function admin(): SupabaseClient {
  return (g.__sokmalSb ??= createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}

/** 저장소. 설정이 없으면 null (운영에서는 AI를 막음)
    11-27 송무 결정: Supabase 없이 운영 → 초대 코드를 쓰면 서버 메모리에 셈(서버가 새로 뜨면 초기화될 수 있음).
    DB도 초대 코드도 없으면 열지 않음(아무나 우리 키를 쓰지 못하게) */
export function getStore(): DataStore | null {
  if (supabaseOn()) return new SupabaseStore(admin());
  // 11-27: Vercel에서 Upstash Redis를 연결하면 여기 (기록이 남음)
  if (redisOn()) return (g.__sokmalRedis ??= new RedisStore());
  if (config.devAuth && config.localDataFile) return (g.__sokmalFile ??= new FileStore(path.resolve(config.localDataFile)));
  if (config.devAuth || inviteOn() || authOn()) return (g.__sokmalMem ??= new MemoryStore());
  return null;
}

/** 저장소 종류 (관리자 화면에서 '기록이 남는지' 알려 줌) */
export function storeKind(): 'supabase' | 'redis' | 'file' | 'memory' | 'none' {
  if (supabaseOn()) return 'supabase';
  if (redisOn()) return 'redis';
  if (config.devAuth && config.localDataFile) return 'file';
  if (config.devAuth || inviteOn() || authOn()) return 'memory';
  return 'none';
}

/** 요청에 붙은 초대 코드 (맞는 코드일 때만) — 관리자 화면에서 테스터를 코드로 알아보게 */
export function inviteCodeOf(req: Request): string | null {
  const c = (req.headers.get('x-sokmal-invite') || '').trim();
  return inviteOn() && inviteValid(c) ? c : null;
}

/** 초대 코드로 사용자 구분 (코드 자체는 남기지 않고 해시 일부만) */
const inviteUid = (code: string) => 'inv-' + crypto.createHash('sha256').update(code.trim().toLowerCase()).digest('hex').slice(0, 16);

/** 개발용 메모리 저장소 (테스트에서 들여다볼 때) */
export const devMemory = () => g.__sokmalMem ?? null;

/** 요청한 사람의 아이디. 로그인 정보가 없거나 틀리면 null */
export async function userIdOf(req: Request): Promise<string | null> {
  // 11-28 로그인(배우의 저장소와 같은 Supabase, 공개 키로 토큰 확인)
  if (authOn()) return (await verifyUser(req))?.id ?? null;
  if (supabaseOn()) {
    const m = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
    if (!m) return null;
    const { data, error } = await admin().auth.getUser(m[1]);
    if (error || !data.user) return null;
    return data.user.id;
  }
  // DB 없이 초대 코드를 쓰는 운영: 코드 하나 = 사용자 하나
  if (inviteOn()) {
    const code = req.headers.get('x-sokmal-invite') || '';
    return inviteValid(code) ? inviteUid(code) : null;
  }
  if (config.devAuth) {
    const id = req.headers.get('x-sokmal-dev-uid') || '';
    return /^[A-Za-z0-9-]{8,64}$/.test(id) ? 'dev-' + id : null;
  }
  return null;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/** 문지기 (11-28): 로그인 방식이면 로그인·프로필·승인, 아니면 예전 초대 코드. 통과하면 null, 막히면 오류 이름 */
export async function gateOf(req: Request): Promise<'login_required' | 'profile_required' | 'pending' | 'blocked' | 'invite_required' | null> {
  if (!authOn()) return inviteOk(req) ? null : 'invite_required';
  const user = await verifyUser(req);
  if (!user) return 'login_required';
  const store = getStore();
  if (!store) return null; // 저장소가 없으면 각 기능이 not_configured 로 알려 줌
  const prof = await store.getProfile(user.id);
  if (!prof) return 'profile_required';
  const a = await accessOf(user, store.getAccess.bind(store));
  return a === 'approved' ? null : a;
}

/** 승인 상태: 관리자 이메일은 늘 승인, 승인제를 끄면 블록만 아니면 승인 */
export async function accessOf(user: AuthUser, get: (uid: string) => Promise<Access | null>): Promise<Access> {
  if (ownerEmails().includes(user.email)) return 'approved';
  const a = await get(user.id);
  if (a === 'blocked') return 'blocked';
  if (!approvalOn()) return 'approved';
  return a || 'pending';
}
