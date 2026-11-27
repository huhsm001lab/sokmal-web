import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 화면 코드(public/legacy/app.js)가 legacy/body.html 을 읽으므로 서버 번들에 포함
  outputFileTracingIncludes: { '/': ['./legacy/body.html', './legacy/gate.html', './public/legacy/app.js'], '/admin': ['./public/admin/admin.js'] },
};
export default nextConfig;
