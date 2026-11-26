// 초대 코드: 송무가 정한 코드를 넣은 사람만 AI를 쓸 수 있게 한다.
// 코드는 환경변수 SOKMAL_INVITE_CODES 에 쉼표(또는 줄바꿈)로 구분해 적는다. 예) mina-7Q4K,junho-2XW9
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

/** 요청에 맞는 초대 코드가 있는지. 초대 코드를 쓰지 않으면 늘 통과 */
export function inviteOk(req: Request): boolean {
  if (!inviteOn()) return true;
  return inviteValid(req.headers.get('x-sokmal-invite'));
}
