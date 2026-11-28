// 관리자 데이터 (관리자 코드 필요): 테스터별 사용, AI 호출·비용, 의견·후기 / 이름 메모·랜딩 후기 표시
import { adminCheck } from '@/lib/admin';
import { pricesKnown } from '@/lib/ai';
import { aiNotReady, config, hideKeys } from '@/lib/config';
import { kstMonthStartIso } from '@/lib/limits';
import { cleanSwitches } from '@/lib/prompts/switches';
import { cleanGuide } from '@/lib/guide';
import { getStore, json, storeKind } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gate(req: Request) {
  const c = adminCheck(req);
  if (c === 'off') return json({ error: 'admin_not_configured' }, 503);
  if (c === 'blocked') return json({ error: 'too_many' }, 429);
  if (c === 'wrong') return json({ error: 'wrong' }, 403);
  const store = getStore();
  if (!store) return json({ error: 'not_configured' }, 503);
  return store;
}

export async function GET(req: Request) {
  const s = gate(req);
  if (s instanceof Response) {
    if (s.status === 403) await new Promise((r) => setTimeout(r, 800));
    return s;
  }
  const snap = await s.adminSnapshot(1000);
  if (!snap) return json({ error: 'unsupported' }, 501);
  // 예전 기록에 키가 남아 있어도 화면에는 가려서 보냄
  snap.calls = snap.calls.map((c) => ({ ...c, model: hideKeys(c.model), ...(c.detail ? { detail: hideKeys(c.detail) } : {}) }));
  return json({
    ...snap,
    monthCostKrw: await s.costSince(kstMonthStartIso()),
    switches: await s.getSwitches(),
    waitlist: await s.waitlist(),
    guide: await s.getGuide(),
    reviews: await s.reviews(50),
    meta: {
      storage: storeKind(),
      persistent: ['redis', 'supabase', 'file'].includes(storeKind()),
      provider: config.provider,
      mock: config.mockAi,
      // AI가 꺼져 있으면 이유(값은 넣지 않고 어느 칸이 문제인지만)
      notReady: aiNotReady(),
      pricesKnown: pricesKnown(),
      monthlyBudgetKrw: config.monthlyBudgetKrw || null,
    },
  });
}

export async function POST(req: Request) {
  const s = gate(req);
  if (s instanceof Response) return s;
  let b: { name?: { uid?: unknown; name?: unknown }; approve?: { uid?: unknown; v?: unknown }; switches?: unknown; guide?: unknown; waitDelete?: { contact?: unknown; kind?: unknown } };
  try {
    b = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const okUid = (u: unknown): u is string => typeof u === 'string' && /^[A-Za-z0-9-]{4,80}$/.test(u);
  if (b.name && okUid(b.name.uid) && typeof b.name.name === 'string') {
    await s.setName(b.name.uid, b.name.name.trim().slice(0, 40));
    return json({ ok: true });
  }
  if (b.waitDelete && typeof b.waitDelete.contact === 'string' && (b.waitDelete.kind === 'email' || b.waitDelete.kind === 'phone')) {
    await s.removeWaitlist({ contact: b.waitDelete.contact, kind: b.waitDelete.kind });
    return json({ ok: true });
  }
  if (b.guide && typeof b.guide === 'object') {
    const g = cleanGuide({ ...(b.guide as object), updatedAt: new Date().toISOString() });
    await s.setGuide(g);
    return json({ ok: true, guide: g });
  }
  if (b.switches && typeof b.switches === 'object') {
    const next = cleanSwitches({ ...(await s.getSwitches()), ...(b.switches as object) });
    await s.setSwitches(next);
    return json({ ok: true, switches: next });
  }
  if (b.approve && okUid(b.approve.uid)) {
    await s.setApproved(b.approve.uid, b.approve.v === true);
    return json({ ok: true });
  }
  return json({ error: 'bad_request' }, 400);
}
