// 초대 코드 확인 (첫 화면의 초대 코드 창에서 부름)
import { inviteOn, inviteValid } from '@/lib/invite';
import { json } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return json({ required: inviteOn() });
}

export async function POST(req: Request) {
  if (!inviteOn()) return json({ ok: true, required: false });
  let code: unknown;
  try {
    code = (await req.json())?.code;
  } catch {
    return json({ ok: false }, 400);
  }
  if (typeof code === 'string' && inviteValid(code)) return json({ ok: true });
  // 아무 코드나 빠르게 대입해 보는 걸 늦추려고 조금 기다렸다 답함
  await new Promise((r) => setTimeout(r, 800));
  return json({ ok: false }, 403);
}
