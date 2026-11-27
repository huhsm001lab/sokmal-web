// 대기 명단 (11-27): 따로 떨어진 소개 페이지(landing/)에서 초대 코드가 없는 사람이 연락처를 남긴다.
// 받는 것: 연락처(이메일 또는 휴대폰 하나), 하는 일, 한 줄(선택), 동의. 이름·나이·주소는 받지 않는다.

export const WAIT_ROLES = ['입시생', '배우', '창작자', '감독·연출', '작가', '기타'] as const;
export const WAIT_MAX = 5000;

export type WaitEntry = {
  contact: string;
  kind: 'email' | 'phone';
  role: string;
  note: string;
  at: string;
};

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,24}$/;

/** 같은 사람인지 가리는 열쇠 (이메일은 소문자, 휴대폰은 숫자만) */
export const waitKey = (e: Pick<WaitEntry, 'contact' | 'kind'>) => (e.kind === 'email' ? e.contact.toLowerCase() : e.contact.replace(/\D/g, ''));

/** 들어온 값을 검사해 정리. 맞지 않으면 null. website 칸(사람에게 안 보임)에 값이 있으면 자동 등록으로 보고 null */
export function cleanWaitlist(v: unknown, now = new Date()): WaitEntry | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.website) return null;
  if (o.consent !== true) return null;
  const raw = typeof o.contact === 'string' ? o.contact.trim() : '';
  let contact = '';
  let kind: WaitEntry['kind'];
  const digits = raw.replace(/[\s-]/g, '');
  if (EMAIL.test(raw) && raw.length <= 254) {
    contact = raw;
    kind = 'email';
  } else if (/^01[016789]\d{7,8}$/.test(digits)) {
    contact = digits.length === 11 ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}` : `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    kind = 'phone';
  } else return null;
  const role = typeof o.role === 'string' && (WAIT_ROLES as readonly string[]).includes(o.role) ? o.role : '기타';
  const note = typeof o.note === 'string' ? o.note.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
  return { contact, kind, role, note, at: now.toISOString() };
}

/* 한 사람(접속 주소)이 짧은 시간에 너무 많이 보내지 못하게 (서버 한 대 안에서만 셈) */
const WINDOW_MS = 10 * 60_000;
const MAX_TRIES = 5;
const tries = new Map<string, { n: number; first: number }>();
export function waitTooMany(key: string, now = Date.now()): boolean {
  let r = tries.get(key);
  if (!r || now - r.first > WINDOW_MS) r = { n: 0, first: now };
  r.n++;
  tries.set(key, r);
  if (tries.size > 5000) tries.clear();
  return r.n > MAX_TRIES;
}
export const resetWaitTries = () => tries.clear();
