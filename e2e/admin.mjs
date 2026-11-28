// 관리자 페이지 확인: 테스터가 해석을 쓰고 의견 2번·후기를 보냄 → /admin 에서 틀린 코드 막힘 →
// 맞는 코드로 들어가 테스터(코드)·AI 호출·의견·후기가 보이고, 이름 메모가 새로고침 뒤에도 남는지
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 3103;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = new URL('./out/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const ADMIN = 'Admin-Test-Code-77';
const env = { ...process.env, MOCK_AI: '1', SOKMAL_DEV_AUTH: '1', SOKMAL_INVITE_CODES: '482913,705162', SOKMAL_ADMIN_CODE: ADMIN, NEXT_TELEMETRY_DISABLED: '1' };
for (const k of ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'SOKMAL_LOCAL_DATA']) delete env[k];
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { env, stdio: 'ignore', detached: true });
let code = 0;
const b = await chromium.launch();
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + '/')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  const errors = [];

  // ---- 테스터
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', (e) => errors.push('app: ' + e));
  await p.goto(BASE + '/');
  await p.fill('#gate-code', '705162');
  await p.click('#gate-go');
  await p.locator('.wrap').waitFor({ state: 'visible' });
  await p.goto(BASE + '/#analysis');
  await p.fill('#a-text', '1막\n어머니: 가니?\n딸: …응.');
  const sendFeedback = async (note) => {
    await p.click('#a-run');
    await p.locator('#a-out .out-acts:not([hidden]) button').first().waitFor({ timeout: 15000 });
    const fb = p.locator('#a-out .fb');
    for (const label of ['맞았다', '사람 같았다', '났다']) await fb.locator('.chip', { hasText: label }).first().click();
    await fb.locator('input[type=text]').fill(note);
    await fb.locator('button', { hasText: '의견 보내기' }).click();
    await p.locator('#a-out .fb .done').waitFor({ timeout: 5000 });
  };
  await sendFeedback('첫 의견이에요');
  await sendFeedback('두 번째 의견');
  const rv = p.locator('#a-out .rv');
  await rv.waitFor({ timeout: 5000 });
  await rv.locator('.chip', { hasText: '입시생' }).click();
  await rv.locator('textarea').fill('질문이 먼저 나와서 내 얘기를 쓰게 됐어요.');
  await rv.locator('input[type=checkbox]').check();
  await rv.locator('button', { hasText: '후기 보내기' }).click();
  await p.locator('#a-out .rv .done').waitFor({ timeout: 5000 });
  await p.waitForTimeout(800); // 서버로 보내기

  // ---- 관리자
  const a = await b.newPage({ viewport: { width: 1280, height: 900 } });
  a.on('pageerror', (e) => errors.push('admin: ' + e));
  const r0 = await fetch(BASE + '/api/admin');
  assert.equal(r0.status, 403, '코드 없이 관리자 데이터가 막혀야 함');
  await a.goto(BASE + '/admin');
  await a.fill('#adm-code', 'wrong-code');
  await a.click('#adm-go');
  await a.waitForFunction(() => /맞지 않는/.test(document.querySelector('#adm-msg')?.textContent || ''), null, { timeout: 5000 });
  await a.fill('#adm-code', ADMIN);
  await a.click('#adm-go');
  await a.locator('.adm-table').first().waitFor({ timeout: 8000 });
  const text = await a.locator('#adm-body').textContent();
  assert.match(text, /705162/, '테스터 코드가 보여야 함');
  assert.match(text, /첫 의견이에요/, '한 줄 의견이 보여야 함');
  assert.match(text, /내 얘기를 쓰게 됐어요/, '후기가 보여야 함');
  assert.match(text, /해석·exam/, 'AI 호출이 보여야 함');
  assert.match(text, /서버 메모리/, '저장소 종류가 보여야 함');
  // 이름 메모
  const row = a.locator('.adm-table tbody tr', { hasText: '705162' }).first();
  await row.locator('input').fill('김배우');
  await row.locator('button', { hasText: '저장' }).click();
  await a.waitForTimeout(500);
  await a.reload();
  await a.locator('.adm-table').first().waitFor({ timeout: 8000 });
  assert.equal(await a.locator('.adm-table tbody tr', { hasText: '705162' }).first().locator('input').inputValue(), '김배우');
  // 랜딩 후보 표시
  await a.locator('button', { hasText: '랜딩에 쓸 후기로 표시' }).click();
  await a.locator('.tag.ok', { hasText: '랜딩 후보' }).waitFor({ timeout: 5000 });
  // 독백 지침 스위치: 끄면 새로고침 뒤에도 꺼져 있음
  assert.equal(await a.isChecked('#sw-monoRules'), true, '지침은 처음에 켜져 있어야 함');
  await a.click('#sw-monoRules');
  await a.waitForFunction(() => /꺼짐/.test(document.querySelector('label[for="sw-monoRules"] .sw-state')?.textContent || ''), null, { timeout: 5000 });
  await a.reload();
  await a.locator('#sw-monoRules').waitFor({ timeout: 8000 });
  assert.equal(await a.isChecked('#sw-monoRules'), false, '끈 지침이 새로고침 뒤에도 꺼져 있어야 함');
  assert.equal(await a.isChecked('#sw-monoExamples'), true);
  // 지침 다시 켜고, 제작·검수 기준 저장 → 독백 1번 → 배우는 최종본을 받고, 관리자에 검수 기록
  await a.click('#sw-monoRules');
  await a.waitForFunction(() => /켜짐/.test(document.querySelector('label[for="sw-monoRules"] .sw-state')?.textContent || ''), null, { timeout: 5000 });
  await a.fill('#guide-make', '01. 대사의 자연스러움\n* 읽기 좋은 글보다 말하기 좋은 대사');
  await a.fill('#guide-review', '01. 창작 독백 평가표 (100점 만점)');
  await a.check('#guide-review-on');
  await a.locator('button', { hasText: '기준 저장' }).click();
  await a.locator('#guide-make').waitFor({ timeout: 5000 });
  await a.waitForFunction(() => /마지막 저장/.test(document.querySelector('#adm-body')?.textContent || ''), null, { timeout: 5000 });
  const mono = { kind: 'mono', mMode: 'new', hist: [], qa: null, c: { pro: false, kw: { mtype: '입시 독백', writer: '', emotion: ['서운함'], situation: ['사과'], listener: ['친구'], mood: [], temper: [], hide: '', length: '1분' }, story: '시험', draft: '', memo: '', src: '', srcFrom: '', mat: '' } };
  const res = await fetch(BASE + '/api/ai', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sokmal-invite': '705162' }, body: JSON.stringify(mono) });
  const lines = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(lines.some((l) => l.p === 'review'), '검수 단계 신호가 와야 함');
  const done = lines.find((l) => l.done);
  assert.ok(done && done.text.includes('(검수 뒤 최종본)') && !done.text.includes('수정 전 총점'), '배우는 검수 내용 없이 최종본만 받아야 함');
  await a.reload();
  await a.locator('summary', { hasText: '점수 71 → 84' }).waitFor({ timeout: 8000 });
  assert.match(await a.locator('#adm-body').textContent(), /독백·new \[제작 기준\]·검수/, 'AI 호출 기록에 검수 호출이 보여야 함');
  await a.screenshot({ path: OUT + '07-admin.png', fullPage: true });
  // 폰 화면에서 가로로 넘치지 않는지 (표는 안에서 밀림)
  await a.setViewportSize({ width: 390, height: 844 });
  const w = await a.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(w <= 392, '폰 화면에서 페이지가 가로로 넘침: ' + w);
  assert.deepEqual(errors, []);
  console.log('관리자 페이지 확인 통과 (서버 차단·틀린 코드·테스터 코드·AI 호출·의견·후기·이름 메모·랜딩 표시·지침 스위치·제작·검수 기준·폰 너비)');
} catch (e) {
  console.log('실패:', e.message);
  code = 1;
} finally {
  await b.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
}
process.exit(code);
