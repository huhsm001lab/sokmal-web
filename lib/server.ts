// 서버 공통: 사용자 확인 + 저장소
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, supabaseOn } from './config';
import path from 'node:path';
import crypto from 'node:crypto';
import { FileStore } from './data/file';
import { inviteOn, inviteValid } from './invite';
import { MemoryStore } from './data/memory';
import { SupabaseStore } from './data/supabase';
import type { DataStore } from './data/types';

const g = globalThis as unknown as { __sokmalMem?: MemoryStore; __sokmalFile?: FileStore; __sokmalSb?: SupabaseClient };

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
  if (config.devAuth && config.localDataFile) return (g.__sokmalFile ??= new FileStore(path.resolve(config.localDataFile)));
  if (config.devAuth || inviteOn()) return (g.__sokmalMem ??= new MemoryStore());
  return null;
}

/** 초대 코드로 사용자 구분 (코드 자체는 남기지 않고 해시 일부만) */
const inviteUid = (code: string) => 'inv-' + crypto.createHash('sha256').update(code.trim().toLowerCase()).digest('hex').slice(0, 16);

/** 개발용 메모리 저장소 (테스트에서 들여다볼 때) */
export const devMemory = () => g.__sokmalMem ?? null;

/** 요청한 사람의 아이디. 로그인 정보가 없거나 틀리면 null */
export async function userIdOf(req: Request): Promise<string | null> {
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
