// 0단계 이식: 시제품의 화면(마크업·CSS·스크립트)을 그대로 올린다. React 컴포넌트로 다시 쓰는 건 나중 과제.
// - 입장 화면: legacy/gate.html (초대 코드, 나중에 로그인)  - 앱 마크업: legacy/body.html
// - 스타일: app/globals.css  - 동작: public/legacy/app.js
import fs from 'node:fs';
import path from 'node:path';
import Script from 'next/script';
import AuthBridge from './AuthBridge';
import { inviteOn } from '@/lib/invite';

// 초대 코드를 쓰는지는 서버 환경변수로 정해지므로 요청마다 그린다
export const dynamic = 'force-dynamic';

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), 'utf8');
const gate = read('legacy', 'gate.html');
const markup = read('legacy', 'body.html');
// app.js 가 바뀌면 브라우저 캐시를 새로 받도록 스크립트 주소에 붙일 값
const ver = fs.statSync(path.join(process.cwd(), 'public', 'legacy', 'app.js')).mtimeMs.toString(36);

export default function Page() {
  const gated = inviteOn();
  // 초대 코드가 필요하고 이 브라우저에 저장된 코드가 없으면, 앱을 그리기 전에 입장 화면만 보이게 잠근다
  const lock = `(function(){window.SOKMAL_GATED=${gated ? 'true' : 'false'};if(!window.SOKMAL_GATED)return;var c='';try{c=localStorage.getItem('sokmal.invite')||''}catch(e){}if(!c)document.documentElement.classList.add('gated')})();`;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: lock }} />
      <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: gate }} />
      <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: markup }} />
      <AuthBridge />
      <Script src={'/legacy/app.js?v=' + ver} strategy="afterInteractive" />
    </>
  );
}
