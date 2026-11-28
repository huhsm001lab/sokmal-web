// 로그인 확인 (11-28, 시험용 가짜 로그인 SOKMAL_FAKE_AUTH=1, 코드 12345678):
// 이메일 → 코드 → 프로필·동의 → 승인 대기(AI 막힘) → 관리자 승인 → 앱 / 새로고침 뒤에도 로그인 / 관리자 이메일은 바로 / 로그아웃
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 3105;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = new URL('./out/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const ADMIN = 'Admin-Test-Code-99';
const env = { ...process.env, MOCK_AI: '1', SOKMAL_FAKE_AUTH: '1', SOKMAL_ADMIN_CODE: ADMIN, SOKMAL_OWNER_EMAILS: 'owner@test.kr', NEXT_TELEMETRY_DISABLED: '1' };
for (const k of ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'SOKMAL_LOCAL_DATA', 'SOKMAL_DEV_AUTH', 'SOKMAL_INVITE_CODES', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SOKMAL_APPROVAL']) delete env[k];
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { env, stdio: 'ignore', detached: true });
const tok = (email) => 'Bearer fake.' + Buffer.from(email).toString('base64url');
let code = 0;
const b = await chromium.launch();
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + '/')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  const errors = [];
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE + '/');
  await p.locator('#gate-email').waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await p.locator('.wrap').isVisible(), false, '로그인 전에는 앱이 보이지 않아야 함');
  assert.equal(await p.locator('#gate-form').isVisible(), false, '로그인 방식에서는 초대 코드 칸이 없어야 함');
  assert.equal((await fetch(BASE + '/api/usage')).status, 403, '로그인 없이 막혀야 함');

  // 이메일 → 코드
  await p.fill('#gate-email-in', 'tester@test.kr');
  await p.click('#gate-email-go');
  await p.locator('#gate-otp').waitFor({ state: 'visible' });
  await p.fill('#gate-otp-in', '11112222');
  await p.click('#gate-otp-go');
  await p.waitForFunction(() => /맞지 않/.test(document.querySelector('#gate-otp-msg').textContent));
  await p.fill('#gate-otp-in', '12345678');
  await p.click('#gate-otp-go');

  // 프로필
  await p.locator('#gate-profile').waitFor({ state: 'visible', timeout: 10000 });
  await p.fill('#gp-name', '김배우');
  await p.click('#gp-go');
  await p.waitForFunction(() => /하는 일/.test(document.querySelector('#gp-msg').textContent));
  await p.locator('#gp-role .chip', { hasText: '입시생' }).click();
  await p.fill('#gp-aff', '한예종 입시반');
  await p.check('#gp-14');
  await p.click('#gp-go');
  await p.waitForFunction(() => /동의/.test(document.querySelector('#gp-msg').textContent));
  await p.check('#gp-consent');
  await p.screenshot({ path: OUT + '09-login-profile.png', fullPage: true });
  await p.click('#gp-go');

  // 승인 대기: AI 막힘
  await p.locator('#gate-pending').waitFor({ state: 'visible', timeout: 10000 });
  assert.match(await p.locator('#gate-pending-who').textContent(), /김배우 · tester@test.kr/);
  const r1 = await fetch(BASE + '/api/usage', { headers: { authorization: tok('tester@test.kr') } });
  assert.equal(r1.status, 403);
  assert.equal((await r1.json()).error, 'pending');

  // 관리자 승인
  const a = await b.newPage({ viewport: { width: 1280, height: 900 } });
  a.on('pageerror', (e) => errors.push('admin: ' + e));
  await a.goto(BASE + '/admin');
  await a.fill('#adm-code', ADMIN);
  await a.click('#adm-go');
  await a.locator('#adm-nav [data-k="people"] .nav-badge', { hasText: '1' }).waitFor({ timeout: 8000 });
  await a.click('#adm-nav [data-k="people"]');
  await a.locator('h3', { hasText: '가입·승인 — 대기 1명' }).waitFor({ timeout: 8000 });
  const row = a.locator('tr', { hasText: 'tester@test.kr' });
  assert.match(await row.textContent(), /김배우[\s\S]*입시생[\s\S]*한예종 입시반[\s\S]*대기/);
  await row.locator('button', { hasText: '승인' }).first().click();
  await a.locator('tr', { hasText: 'tester@test.kr' }).locator('.tag.ok', { hasText: '승인됨' }).waitFor({ timeout: 5000 });

  // 테스터: 다시 확인 → 앱
  await p.click('#gate-pending-check');
  await p.locator('.wrap').waitFor({ state: 'visible', timeout: 10000 });
  await p.locator('#hub-acct', { hasText: '김배우' }).waitFor({ timeout: 10000 });
  assert.equal((await fetch(BASE + '/api/usage', { headers: { authorization: tok('tester@test.kr') } })).status, 200);
  // 새로고침해도 로그인 유지
  await p.reload();
  await p.locator('.wrap').waitFor({ state: 'visible', timeout: 10000 });
  // AI 한 번 (독백 질문 만들기)
  const ai = await fetch(BASE + '/api/ai', { method: 'POST', headers: { 'content-type': 'application/json', authorization: tok('tester@test.kr') }, body: JSON.stringify({ kind: 'mono_ask', c: { pro: false, kw: { mtype: '입시 독백', writer: '', emotion: [], situation: [], listener: [], mood: [], temper: [], hide: '', length: '1분' }, story: 'x', draft: '', memo: '', src: '', srcFrom: '', mat: '' } }) });
  assert.equal(ai.status, 200);

  // 관리자 이메일은 프로필만 넣으면 바로
  const o = await b.newPage({ viewport: { width: 390, height: 844 } });
  o.on('pageerror', (e) => errors.push('owner: ' + e));
  await o.goto(BASE + '/');
  await o.fill('#gate-email-in', 'owner@test.kr');
  await o.click('#gate-email-go');
  await o.fill('#gate-otp-in', '12345678');
  await o.click('#gate-otp-go');
  await o.fill('#gp-name', '송무');
  await o.locator('#gp-role .chip', { hasText: '배우' }).click();
  await o.check('#gp-14');
  await o.check('#gp-consent');
  await o.click('#gp-go');
  await o.locator('.wrap').waitFor({ state: 'visible', timeout: 10000 });

  // 로그아웃
  await p.locator('#hub-acct button', { hasText: '로그아웃' }).click();
  await p.locator('#gate-email').waitFor({ state: 'visible', timeout: 10000 });
  assert.deepEqual(errors, []);
  console.log('로그인 확인 통과 (앱 가림·로그인 없이 막힘·틀린 코드·프로필 검사·승인 대기 막힘·관리자 승인·새로고침 유지·AI 사용·관리자 이메일 바로·로그아웃)');
} catch (e) {
  console.log('실패:', e.message);
  code = 1;
} finally {
  await b.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
}
process.exit(code);
