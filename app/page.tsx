// 0단계 이식: 시제품의 화면(마크업·CSS·스크립트)을 그대로 올린다. React 컴포넌트로 다시 쓰는 건 나중 과제.
// - 마크업: legacy/body.html  - 스타일: app/globals.css  - 동작: public/legacy/app.js
import fs from 'node:fs';
import path from 'node:path';
import Script from 'next/script';
import AuthBridge from './AuthBridge';

const markup = fs.readFileSync(path.join(process.cwd(), 'legacy', 'body.html'), 'utf8');
// body.html 이 바뀌면 브라우저 캐시를 새로 받도록 스크립트 주소에 붙일 값
const ver = fs.statSync(path.join(process.cwd(), 'public', 'legacy', 'app.js')).mtimeMs.toString(36);

export default function Page() {
  return (
    <>
      <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: markup }} />
      <AuthBridge />
      <Script src={'/legacy/app.js?v=' + ver} strategy="afterInteractive" />
    </>
  );
}
