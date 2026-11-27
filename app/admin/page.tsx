// 관리자 페이지 (따로 떨어진 /admin, 11-27): 테스터별 사용, AI 호출·비용, 의견·후기
// 동작은 public/admin/admin.js, 스타일은 app/globals.css (앱과 같은 모양)
import type { Metadata } from 'next';
import Script from 'next/script';
import fs from 'node:fs';
import path from 'node:path';

export const metadata: Metadata = { title: 'SOKMAL 관리자', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const ver = fs.statSync(path.join(process.cwd(), 'public', 'admin', 'admin.js')).mtimeMs.toString(36);

export default function AdminPage() {
  return (
    <div className="admin-wrap">
      <header className="appbar">
        <b id="bar-title">SOKMAL 관리자</b>
        <div className="admin-top-acts">
          <button type="button" className="btn small" id="adm-refresh" hidden>
            새로고침
          </button>
          <button type="button" className="btn small" id="adm-logout" hidden>
            나가기
          </button>
        </div>
      </header>
      <main>
        <form id="adm-login" className="card admin-login" noValidate>
          <h3 style={{ margin: '0 0 6px' }}>관리자 코드</h3>
          <p className="adm-leg" style={{ margin: '0 0 10px' }}>
            운영자만 들어올 수 있어요. 관리자 코드를 넣어 주세요.
          </p>
          <label htmlFor="adm-code" className="adm-leg">
            관리자 코드
          </label>
          <input type="password" id="adm-code" autoComplete="off" maxLength={100} />
          <div className="out-acts">
            <button type="submit" className="btn primary" id="adm-go">
              들어가기
            </button>
          </div>
          <p id="adm-msg" className="adm-msg" role="status" aria-live="polite"></p>
        </form>
        <div id="adm-body"></div>
      </main>
      <Script src={'/admin/admin.js?v=' + ver} strategy="afterInteractive" />
    </div>
  );
}
