// 서버 환경변수. 값의 뜻은 .env.example 을 보세요.
const env = (k: string) => (process.env[k] ?? '').trim();

export const config = {
  anthropicKey: env('ANTHROPIC_API_KEY'),
  /** 모델 [기본안]: 블라인드 비교로 확정 전까지 Sonnet급 + 가벼운 호출(질문 만들기)은 Haiku급 */
  modelMain: env('MODEL_MAIN') || 'claude-sonnet-5-5',
  modelLight: env('MODEL_LIGHT') || 'claude-haiku-5-5',
  effortMain: (env('EFFORT_MAIN') || 'medium') as 'low' | 'medium' | 'high' | 'xhigh' | 'max',
  effortLight: (env('EFFORT_LIGHT') || 'low') as 'low' | 'medium' | 'high' | 'xhigh' | 'max',
  /** 월 AI 예산 상한(원) [미정]. 비어 있으면 운영 환경에서는 AI를 돌리지 않아요 */
  monthlyBudgetKrw: Number(env('MONTHLY_BUDGET_KRW') || 0),
  /** 비용 환산용 환율(원/달러). 비어 있으면 운영 환경에서는 AI를 돌리지 않아요 */
  usdKrw: Number(env('USD_KRW') || 0),
  supabaseUrl: env('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: env('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceKey: env('SUPABASE_SERVICE_ROLE_KEY'),
  /** 1이면 AI를 부르지 않고 정해 둔 가짜 답을 흘려보내요(개발·테스트용) */
  mockAi: env('MOCK_AI') === '1',
  /** 1이면 Supabase 없이 기기 아이디로 사용자를 구분하고 메모리에 기록해요(개발·테스트용) */
  devAuth: env('SOKMAL_DEV_AUTH') === '1',
  /** 개발 모드에서 횟수·비용을 남길 파일 경로(내 컴퓨터 시험용). 비어 있으면 메모리(서버를 끄면 사라짐) */
  localDataFile: env('SOKMAL_LOCAL_DATA'),
};

export const supabaseOn = () => !!(config.supabaseUrl && config.supabaseAnonKey && config.supabaseServiceKey);

/** AI를 돌릴 준비가 됐는지. 안 됐으면 이유 */
export function aiNotReady(): string | null {
  if (config.mockAi) return null;
  if (!config.anthropicKey) return 'ANTHROPIC_API_KEY 없음';
  if (!(config.monthlyBudgetKrw > 0)) return 'MONTHLY_BUDGET_KRW 없음';
  if (!(config.usdKrw > 0)) return 'USD_KRW 없음';
  return null;
}
