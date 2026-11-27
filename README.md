# SOKMAL 웹앱 (정식 이식 — PRD 12절 0~2단계)

시제품(Claude 아티팩트 한 장)을 독립 웹앱으로 옮긴 첫 단계예요. 화면과 문구는 시제품 그대로이고, 바뀐 건 뒤쪽이에요.

| | 시제품 | 이 앱 |
|---|---|---|
| AI | 테스터 본인 Claude 계정 | 우리 서버 + 우리 Anthropic 키 |
| 프롬프트 | 브라우저가 만듦 | 서버가 만듦 (브라우저는 입력값만 보냄) |
| 하루 횟수 | 공유 문서, 화면에서만 확인 | 서버가 사용자별로 강제 (해석 입시 5·전문 5, 독백 10) |
| 월 예산 | 없음 | 호출마다 비용 기록, 상한에 닿으면 자동 차단 |
| 사용자 | Claude 계정 | 익명으로 시작 + 이메일 연결(선택) |
| 저장함·의견·후기 | Claude 저장소 | **이 기기(브라우저)에만** — 3단계에서 서버로 |
| 관리자 화면 | 있음 | **숨김** — 3단계에서 다시 엶 |

## 폴더
- `app/page.tsx` — 시제품 화면을 그대로 올림 (`legacy/body.html` + `app/globals.css` + `public/legacy/app.js`)
- `app/AuthBridge.tsx` — 익명 로그인·이메일 연결 (Supabase)
- `app/api/ai/route.ts` — AI 호출: 사용자 확인 → 입력 검사 → 월 예산 → 하루 횟수 예약 → 스트리밍 → 비용 기록
- `app/api/usage/route.ts` — 오늘 남은 횟수
- `lib/prompts/sokmal-prompts.js` — 프롬프트 원문 (**공개 저장소에는 없음**. 없으면 `sokmal-prompts.example.js` 예시로 켜짐)
- `lib/prompts/build.ts` — 요청 검사 + 프롬프트 조립
- `lib/limits.ts` — 한도 설정값, `lib/budget.ts` — 모델 가격·비용 계산
- `supabase/migrations/001_init.sql` — 표와 함수
- `legacy/body.html` — 시제품 화면 마크업

## 바탕화면에서 열기 (내 컴퓨터에서만)
`바탕화면에서 열기.md` 를 보세요. `SOKMAL 열기.command`(맥) / `SOKMAL 열기.bat`(윈도우)를 더블클릭하면 설치·빌드·서버 켜기·앱 창 열기·바탕화면 바로가기까지 해 줘요(`scripts/launch.mjs`). 키가 없으면 시험 모드(가짜 답), 횟수·비용은 `local-data/sokmal.json`에 남아요.

## 로컬에서 키 없이 돌려 보기 (개발자용)
```bash
npm install
```
```bash
npm run build
```
```bash
MOCK_AI=1 SOKMAL_DEV_AUTH=1 npm start
```
http://localhost:3000 — 가짜 AI 답으로 흐름 전체(한도 포함)를 볼 수 있어요.

## 확인
```bash
npm test
```
프롬프트 동일성(시제품 원본 함수와 글자 단위 비교) + 한도·비용 계산.
```bash
npm run build && npm run e2e
```
폰 크기 화면에서 해석·더 묻기·한도 6번째 차단·묻고 쓰기 독백·저장을 실제 브라우저로 확인. 캡처는 `e2e/out/`.

## 실제로 켜기 (송무가 할 일)
1. **Supabase** 프로젝트 만들기 → SQL Editor 에 `supabase/migrations/001_init.sql` 붙여 넣고 실행
2. Supabase **Authentication > Providers**: Anonymous sign-ins 켜기, Email 켜기
3. Supabase **Authentication > URL Configuration**: Site URL 과 Redirect URL 에 배포 주소(예: `https://sokmal.vercel.app/`) 넣기
4. **Anthropic** 콘솔에서 API 키 만들기
5. **Vercel** 에 이 폴더를 올리고 환경변수 넣기 (`.env.example` 참고). `MONTHLY_BUDGET_KRW`, `USD_KRW` 가 비어 있으면 AI가 돌지 않아요
6. 배포 후 확인: 해석 한 번 → Supabase `ai_calls` 표에 한 줄, `usage_daily` 에 run 1 이 생기는지

> 이번 작업에서는 키가 없어서 **실제 Anthropic 호출과 Supabase 연결은 돌려 보지 못했어요.** 위 6번으로 처음 확인해 주세요.

