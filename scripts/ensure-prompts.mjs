// 빌드·실행 전에 프롬프트 파일(lib/prompts/sokmal-prompts.js)이 있는지 확인한다.
// 1) 환경변수 SOKMAL_PROMPTS_JS_BASE64 가 있으면 그 내용으로 만든다 (배포할 때 원문을 저장소 밖에서 넣는 방법)
// 2) 파일이 이미 있으면 그대로 쓴다 (송무 컴퓨터: 압축 파일에 원문이 들어 있음)
// 3) 둘 다 없으면 예시 프롬프트(sokmal-prompts.example.js)를 복사한다 (공개 저장소에서 받은 경우)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'prompts');
const target = path.join(dir, 'sokmal-prompts.js');
const b64 = (process.env.SOKMAL_PROMPTS_JS_BASE64 || '').trim();

if (b64) {
  fs.writeFileSync(target, Buffer.from(b64, 'base64').toString('utf8'));
  console.log('[sokmal] 프롬프트 원문을 환경변수에서 넣었어요.');
} else if (!fs.existsSync(target)) {
  fs.copyFileSync(path.join(dir, 'sokmal-prompts.example.js'), target);
  console.log('[sokmal] 프롬프트 원문이 없어 예시 프롬프트로 켜요. 답의 품질은 실제와 달라요.');
}
