// 빌드·실행 전에 프롬프트 파일(lib/prompts/sokmal-prompts.js)이 있는지 확인한다.
// 1) 환경변수로 원문을 받으면 그 내용으로 만든다 (배포할 때 원문을 저장소 밖에서 넣는 방법)
//    - SOKMAL_PROMPTS_1, _2, _3 … : 압축(gzip)한 값을 조각으로 나눈 것. 순서대로 이어 붙인다 (11-27, 긴 값이 Vercel 입력 칸에서 멈춰서)
//    - SOKMAL_PROMPTS_JS_BASE64 : 예전 방식(한 칸에 통째로). 조각이 있으면 조각이 먼저
//    값이 깨져 있으면 빌드를 멈춘다 → 배포는 이전 것이 그대로 남음
// 2) 파일이 이미 있으면 그대로 쓴다 (송무 컴퓨터: 압축 파일에 원문이 들어 있음)
// 3) 둘 다 없으면 예시 프롬프트(sokmal-prompts.example.js)를 복사한다 (공개 저장소에서 받은 경우)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'prompts');
const target = path.join(dir, 'sokmal-prompts.js');

const parts = [];
for (let i = 1; i <= 9; i++) {
  const v = (process.env['SOKMAL_PROMPTS_' + i] || '').replace(/\s+/g, '');
  if (!v) break;
  parts.push(v);
}
const b64 = parts.length ? parts.join('') : (process.env.SOKMAL_PROMPTS_JS_BASE64 || '').replace(/\s+/g, '');

if (b64) {
  let buf = Buffer.from(b64, 'base64');
  let text;
  try {
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
    text = buf.toString('utf8');
  } catch {
    text = '';
  }
  if (!text.includes('export const EXPERT')) {
    console.error(`[sokmal] 환경변수의 프롬프트 값이 깨져 있어요(조각 ${parts.length}개). 빠진 조각이나 잘린 곳이 없는지 확인해 주세요.`);
    process.exit(1);
  }
  fs.writeFileSync(target, text);
  console.log(`[sokmal] 프롬프트 원문을 환경변수에서 넣었어요${parts.length ? ` (조각 ${parts.length}개)` : ''}.`);
} else if (!fs.existsSync(target)) {
  fs.copyFileSync(path.join(dir, 'sokmal-prompts.example.js'), target);
  console.log('[sokmal] 프롬프트 원문이 없어 예시 프롬프트로 켜요. 답의 품질은 실제와 달라요.');
}