## AI 회사: OpenAI (11-27), 데이터베이스 없이
- 기본은 OpenAI(Responses API, 공식 `openai` 패키지). `AI_PROVIDER=anthropic`이면 예전 Anthropic 코드로 돌아요.
- **Vercel에 넣을 값:** `OPENAI_API_KEY`, `OPENAI_MODEL`(필수) · `SOKMAL_INVITE_CODES`(이미 넣음) · (선택) `OPENAI_MODEL_LIGHT`, `OPENAI_REASONING_EFFORT`, 가격 3개 + `MONTHLY_BUDGET_KRW` + `USD_KRW`
- **Supabase 없이 운영:** 초대 코드 하나 = 사용자 하나. 하루 횟수·월 비용은 서버 메모리에 세서, 서버가 새로 뜨면 초기화될 수 있어요. **비용의 진짜 천장은 OpenAI 대시보드의 예산 한도**예요.
- 안전장치: 데이터베이스도 초대 코드도 없으면 운영에서 AI를 열지 않아요.

## 관리자 페이지와 저장소 (11-27)
- **`/admin`**: 관리자 코드(`SOKMAL_ADMIN_CODE`)로 들어가요. 테스터별 사용(코드·이름 메모·쓴 날·모드별 횟수·한도 걸림·AI 호출·비용), AI 호출 최근 100건, 지표 3문항, 후기 설문·목록(랜딩 후보 표시), 한 줄 의견, CSV 내려받기.
- **저장소**: Vercel에서 **Upstash Redis**를 연결하면 자동으로 씀(`lib/data/redis.ts`). 없으면 서버 메모리(꺼지면 사라짐). 순서: Supabase → Redis → 파일(내 컴퓨터) → 메모리. 모두 `lib/data/kvstore.ts` 하나로 처리.
- 의견·후기는 테스터 브라우저에 저장하면서 서버(`/api/feedback`)에도 보내요.

## 초대 코드
`SOKMAL_INVITE_CODES`(Vercel 환경변수)에 쉼표로 **숫자 6자리** 코드를 적으면, 첫 화면이 앱과 분리된 **입장 화면**(`legacy/gate.html`)이 되고 그 코드를 넣은 사람만 들어올 수 있어요(서버도 확인). 같은 접속 주소에서 10분 안에 10번 틀리면 15분 동안 막혀요. 나중에 로그인 화면이 이 자리에 들어가요. 코드를 빼면 그 사람은 다음 요청부터 막혀요. 고친 뒤에는 Vercel에서 다시 배포해야 반영돼요. 비워 두면 초대 코드 없이 열려요.

## 공개 저장소에 없는 파일
프롬프트 원문과 기획 문서는 공개 저장소에 올리지 않아요. 송무의 압축 파일에만 있어요.
- `lib/prompts/sokmal-prompts.js`(프롬프트 원문), `legacy/index.html`(시제품 원본), `scripts/extract-prompts.mjs`, `tests/prompt-parity.test.ts`(원문 비교 테스트)
- `prd.md`, `SOKMAL-개발.md`, `CLAUDE.md`, `docs/`(기획·개발 문서)

원문이 없으면 `npm run build`·`npm run dev` 전에 `scripts/ensure-prompts.mjs`가 **예시 프롬프트**를 대신 넣어요. 화면 위에 "예시 프롬프트" 안내가 떠요.
배포할 때 원문을 쓰려면, 원문 파일을 gzip으로 압축해 base64로 바꾼 뒤 조각으로 나눠 Vercel 환경변수 `SOKMAL_PROMPTS_1`, `SOKMAL_PROMPTS_2`, … 에 넣어요(빌드할 때 이어 붙여 파일로 만들어 줌. 값이 깨져 있으면 빌드가 멈춤). 예전 방식인 `SOKMAL_PROMPTS_JS_BASE64`(압축 없이 한 칸)도 읽어요.

## 프롬프트를 고칠 때 (원문이 있는 컴퓨터에서)
`lib/prompts/sokmal-prompts.js` 를 직접 고치고, 이유를 `SOKMAL-개발.md` 에 적어요. `scripts/extract-prompts.mjs` 를 다시 돌리면 시제품 문구로 덮어쓰니 주의하세요. 프롬프트를 바꾸면 `tests/prompt-parity.test.ts` 가 실패하는데, 의도한 변경이면 그 테스트의 기준을 함께 고쳐요.

## 소개 페이지 (따로 떨어진 주소, 11-27)
- `landing/index.html` 한 장짜리 정적 페이지. Vercel에 **새 프로젝트**로 같은 저장소를 불러오고 Root Directory 를 `landing`, Framework 를 Other 로 두면 따로 배포돼요.
- 대기 명단은 앱 서버 `/api/waitlist`(다른 주소에서 받음)에 저장되고 관리자 화면 「대기 명단」에서 보고 지워요. 받는 주소를 좁히려면 앱 프로젝트에 `SOKMAL_LANDING_ORIGINS=https://소개-페이지-주소`.
- 앱 주소가 바뀌면 `landing/index.html` 의 `<meta name="sokmal-app">` 를 고쳐요.
- 확인: `node e2e/landing.mjs`
