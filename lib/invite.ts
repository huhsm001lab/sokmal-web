// 초대 코드: 송무가 정한 코드를 넣은 사람만 앱에 들어오고 AI를 쓸 수 있게 한다.
// 코드는 환경변수 SOKMAL_INVITE_CODES 에 쉼표(또는 줄바꿈)로 구분해 적는다. 예) 482913,705162
// 비어 있으면 초대 코드 없이 열린다(내 컴퓨터 시험용).
import crypto from 'node:crypto';

export function inviteCodes(): string[] {
  return (process.env.SOKMAL_INVITE_CODES ?? '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const inviteOn = () => inviteCodes().length > 0;

const hash = (s: string) => crypto.createHash('sha256').update(s).digest();

/** 코드가 맞는지 (대소문자·앞뒤 공백 무시, 비교 시간 일정) */
export function inviteValid(code: string | null | undefined): boolean {
  const c = (code ?? '').trim().toLowerCase();
  if (!c || c.length > 100) return false;
  const h = hash(c);
  let ok = false;
  for (const k of inviteCodes()) if (crypto.timingSafeEqual(h, hash(k.toLowerCase()))) ok = true;
  return ok;
}

/* ---------- 계속 틀리면 잠시 막기 ----------
   숫자 6자리는 경우의 수가 적어서, 아무 숫자나 대입해 보는 걸 늦춘다.
   같은 접속 주소에서 10분 안에 10번 틀리면 15분 동안 막는다.
   서버 한 대(인스턴스) 안에서 세는 것이라 완벽한 차단은 아니다. 돈이 새는 마지막 천장은 월 예산 상한이다. */
const WINDOW_MS = 10 * 60_000;
const MAX_FAILS = 10;
const LOCK_MS = 15 * 60_000;
const fails = new Map<string, { n: number; first: number; until: number }>();

export function clientKey(req: Request): string {
  return (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'local').split(',')[0].trim();
}
export function inviteBlocked(req: Request, now = Date.now()): boolean {
  const r = fails.get(clientKey(req));
  return !!r && r.until > now;
}
export function noteInviteFail(req: Request, now = Date.now()) {
  const k = clientKey(req);
  let r = fails.get(k);
  if (!r || now - r.first > WINDOW_MS) r = { n: 0, first: now, until: 0 };
  r.n++;
  if (r.n >= MAX_FAILS) r.until = now + LOCK_MS;
  fails.set(k, r);
  if (fails.size > 5000) fails.clear(); // 메모리가 끝없이 늘지 않게
}
export const resetInviteFails = () => fails.clear();

/** 요청에 맞는 초대 코드가 있는지. 초대 코드를 쓰지 않으면 늘 통과. 틀린 코드를 붙인 요청은 틀린 횟수로 센다 */
export function inviteOk(req: Request): boolean {
  if (!inviteOn()) return true;
  const code = req.headers.get('x-sokmal-invite');
  if (!code) return false;
  if (inviteBlocked(req)) return false;
  if (inviteValid(code)) return true;
  noteInviteFail(req);
  return false;
}
