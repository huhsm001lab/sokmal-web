// 대기 명단 받기 (11-27). 따로 떨어진 소개 페이지(landing/, 다른 주소)에서 보내므로 다른 주소의 요청을 받는다.
// 받는 주소를 좁히려면 SOKMAL_LANDING_ORIGINS 에 쉼표로 적는다(예: https://sokmal.vercel.app). 비어 있으면 어디서든 받음(쿠키·인증 없음).
import { clientKey } from '@/lib/invite';
import { getStore } from '@/lib/server';
import { cleanWaitlist, waitTooMany } from '@/lib/waitlist';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cors(req: Request): Record<string, string> {
  const allowed = (process.env.SOKMAL_LANDING_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') || '';
  const allow = !allowed.length ? '*' : allowed.includes(origin) ? origin : allowed[0];
  return { 'access-control-allow-origin': allow, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'origin' };
}
const reply = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors(req) } });

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(req) });
}

export async function POST(req: Request) {
  if (waitTooMany(clientKey(req))) return reply(req, { error: 'too_many' }, 429);
  const raw = await req.text();
  if (raw.length > 4000) return reply(req, { error: 'too_large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(req, { error: 'bad_request' }, 400);
  }
  const e = cleanWaitlist(body);
  if (!e) return reply(req, { error: 'bad_request' }, 400);
  const store = getStore();
  if (!store) return reply(req, { error: 'not_configured' }, 503);
  const r = await store.addWaitlist(e);
  if (r === 'full') return reply(req, { error: 'full' }, 503);
  // 이미 있던 연락처인지는 알려 주지 않음 (다른 사람의 등록 여부를 떠볼 수 없게)
  return reply(req, { ok: true });
}
