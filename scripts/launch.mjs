// SOKMAL 내 컴퓨터에서 열기 — 「SOKMAL 열기.command」(맥) / 「SOKMAL 열기.bat」(윈도우)가 부르는 스크립트
// 하는 일: 설정 파일 만들기 → (처음·코드가 바뀌었을 때) 설치·빌드 → 서버 켜기(내 컴퓨터에서만 접속 가능) → 앱 창으로 열기 → 바탕화면 바로가기 만들기
// 옵션: --no-open(브라우저를 열지 않음) --no-shortcut(바로가기를 만들지 않음) --check(켜져 있는지만 보고 끝냄)
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const PORT = 3939;
const URL_ = `http://127.0.0.1:${PORT}`;
const args = new Set(process.argv.slice(2));
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const say = (...m) => console.log(...m);
const line = () => say('────────────────────────────────────────');

function fail(msg) {
  say('\n[문제] ' + msg);
  process.exit(1);
}

/* ---------- 0. Node 버전 ---------- */
const major = Number(process.versions.node.split('.')[0]);
if (major < 20) fail(`Node.js ${process.versions.node} 은(는) 너무 오래됐어요. nodejs.org 에서 LTS 버전(20 이상)을 설치해 주세요.`);

/* ---------- 1. 설정 파일 (.env.local) ---------- */
const ENV_FILE = path.join(ROOT, '.env.local');
const ENV_TEMPLATE = `# SOKMAL 내 컴퓨터 시험용 설정 (이 파일은 내 컴퓨터에만 있어요. 남에게 보내지 마세요)
#
# 아래 두 칸(OPENAI_API_KEY, OPENAI_MODEL)을 채우면 "진짜 AI"로 켜져요. 비워 두면 "시험 모드"(정해 둔 가짜 답)로 켜져요.
# 고친 뒤에는 SOKMAL 창과 검은 창을 닫고 다시 열어 주세요.

# OpenAI 대시보드(platform.openai.com)에서 만든 API 키
OPENAI_API_KEY=
# 쓸 OpenAI 모델 이름 (OpenAI 모델 목록에 있는 이름 그대로)
OPENAI_MODEL=
# (선택) 쓰기 전 질문 만들기에 쓸 더 가벼운 모델. 비우면 위와 같은 모델
OPENAI_MODEL_LIGHT=

# (선택) 앱이 직접 비용을 세고 멈추게 하려면 아래를 모두 채우세요. 비우면 OpenAI 대시보드의 한도만 써요.
# 모델 가격(100만 토큰당 달러, OpenAI 가격표에서 확인)
OPENAI_PRICE_INPUT=
OPENAI_PRICE_CACHED_INPUT=
OPENAI_PRICE_OUTPUT=
# 한 달 AI 비용 상한(원)과 환율(원/달러). 예) 200000 / 1400
MONTHLY_BUDGET_KRW=
USD_KRW=
`;
if (!fs.existsSync(ENV_FILE)) {
  fs.writeFileSync(ENV_FILE, ENV_TEMPLATE);
  say('설정 파일을 만들었어요: .env.local');
}
function readEnvFile(f) {
  const o = {};
  for (const raw of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return o;
}
const local = readEnvFile(ENV_FILE);
const realAi = !!(local.OPENAI_API_KEY || local.ANTHROPIC_API_KEY);
const modelMissing = !!local.OPENAI_API_KEY && !local.OPENAI_MODEL;
const budgetSet = Number(local.MONTHLY_BUDGET_KRW) > 0 && Number(local.USD_KRW) > 0;

/* ---------- 2. 이미 켜져 있나 ---------- */
async function running() {
  try {
    const r = await fetch(URL_ + '/', { signal: AbortSignal.timeout(1500) });
    return (await r.text()).includes('SOKMAL') ? 'sokmal' : 'other';
  } catch {
    return null;
  }
}

/* ---------- 3. 브라우저를 앱 창으로 ---------- */
function firstExisting(list) {
  return list.find((p) => p && fs.existsSync(p)) || null;
}
function openApp() {
  if (args.has('--no-open')) return;
  const appArgs = ['--app=' + URL_, '--window-size=480,900'];
  if (IS_WIN) {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const lad = process.env['LOCALAPPDATA'] || '';
    const exe = firstExisting([
      path.join(pf, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(pf86, 'Google\\Chrome\\Application\\chrome.exe'),
      lad && path.join(lad, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(pf86, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(pf, 'Microsoft\\Edge\\Application\\msedge.exe'),
    ]);
    if (exe) spawn(exe, appArgs, { detached: true, stdio: 'ignore' }).unref();
    else spawn('cmd', ['/c', 'start', '""', URL_], { detached: true, stdio: 'ignore' }).unref();
  } else if (IS_MAC) {
    const app = firstExisting(['/Applications/Google Chrome.app', path.join(os.homedir(), 'Applications/Google Chrome.app'), '/Applications/Microsoft Edge.app']);
    if (app) spawn('open', ['-na', app, '--args', ...appArgs], { detached: true, stdio: 'ignore' }).unref();
    else spawn('open', [URL_], { detached: true, stdio: 'ignore' }).unref(); // 사파리 등 기본 브라우저
  } else {
    spawn('xdg-open', [URL_], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  }
  say('SOKMAL 창을 열었어요. 안 보이면 브라우저에서 ' + URL_ + ' 를 열어 주세요.');
}

/** 이 폴더의 실행 파일 (압축 해제 프로그램이 한글 이름을 바꿔도 찾을 수 있게, 확장자로 찾음) */
function ownLauncher(ext) {
  const named = path.join(ROOT, 'SOKMAL 열기' + ext);
  if (fs.existsSync(named)) return named;
  const f = fs.readdirSync(ROOT).find((n) => n.toLowerCase().endsWith(ext));
  if (!f) throw new Error('실행 파일을 찾지 못함');
  return path.join(ROOT, f);
}

/* ---------- 4. 바탕화면 바로가기 (처음 한 번, 폴더를 옮기면 다시) ---------- */
function makeShortcut() {
  if (args.has('--no-shortcut')) return;
  const marker = path.join(ROOT, 'local-data', 'shortcut.txt');
  try {
    if (fs.readFileSync(marker, 'utf8') === ROOT) return;
  } catch {}
  let made = false;
  try {
    if (IS_WIN) {
      const bat = ownLauncher('.bat');
      const ico = path.join(ROOT, 'public', 'icon.ico');
      const q = (s) => "'" + s.replace(/'/g, "''") + "'";
      const ps = [
        "$d=[Environment]::GetFolderPath('Desktop')",
        "$s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d 'SOKMAL.lnk'))",
        `$s.TargetPath=${q(bat)}`,
        `$s.WorkingDirectory=${q(ROOT)}`,
        `$s.IconLocation=${q(ico)}`,
        '$s.WindowStyle=7',
        "$s.Description='SOKMAL 속말'",
        '$s.Save()',
      ].join(';');
      // 한글 경로가 깨지지 않게 UTF-16 base64로 넘김
      const enc = Buffer.from(ps, 'utf16le').toString('base64');
      const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc], { stdio: 'ignore' });
      made = r.status === 0;
    } else if (IS_MAC) {
      const desk = path.join(os.homedir(), 'Desktop');
      if (fs.existsSync(desk)) {
        const f = path.join(desk, 'SOKMAL.command');
        const target = ownLauncher('.command');
        fs.writeFileSync(f, `#!/bin/bash\n# SOKMAL 바로가기 — 실제 파일: ${target}\nexec "${target.replace(/"/g, '\\"')}"\n`);
        fs.chmodSync(f, 0o755);
        // 아이콘 붙이기 (실패해도 괜찮음)
        const icon = path.join(ROOT, 'public', 'icon.png');
        const js = `ObjC.import('AppKit');$.NSWorkspace.sharedWorkspace.setIconForFileOptions($.NSImage.alloc.initWithContentsOfFile(${JSON.stringify(icon)}),${JSON.stringify(f)},0)`;
        spawnSync('osascript', ['-l', 'JavaScript', '-e', js], { stdio: 'ignore' });
        made = true;
      }
    }
  } catch {
    made = false;
  }
  if (made) {
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, ROOT);
    say('바탕화면에 SOKMAL 바로가기를 만들었어요. 다음부터는 그걸 더블클릭하면 돼요.');
  }
}

/* ---------- 5. 설치·빌드 ---------- */
const npm = IS_WIN ? 'npm.cmd' : 'npm';
function run(cmd, cmdArgs, label) {
  say(label);
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: IS_WIN, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
  if (r.status !== 0) fail(label.replace(/…$/, '') + ' 중에 문제가 생겼어요. 인터넷 연결을 확인하고 다시 열어 주세요. 계속되면 이 창을 캡처해 보내 주세요.');
}
function newestMtime(p) {
  let st;
  try {
    st = fs.statSync(p);
  } catch {
    return 0;
  }
  if (!st.isDirectory()) return st.mtimeMs;
  let m = 0;
  for (const e of fs.readdirSync(p)) m = Math.max(m, newestMtime(path.join(p, e)));
  return m;
}
function needInstall() {
  const stamp = path.join(ROOT, 'node_modules', '.package-lock.json');
  if (!fs.existsSync(path.join(ROOT, 'node_modules', 'next', 'package.json')) || !fs.existsSync(stamp)) return true;
  return fs.statSync(path.join(ROOT, 'package.json')).mtimeMs > fs.statSync(stamp).mtimeMs;
}
function needBuild() {
  const id = path.join(ROOT, '.next', 'BUILD_ID');
  if (!fs.existsSync(id)) return true;
  const built = fs.statSync(id).mtimeMs;
  const src = Math.max(...['app', 'lib', 'public', 'legacy', 'package.json', 'next.config.ts'].map((p) => newestMtime(path.join(ROOT, p))));
  return src > built;
}

/* ---------- 실행 ---------- */
line();
say(' SOKMAL 속말 — 내 컴퓨터에서 열기');
line();

const state = await running();
if (args.has('--check')) {
  say(state === 'sokmal' ? '켜져 있어요' : '꺼져 있어요');
  process.exit(state === 'sokmal' ? 0 : 3);
}
if (state === 'sokmal') {
  say('SOKMAL이 이미 켜져 있어요.');
  makeShortcut();
  openApp();
  process.exit(0);
}
if (state === 'other') fail(`다른 프로그램이 ${PORT}번 포트를 쓰고 있어요. 그 프로그램을 끄고 다시 열어 주세요.`);

if (needInstall()) run(npm, ['install', '--no-audit', '--no-fund'], '처음 준비하는 중이에요(필요한 부품 받기, 몇 분 걸려요)…');
if (needBuild()) run(npm, ['run', 'build'], '화면을 만드는 중이에요(1~2분)…');

const serverEnv = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: '1',
  SOKMAL_DEV_AUTH: '1', // 로그인 없이 이 컴퓨터(브라우저) 아이디로 구분
  SOKMAL_LOCAL_DATA: path.join(ROOT, 'local-data', 'sokmal.json'), // 횟수·AI 비용 기록
};
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) delete serverEnv[k];
if (!realAi) serverEnv.MOCK_AI = '1';
else delete serverEnv.MOCK_AI;

say('');
if (!realAi) say('지금은 [시험 모드]예요: AI 대신 정해 둔 가짜 답이 나와요. 진짜 AI는 .env.local 에 키를 넣으면 돼요.');
else if (modelMissing) say('[주의] .env.local 에 OPENAI_MODEL(모델 이름)을 채워야 AI가 돌아요.');
else if (!local.OPENAI_API_KEY && !budgetSet) say('[주의] Anthropic 키를 쓸 때는 MONTHLY_BUDGET_KRW 와 USD_KRW 를 채워야 AI가 돌아요(비용 안전장치).');
else say('진짜 AI로 켜요.' + (budgetSet ? ` 앱 비용 상한 ${Number(local.MONTHLY_BUDGET_KRW).toLocaleString('ko-KR')}원.` : ' 비용 천장은 OpenAI 대시보드의 한도예요.'));
say('SOKMAL을 켜는 중이에요…  (이 창을 닫으면 SOKMAL이 꺼져요)');

const server = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
  env: serverEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => {
  log += d;
  process.stderr.write(d); // 오류는 바로 보이게
});
server.on('exit', (code) => {
  say('\nSOKMAL이 꺼졌어요.' + (code ? ' (코드 ' + code + ')\n' + log.slice(-1500) : ''));
  process.exit(code ?? 0);
});
const stop = () => server.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('SIGHUP', stop);

for (let i = 0; i < 150; i++) {
  if ((await running()) === 'sokmal') break;
  await new Promise((r) => setTimeout(r, 200));
  if (i === 149) {
    server.kill();
    fail("SOKMAL이 켜지지 않았어요.\n" + log.slice(-1500));
  }
}
say('켜졌어요: ' + URL_);
makeShortcut();
openApp();
say('\n다 쓰면 SOKMAL 창과 이 검은 창을 닫아 주세요.');
