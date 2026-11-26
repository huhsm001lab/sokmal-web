// 입장 화면(초대 코드) 확인: 코드를 정해 두고 켠 뒤
// 앱이 가려진 입장 화면만 보임 → 틀린 코드 막힘 → 맞는 코드로 입장 → 새로고침해도 다시 안 물음, 서버도 코드 없이는 막음
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 3102;
const BASE = `http://127.0.0.1:${PORT}`;
fs.mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
const env = { ...process.env, MOCK_AI: '1', SOKMAL_DEV_AUTH: '1', SOKMAL_INVITE_CODES: '482913,705162', NEXT_TELEMETRY_DISABLED: '1' };
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { env, stdio: 'ignore', detached: true });
let code = 0;
const b = await chromium.launch();
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + '/')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  const r0 = await fetch(BASE + '/api/ai', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sokmal-dev-uid': 'abcdefgh-0001' }, body: '{"kind":"mono_ask","c":{"kw":{}}}' });
  assert.equal(r0.status, 403, '코드 없이 AI 호출이 막혀야 함');

  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE + '/#analysis');
  await p.locator('#gate').waitFor({ state: 'visible', timeout: 8000 });
  assert.equal(await p.locator('.wrap').isVisible(), false, '입장 전에는 앱이 보이면 안 됨');
  await p.screenshot({ path: 'e2e/out/06-gate.png' });
  await p.fill('#gate-code', '12ab34');
  assert.equal(await p.inputValue('#gate-code'), '1234', '숫자만 들어가야 함');
  await p.click('#gate-go');
  assert.match(await p.textContent('#gate-msg'), /숫자 6자리/);
  await p.fill('#gate-code', '111111');
  await p.click('#gate-go');
  await p.waitForFunction(() => /맞지 않는 코드/.test(document.querySelector('#gate-msg')?.textContent || ''), null, { timeout: 5000 });
  await p.fill('#gate-code', '705162');
  await p.click('#gate-go');
  await p.locator('.wrap').waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(await p.locator('#gate').isVisible(), false);
  assert.equal(new URL(p.url()).hash, '#home', '입장하면 홈으로');
  await p.goto(BASE + '/#analysis');
  await p.fill('#a-text', '1막\n어머니: 가니?\n딸: …응.');
  await p.click('#a-run');
  await p.locator('#a-out .out-acts:not([hidden]) button').first().waitFor({ timeout: 15000 });
  await p.reload();
  await p.waitForTimeout(1500);
  assert.equal(await p.locator('#gate').isVisible(), false, '새로고침 뒤에도 다시 묻지 않아야 함');
  assert.deepEqual(errors, []);
  console.log('입장 화면 확인 통과 (앱 가림·숫자만·틀린 코드·맞는 코드·AI 사용·새로고침·서버 차단)');
} catch (e) {
  console.log('실패:', e.message);
  code = 1;
} finally {
  await b.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
}
process.exit(code);
