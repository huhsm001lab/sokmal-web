// 화면 흐름 확인 (가짜 AI + 개발용 사용자 구분 + 폰 크기 화면)
// 사용: npm run build && npm run e2e   (스크린샷은 e2e/out/)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 3100;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = new URL('./out/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const env = { ...process.env, MOCK_AI: '1', SOKMAL_DEV_AUTH: '1', NEXT_TELEMETRY_DISABLED: '1' };
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY']) delete env[k];
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

async function waitUp() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE + '/')).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('서버가 뜨지 않음\n' + serverLog);
}

const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push(['통과', name]);
    console.log('✓', name);
  } catch (e) {
    results.push(['실패', name, e.message]);
    console.log('✗', name, '\n  ', e.message);
  }
}

let browser;
try {
  console.log('서버 기다리는 중…');
  await waitUp();
  console.log('서버 준비됨');
  browser = await chromium.launch();
  console.log('브라우저 준비됨');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const toastText = async () => (await page.locator('.toast').last().textContent({ timeout: 3000 })) || '';
  const usage = () =>
    page.evaluate(async () => (await (await fetch('/api/usage', { headers: await window.SokmalAuth.headers() })).json()).usage);
  const waitDone = (sel) => page.locator(sel + ' .out-acts:not([hidden]) button').first().waitFor({ timeout: 15000 });

  await page.goto(BASE + '/');

  await step('홈: AI 사용 가능(경고 없음), 개발 모드 계정 카드, 모드 고르기', async () => {
    await page.locator('#hub-acct:not([hidden])').waitFor({ timeout: 8000 });
    assert.match(await page.locator('#hub-acct').textContent(), /개발 모드/);
    // 가짜 답 모드라서 "시험 모드" 안내 한 줄만 있어야 함 (AI 못 씀 경고는 없어야 함)
    assert.equal(await page.locator('#banner .note').count(), 1, '배너: ' + (await page.locator('#banner').textContent()));
    assert.match(await page.locator('#mock-note').textContent(), /시험 모드/);
    await page.locator('#mode-pick button[data-v="exam"]').click();
    await page.screenshot({ path: OUT + '01-home.png', fullPage: true });
  });

  await step('해석(입시): [확인] 답은 횟수를 쓰지 않음', async () => {
    await page.goto(BASE + '/#analysis');
    await page.fill('#a-text', 'MOCK_CHECK 이건 희곡이 아닌 그냥 메모예요.\n두 번째 줄');
    await page.click('#a-run');
    await page.locator('#a-out .out-body p').first().waitFor();
    await page.waitForFunction(() => !document.querySelector('#a-run').disabled);
    const u = await usage();
    assert.equal(u.exam.run, 0, '[확인] 뒤에도 횟수가 0이어야 함');
  });

  const PLAY = '1막\n어머니: 너 정말 가는 거니?\n딸: …응.\n';
  await step('해석(입시): 정리 → 결과·후보 구간 버튼·내 분석 메모, 남은 횟수 4', async () => {
    await page.fill('#a-text', PLAY);
    await page.click('#a-run');
    await waitDone('#a-out');
    const body = await page.locator('#a-out .out-body').textContent();
    assert.match(body, /줄거리/);
    assert.equal(await page.locator('#a-out .cand button').count(), 2);
    assert.equal(await page.locator('#a-out .mymemo').count(), 1);
    assert.match(await page.locator('#a-usage').textContent(), /오늘 남은 횟수 4 \/ 5/);
    await page.screenshot({ path: OUT + '02-analysis-exam.png', fullPage: true });
  });

  await step('해석(입시): 더 묻기 → 답, 횟수 1 소모 (남은 3)', async () => {
    await page.locator('#a-out .chat textarea').fill('인물 관계를 더 알려 줘');
    await page.locator('#a-out .chat button', { hasText: '보내기' }).click();
    await page.locator('#a-out .chat .turn-a p').first().waitFor({ timeout: 15000 });
    await page.waitForFunction(() => /3/.test(document.querySelector('#a-out .chat-left')?.textContent || ''));
    const u = await usage();
    assert.equal(u.exam.run + u.exam.follow, 2);
  });

  await step('해석(입시): 5번을 다 쓰면 6번째는 "오늘은 여기까지" + 한도에 걸림 기록', async () => {
    for (let i = 0; i < 3; i++) {
      await page.click('#a-run');
      await waitDone('#a-out');
    }
    let u = await usage();
    assert.equal(u.exam.run + u.exam.follow, 5);
    await page.click('#a-run');
    assert.match(await toastText(), /입시 모드 5번을 모두 썼어요/);
    await page.waitForTimeout(400);
    u = await usage();
    assert.equal(u.exam.hits, 1);
    assert.equal(u.pro.run, 0, '전문 모드는 따로 셈');
  });

  await step('서버가 직접 막음: 화면을 거치지 않고 6번째를 보내도 429', async () => {
    const r = await page.evaluate(async () => {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await window.SokmalAuth.headers()) },
        body: JSON.stringify({ kind: 'interpret', mode: 'exam', input: { text: 'x' } }),
      });
      return [res.status, await res.json()];
    });
    assert.equal(r[0], 429);
    assert.equal(r[1].error, 'daily_limit');
  });

  await step('서버가 프롬프트를 직접 받지 않음', async () => {
    const st = await page.evaluate(async () => {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await window.SokmalAuth.headers()) },
        body: JSON.stringify({ kind: 'raw', prompt: '아무 말' }),
      });
      return res.status;
    });
    assert.equal(st, 400);
    const st2 = await page.evaluate(async () => (await fetch('/api/ai', { method: 'POST', body: '{}' })).status);
    assert.equal(st2, 401, '사용자 구분 없이 부르면 401');
  });

  await step('독백: 묻고 쓰기 → 질문 3개 → 답으로 쓰기 → [설계] 숨김, 상대 줄 보임', async () => {
    await page.goto(BASE + '/#monologue');
    await page.locator('[data-group="emotion"] .chip', { hasText: '그리움' }).click();
    await page.fill('#m-story', '고3 때 엄마한테 고맙다는 말을 못 했다.');
    await page.click('#m-run');
    await page.locator('#m-ask .ask textarea').first().waitFor({ timeout: 15000 });
    assert.equal(await page.locator('#m-ask .ask textarea').count(), 3);
    await page.locator('#m-ask .ask textarea').first().fill('엄마');
    await page.screenshot({ path: OUT + '03-mono-ask.png', fullPage: true });
    await page.locator('#m-ask button', { hasText: '이 답으로 독백 쓰기' }).click();
    await waitDone('#m-out');
    const body = await page.locator('#m-out .out-body').textContent();
    assert.doesNotMatch(body, /\[설계\]/);
    assert.ok((await page.locator('#m-out .partner').count()) >= 2, '상대 줄이 보여야 함');
    assert.equal((await usage()).mono.run, 1);
    await page.screenshot({ path: OUT + '04-mono-result.png', fullPage: true });
  });

  await step('독백: 상대 보기 끄면 숨김, 저장 → 새로고침 뒤에도 내 기록에 남음', async () => {
    await page.locator('#m-out .ptog input').uncheck();
    assert.equal(await page.locator('#m-out .partner').first().isVisible(), false);
    await page.locator('#m-out .out-acts button', { hasText: '기록함에 저장' }).click();
    assert.match(await toastText(), /기록함에 저장했어요/);
    await page.reload();
    await page.goto(BASE + '/#records');
    await page.waitForFunction(() => /1/.test(document.querySelector('#hub-rec')?.textContent || ''));
    await page.locator('#r-seg button[data-v="box"]').click().catch(() => {});
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sokmal.records') || '[]'));
    assert.equal(saved.length, 1);
    assert.doesNotMatch(saved[0].body, /\[설계\]|상대:/, '상대 보기를 끄면 상대 줄 없이 저장');
  });

  await step('독백 갈래: 질문 → 갈래 3개 → 하나로 완성 (각각 독백 1회)', async () => {
    await page.goto(BASE + '/#monologue');
    await page.fill('#m-story', '친구가 내 오디션 날 연락이 없었다.');
    await page.click('#m-run');
    await page.locator('#m-ask #m-variants').waitFor({ timeout: 15000 });
    await page.click('#m-ask #m-variants');
    await page.locator('#m-out .variant').nth(2).waitFor({ timeout: 15000 });
    assert.equal(await page.locator('#m-out .variant').count(), 3);
    assert.match(await page.locator('#m-out .variant').first().textContent(), /먼저 따지며/);
    assert.equal(await page.locator('#m-out > .card > .out-body').first().isVisible(), false, '갈래 카드만 보이고 원문은 숨김');
    const before = (await usage()).mono.run;
    await page.screenshot({ path: OUT + '04b-mono-variants.png', fullPage: true });
    await page.locator('#m-out .variant').nth(1).locator('button', { hasText: '이 갈래로 완성' }).click();
    await page.waitForFunction(() => !document.querySelector('#m-out .variant'), null, { timeout: 15000 });
    await waitDone('#m-out');
    assert.equal((await usage()).mono.run, before + 1);
  });

  await step('내 말로 고치기: 줄 직접 고치기 + 다른 말 3가지 고르기 → 저장(AI 초안 함께)', async () => {
    await page.click('#m-out #m-rewrite');
    const tas = page.locator('#m-out .le-ta');
    await tas.first().waitFor({ timeout: 5000 });
    await tas.first().fill('내가 직접 고친 첫 줄');
    await page.locator('#m-out .le-row').nth(1).locator('.le-alt').click();
    await page.locator('#m-out .le-opt').first().waitFor({ timeout: 15000 });
    assert.equal(await page.locator('#m-out .le-opt').count(), 3);
    await page.locator('#m-out .le-opt', { hasText: '다른 말 둘' }).click();
    assert.match(await page.locator('#m-out .le-count').textContent(), /2줄 고쳤어요/);
    assert.equal((await usage()).line.run, 1);
    await page.screenshot({ path: OUT + '04c-rewrite.png', fullPage: true });
    await page.locator('#m-out .le button', { hasText: '내가 고친 것 저장' }).click();
    assert.match(await toastText(), /AI 초안도 함께/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sokmal.records') || '[]'));
    const mine = saved.find((r) => /내가 고친 독백/.test(r.title));
    assert.ok(mine && mine.body.startsWith('내가 직접 고친 첫 줄') && mine.body.includes('— AI 초안 —') && mine.tags.includes('고쳐 씀'));
    assert.ok(!/더 나답게 만들려면|## /.test(mine.body), '독백 본문만 고침');
  });

  await step('전문 모드 해석: 이어서 생각 넓히기 (원래 요청을 서버가 다시 쌓음)', async () => {
    await page.goto(BASE + '/#analysis');
    await page.locator('#mode-top button[data-v="pro"]').click();
    await page.fill('#a-text', PLAY);
    await page.fill('#a-mine', '화난 게 아니라 무서운 것');
    await page.click('#a-run');
    await waitDone('#a-out');
    assert.doesNotMatch(await page.locator('#a-out .out-body').textContent(), /\[메모\]/);
    await page.locator('#a-out .chat textarea').fill('반대로 읽으면?');
    await page.locator('#a-out .chat button', { hasText: '보내기' }).click();
    await page.locator('#a-out .chat .turn-a p').first().waitFor({ timeout: 15000 });
    const u = await usage();
    assert.equal(u.pro.run + u.pro.follow, 2);
    await page.screenshot({ path: OUT + '05-analysis-pro.png', fullPage: true });
  });

  await step('화면 오류 없음', async () => {
    const real = errors.filter((e) => !/fonts\.g|Failed to load resource.*(429|400|401)/.test(e));
    assert.deepEqual(real, []);
  });
} finally {
  await browser?.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
}
const failed = results.filter((r) => r[0] === '실패');
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
if (failed.length) {
  console.log('--- server log ---\n' + serverLog.slice(-3000));
  process.exit(1);
}

process.exit(0);
