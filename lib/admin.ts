// 관리자 코드: 환경변수 SOKMAL_ADMIN_CODE (초대 코드와 별개). 틀리면 초대 코드와 같은 차단 규칙
import crypto from 'node:crypto';
import { inviteBlocked, noteInviteFail } from './invite';

export const adminCode = () => (process.env.SOKMAL_ADMIN_CODE ?? '').trim();
const hash = (s: string) => crypto.createHash('sha256').update(s).digest();

/** 'ok' | 'off'(관리자 코드를 정하지 않음) | 'blocked' | 'wrong' */
export function adminCheck(req: Request): 'ok' | 'off' | 'blocked' | 'wrong' {
  const real = adminCode();
  if (!real) return 'off';
  if (inviteBlocked(req)) return 'blocked';
  const given = (req.headers.get('x-sokmal-admin') || '').trim();
  if (given && crypto.timingSafeEqual(hash(given), hash(real))) return 'ok';
  noteInviteFail(req);
  return 'wrong';
}
