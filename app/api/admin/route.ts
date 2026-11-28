// 관리자 데이터 (관리자 코드 필요): 테스터별 사용, AI 호출·비용, 의견·후기 / 이름 메모·랜딩 후기 표시
import { adminCheck } from '@/lib/admin';
import { pricesKnown } from '@/lib/ai';
import { aiNotReady, config, hideKeys } from '@/lib/config';
import { kstMonthStartIso } from '@/lib/limits';
import { cleanSwitches } from '@/lib/prompts/switches';
import { cleanGuide } from '@/lib/guide';
import { cleanNote, NOTE_MAX } from '@/lib/notes';
import { approvalOn, authMode, ownerEmails } from '@/lib/auth';
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
    notes: await s.notes(),
    // 관리자 이메일은 늘 승인으로 보이게 (실제 판단과 같게)
    members: (await s.members()).map((m) => (ownerEmails().includes(m.profile.email.toLowerCase()) ? { ...m, access: 'approved' as const, owner: true } : m)),
    login: { mode: authMode(), approval: approvalOn(), owners: ownerEmails().length },
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
  let b: { name?: { uid?: unknown; name?: unknown }; approve?: { uid?: unknown; v?: unknown }; switches?: unknown; guide?: unknown; access?: { uid?: unknown; v?: unknown }; note?: unknown; noteDelete?: unknown; waitDelete?: { contact?: unknown; kind?: unknown } };
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
  if (b.access && typeof b.access.uid === 'string' && /^[A-Za-z0-9-]{4,80}$/.test(b.access.uid) && (b.access.v === 'approved' || b.access.v === 'pending' || b.access.v === 'blocked')) {
    await s.setAccess(b.access.uid, b.access.v);
    return json({ ok: true });
  }
  if (b.note && typeof b.note === 'object') {
    const n = cleanNote(b.note);
    if (!n) return json({ error: 'bad_request' }, 400);
    if ((await s.notes()).length >= NOTE_MAX && !(await s.notes()).some((x) => x.id === n.id)) return json({ error: 'full' }, 400);
    await s.putNote(n);
    return json({ ok: true, note: n });
  }
  if (typeof b.noteDelete === 'string' && /^[a-z0-9-]{6,40}$/.test(b.noteDelete)) {
    await s.removeNote(b.noteDelete);
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
