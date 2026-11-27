// 소개 페이지(landing/, 따로 떨어진 주소) 확인: 폰 너비, 대기 명단 → 다른 주소의 앱 서버(/api/waitlist)에 저장 → 관리자에서 보임·지우기
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 3104;
const APP = `http://127.0.0.1:${PORT}`;
const LANDING = 'http://127.0.0.1:3998/'; // 가짜 주소(가로채서 소개 페이지를 돌려줌). 앱과 다른 주소라 CORS도 함께 확인
const OUT = new URL('./out/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const ADMIN = 'Admin-Test-Code-88';
const env = { ...process.env, MOCK_AI: '1', SOKMAL_INVITE_CODES: '482913', SOKMAL_ADMIN_CODE: ADMIN, NEXT_TELEMETRY_DISABLED: '1' };
for (const k of ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'SOKMAL_LOCAL_DATA', 'SOKMAL_LANDING_ORIGINS', 'SOKMAL_DEV_AUTH']) delete env[k];
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { env, stdio: 'ignore', detached: true });
const html = fs.readFileSync(new URL('../landing/index.html', import.meta.url), 'utf8').replace('content="https://sokmal-web.vercel.app"', `content="${APP}"`);
let code = 0;
// 가로채서 돌려준 페이지는 '공개 주소'로 취급돼 내 컴퓨터 주소(앱 서버)로의 요청이 막힘 → 시험에서만 그 검사를 끔 (실제는 공개 주소끼리라 해당 없음)
const b = await chromium.launch({ args: ['--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights'] });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(APP + '/')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  const errors = [];
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') console.log('콘솔:', m.text()); });
  p.on('requestfailed', (r) => console.log('요청 실패:', r.url(), r.failure()?.errorText));
  await p.route(LANDING, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.goto(LANDING);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390, '폰 화면에서 가로로 넘치면 안 됨');
  assert.equal(await p.getAttribute('#go-app', 'href'), APP, '입장 버튼이 앱 주소로 가야 함');
  await p.screenshot({ path: OUT + '08-landing.png', fullPage: true });

  // 빈칸·동의 없이 보내면 막힘
  await p.click('#w-go');
  await p.waitForFunction(() => /이메일 또는 휴대폰/.test(document.querySelector('#w-msg').textContent));
  await p.fill('#w-contact', '010-2345-6789');
  await p.click('#w-role .chip:has-text("입시생")');
  await p.click('#w-go');
  await p.waitForFunction(() => /동의/.test(document.querySelector('#w-msg').textContent));
  await p.check('#w-agree');
  await p.fill('#w-note', '2차 지정희곡 분석이 막막해요');
  await p.click('#w-go');
  await p.waitForFunction(() => /대기 명단에 올렸어요/.test(document.querySelector('#w-msg').textContent), null, { timeout: 8000 }).catch(async (e) => { throw new Error(e.message + ' / 메시지: ' + (await p.textContent('#w-msg'))); });

  // 관리자에서 보임 → 지우기
  const a = await b.newPage({ viewport: { width: 1280, height: 900 } });
  a.on('pageerror', (e) => errors.push('admin: ' + e));
  a.on('dialog', (d) => d.accept());
  await a.goto(APP + '/admin');
  await a.fill('#adm-code', ADMIN);
  await a.click('#adm-go');
  await a.locator('h3', { hasText: '대기 명단 1명' }).waitFor({ timeout: 8000 });
  assert.match(await a.locator('#adm-body').textContent(), /010-2345-6789[\s\S]*입시생[\s\S]*지정희곡/);
  await a.locator('tr', { hasText: '010-2345-6789' }).locator('button', { hasText: '지우기' }).click();
  await a.locator('h3', { hasText: '대기 명단 0명' }).waitFor({ timeout: 5000 });
  assert.deepEqual(errors, []);
  console.log('소개 페이지 확인 통과 (폰 너비·입장 링크·빈칸 막기·동의·대기 명단 저장·관리자 보기·지우기)');
} catch (e) {
  console.log('실패:', e.message);
  code = 1;
} finally {
  await b.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
}
process.exit(code);
