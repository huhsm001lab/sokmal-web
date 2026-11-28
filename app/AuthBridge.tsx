'use client';
// 로그인 연결 (11-28): 배우의 저장소와 같은 Supabase로 이메일 숫자 코드 로그인.
// 화면 코드(public/legacy/app.js)는 번들 없이 도는 일반 스크립트라서, 여기서 window.SokmalAuth로 연결해 준다.
// 설정은 서버가 window.SOKMAL_CFG 로 넣어 준다(app/page.tsx). 로그인 방식이 꺼져 있으면 개발 모드(기기 아이디).
// 시험용 가짜 로그인(auth:'fake')은 코드 12345678 — 서버에서 SOKMAL_FAKE_AUTH=1 일 때만 켜짐.
import { useEffect } from 'react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

type Mode = 'supabase' | 'fake' | 'dev';
type State = { mode: Mode; signedIn: boolean; email: string | null; error: string | null };
type Res = { ok: boolean; msg: string };
export type SokmalAuth = {
  ready: Promise<void>;
  state(): State;
  headers(): Promise<Record<string, string>>;
  sendCode(email: string): Promise<Res>;
  verifyCode(email: string, code: string): Promise<Res>;
  signOut(): Promise<void>;
  onChange(cb: () => void): void;
  /** 내 기록을 계정에 저장할 때 쓰는 Supabase 연결 (로그인 상태에서만) */
  client(): SupabaseClient | null;
};
type Cfg = { auth: 'supabase' | 'fake' | null; url?: string; anon?: string };
declare global {
  interface Window {
    SokmalAuth?: SokmalAuth;
    SOKMAL_CFG?: Cfg;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

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
    state: () => ({ mode: 'dev', signedIn: false, email: null, error: null }),
    headers: async () => ({ 'x-sokmal-dev-uid': id }),
    sendCode: async () => ({ ok: false, msg: '이 화면에서는 로그인을 쓰지 않아요.' }),
    verifyCode: async () => ({ ok: false, msg: '이 화면에서는 로그인을 쓰지 않아요.' }),
    signOut: async () => {},
    onChange: () => {},
    client: () => null,
  };
}

/** 시험용: 실제 메일 없이 코드 12345678로 로그인 */
function fakeAuth(): SokmalAuth {
  const KEY = 'sokmal.fakeauth';
  let email: string | null = null;
  try {
    email = localStorage.getItem(KEY);
  } catch {}
  const subs: (() => void)[] = [];
  const emit = () => subs.forEach((f) => f());
  return {
    ready: Promise.resolve(),
    state: () => ({ mode: 'fake', signedIn: !!email, email, error: null }),
    headers: async (): Promise<Record<string, string>> => (email ? { authorization: 'Bearer fake.' + b64url(email.toLowerCase()) } : {}),
    sendCode: async (e) => (EMAIL.test(e) ? { ok: true, msg: '시험 모드: 코드는 12345678이에요.' } : { ok: false, msg: '이메일 주소를 확인해 주세요.' }),
    verifyCode: async (e, code) => {
      if (code.replace(/\D/g, '') !== '12345678') return { ok: false, msg: '코드가 맞지 않아요. 메일의 숫자를 다시 확인해 주세요.' };
      email = e.trim().toLowerCase();
      try {
        localStorage.setItem(KEY, email);
      } catch {}
      emit();
      return { ok: true, msg: '' };
    },
    signOut: async () => {
      email = null;
      try {
        localStorage.removeItem(KEY);
      } catch {}
      emit();
    },
    onChange: (cb) => {
      subs.push(cb);
    },
    client: () => null,
  };
}

function supabaseAuth(url: string, anon: string): SokmalAuth {
  const sb: SupabaseClient = createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'sokmal-auth' } });
  let session: Session | null = null;
  let error: string | null = null;
  const subs: (() => void)[] = [];
  const ready = sb.auth
    .getSession()
    .then(({ data }) => {
      session = data.session;
    })
    .catch((e) => {
      error = String(e?.message || e);
    });
  sb.auth.onAuthStateChange((_ev, s) => {
    session = s;
    subs.forEach((f) => f());
  });
  const friendly = (m: string) =>
    /rate|seconds|too many/i.test(m)
      ? '잠시 뒤에 다시 시도해 주세요. 메일은 짧은 시간에 여러 번 보낼 수 없어요.'
      : /expired|invalid|token/i.test(m)
        ? '코드가 맞지 않거나 시간이 지났어요. 새 코드를 받아 주세요.'
        : '잠시 뒤에 다시 시도해 주세요.';

  return {
    ready,
    state: () => ({ mode: 'supabase', signedIn: !!session?.user && !session.user.is_anonymous, email: session?.user?.email ?? null, error }),
    headers: async (): Promise<Record<string, string>> => {
      await ready;
      const { data } = await sb.auth.getSession(); // 만료가 가까우면 새 토큰으로 바꿔 줌
      session = data.session;
      return session ? { authorization: 'Bearer ' + session.access_token } : {};
    },
    sendCode: async (email) => {
      if (!EMAIL.test(email)) return { ok: false, msg: '이메일 주소를 확인해 주세요.' };
      const r = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
      return r.error ? { ok: false, msg: friendly(r.error.message) } : { ok: true, msg: '메일로 숫자 코드를 보냈어요. 메일함(스팸함도)을 확인해 주세요.' };
    },
    verifyCode: async (email, code) => {
      const r = await sb.auth.verifyOtp({ email: email.trim(), token: code.replace(/\D/g, ''), type: 'email' });
      if (r.error) return { ok: false, msg: friendly(r.error.message) };
      session = r.data.session;
      return { ok: true, msg: '' };
    },
    signOut: async () => {
      await sb.auth.signOut();
      session = null;
    },
    onChange: (cb) => {
      subs.push(cb);
    },
    client: () => (session ? sb : null),
  };
}

export default function AuthBridge() {
  useEffect(() => {
    if (window.SokmalAuth) return;
    const c = window.SOKMAL_CFG;
    window.SokmalAuth = c?.auth === 'supabase' && c.url && c.anon ? supabaseAuth(c.url, c.anon) : c?.auth === 'fake' ? fakeAuth() : devAuth();
  }, []);
  return null;
}
