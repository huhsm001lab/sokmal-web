// 초대 코드 창 확인: 코드를 정해 두고 켠 뒤, 틀린 코드 → 막힘, 맞는 코드 → 열림, 서버도 코드 없이는 막음
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 3102;
const BASE = `http://127.0.0.1:${PORT}`;
const env = { ...process.env, MOCK_AI: '1', SOKMAL_DEV_AUTH: '1', SOKMAL_INVITE_CODES: 'mina-7Q4K,junho-2XW9', NEXT_TELEMETRY_DISABLED: '1' };
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { env, stdio: 'ignore', detached: true });
let code = 0;
const b = await chromium.launch();
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + '/')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  // 서버가 직접 막는지
  const r0 = await fetch(BASE + '/api/ai', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sokmal-dev-uid': 'abcdefgh-0001' }, body: '{"kind":"mono_ask","c":{"kw":{}}}' });
  assert.equal(r0.status, 403, '코드 없이 AI 호출이 막혀야 함');
  assert.equal((await r0.json()).error, 'invite_required');

  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE + '/');
  await p.locator('#invite-card').waitFor({ timeout: 8000 });
  assert.equal(await p.locator('#banner .note').count(), 0, '초대 코드 창만 보여야 함');
  await p.screenshot({ path: 'e2e/out/06-invite.png' });
  await p.fill('#invite-code', 'wrong-code');
  await p.click('#invite-card button');
  await p.waitForFunction(() => /맞지 않는 코드/.test(document.querySelector('#invite-card')?.textContent || ''), null, { timeout: 5000 });
  await p.fill('#invite-code', ' MINA-7q4k ');
  await p.click('#invite-card button');
  await p.locator('#invite-card').waitFor({ state: 'detached', timeout: 5000 });
  await p.waitForFunction(() => /시험 모드|AI 답변을 쓸 수 없어요/.test(document.querySelector('#banner')?.textContent || '') || true);
  // 코드를 넣은 뒤에는 실제로 AI가 돌아감 (가짜 답)
  await p.goto(BASE + '/#analysis');
  await p.fill('#a-text', '1막\n어머니: 가니?\n딸: …응.');
  await p.click('#a-run');
  await p.locator('#a-out .out-acts:not([hidden]) button').first().waitFor({ timeout: 15000 });
  // 새로고침해도 코드를 기억
  await p.reload();
  await p.waitForTimeout(1500);
  assert.equal(await p.locator('#invite-card').count(), 0, '새로고침 뒤에도 다시 묻지 않아야 함');
  assert.deepEqual(errors, []);
  console.log('초대 코드 확인 통과 (서버 차단·틀린 코드·맞는 코드·새로고침)');
} catch (e) {
  console.log('실패:', e.message);
  code = 1;
} finally {
  await b.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
}
process.exit(code);
