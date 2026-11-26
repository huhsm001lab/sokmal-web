'use client';
// 사용자 구분 (PRD 11-2 1단계): 처음 열면 익명 로그인, 원하면 이메일(매직 링크)을 연결.
// 화면 코드(public/legacy/app.js)는 번들 없이 도는 일반 스크립트라서, 여기서 window.SokmalAuth로 연결해 준다.
// Supabase 설정이 없으면 개발 모드: 기기 아이디(localStorage)로 구분 (서버에 SOKMAL_DEV_AUTH=1일 때만 받아 줌)
import { useEffect } from 'react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

type State = { mode: 'supabase' | 'dev'; anonymous: boolean; email: string | null; error: string | null };
export type SokmalAuth = {
  ready: Promise<void>;
  state(): State;
  headers(): Promise<Record<string, string>>;
  linkEmail(email: string): Promise<{ ok: boolean; msg: string }>;
  signOut(): Promise<void>;
  onChange(cb: () => void): void;
};
declare global {
  interface Window {
    SokmalAuth?: SokmalAuth;
  }
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function devAuth(): SokmalAuth {
  let id = '';
  try {
    id = localStorage.getItem('sokmal.devuid') || '';
    if (!id) localStorage.setItem('sokmal.devuid', (id = crypto.randomUUID()));
  } catch {
    id = crypto.randomUUID();
  }
  return {
    ready: Promise.resolve(),
    state: () => ({ mode: 'dev', anonymous: true, email: null, error: null }),
    headers: async () => ({ 'x-sokmal-dev-uid': id }),
    linkEmail: async () => ({ ok: false, msg: '개발 모드에서는 이메일 연결을 쓰지 않아요.' }),
    signOut: async () => {},
    onChange: () => {},
  };
}

function supabaseAuth(): SokmalAuth {
  const sb: SupabaseClient = createClient(URL_, ANON, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  let session: Session | null = null;
  let error: string | null = null;
  const subs: (() => void)[] = [];

  const ensure = async () => {
    const { data } = await sb.auth.getSession();
    session = data.session;
    if (!session) {
      const r = await sb.auth.signInAnonymously();
      if (r.error) error = r.error.message;
      session = r.data.session;
    }
  };
  const ready = ensure().catch((e) => {
    error = String(e?.message || e);
  });
  sb.auth.onAuthStateChange((_ev, s) => {
    session = s;
    subs.forEach((f) => f());
  });

  return {
    ready,
    state: () => ({
      mode: 'supabase',
      anonymous: !!session?.user?.is_anonymous,
      email: session?.user?.email ?? null,
      error,
    }),
    headers: async (): Promise<Record<string, string>> => {
      await ready;
      const { data } = await sb.auth.getSession(); // 만료가 가까우면 새 토큰으로 바꿔 줌
      session = data.session;
      if (!session) await ensure();
      return session ? { authorization: 'Bearer ' + session.access_token } : {};
    },
    linkEmail: async (email: string) => {
      await ready;
      const redirect = window.location.origin + '/';
      if (session?.user?.is_anonymous) {
        // 지금 익명 계정에 이메일을 붙인다 → 확인 메일의 링크를 누르면 연결 완료
        const r = await sb.auth.updateUser({ email }, { emailRedirectTo: redirect });
        if (!r.error) return { ok: true, msg: '확인 메일을 보냈어요. 메일의 링크를 누르면 연결돼요.' };
        if (r.error.code !== 'email_exists') return { ok: false, msg: '메일을 보내지 못했어요. 잠시 뒤에 다시 눌러 주세요.' };
      }
      // 이미 쓰던 이메일이면 로그인 링크를 보낸다
      const r2 = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: false } });
      return r2.error
        ? { ok: false, msg: '메일을 보내지 못했어요. 잠시 뒤에 다시 눌러 주세요.' }
        : { ok: true, msg: '이미 쓰던 이메일이에요. 로그인 링크를 보냈어요.' };
    },
    signOut: async () => {
      await sb.auth.signOut();
      session = null;
      await ensure();
    },
    onChange: (cb) => {
      subs.push(cb);
    },
  };
}

export default function AuthBridge() {
  useEffect(() => {
    if (window.SokmalAuth) return;
    window.SokmalAuth = URL_ && ANON ? supabaseAuth() : devAuth();
  }, []);
  return null;
}
