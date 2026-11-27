// 서버 환경변수. 값의 뜻은 .env.example 을 보세요.
const env = (k: string) => (process.env[k] ?? '').trim();

export const config = {
  /** AI 회사: openai | anthropic. 비워 두면 OPENAI_API_KEY 가 있으면 openai (11-27 송무 결정: OpenAI 사용) */
  get provider(): 'openai' | 'anthropic' {
    const p = env('AI_PROVIDER').toLowerCase();
    if (p === 'openai' || p === 'anthropic') return p;
    return env('OPENAI_API_KEY') || !env('ANTHROPIC_API_KEY') ? 'openai' : 'anthropic';
  },
  openaiKey: env('OPENAI_API_KEY'),
  /** OpenAI 모델 이름은 코드에 박지 않음(송무가 고름) */
  openaiModel: env('OPENAI_MODEL'),
  openaiModelLight: env('OPENAI_MODEL_LIGHT'),
  /** 선택: none | minimal | low | medium | high … (모델이 지원할 때만) */
  openaiEffort: env('OPENAI_REASONING_EFFORT'),
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

/** 지금 쓰는 모델 이름 (본 호출 / 가벼운 호출) */
export function modelFor(tier: 'main' | 'light'): string {
  if (config.provider === 'openai') return tier === 'light' ? config.openaiModelLight || config.openaiModel : config.openaiModel;
  return tier === 'light' ? config.modelLight : config.modelMain;
}

/** AI를 돌릴 준비가 됐는지. 안 됐으면 이유 */
export function aiNotReady(): string | null {
  if (config.mockAi) return null;
  if (config.provider === 'openai') {
    // 송무 결정(11-27): 비용의 진짜 천장은 OpenAI 대시보드 한도. 앱 쪽 예산은 값이 있을 때만 셈
    if (!config.openaiKey) return 'OPENAI_API_KEY 없음';
    if (!config.openaiModel) return 'OPENAI_MODEL 없음';
    return null;
  }
  if (!config.anthropicKey) return 'ANTHROPIC_API_KEY 없음';
  if (!(config.monthlyBudgetKrw > 0)) return 'MONTHLY_BUDGET_KRW 없음';
  if (!(config.usdKrw > 0)) return 'USD_KRW 없음';
  return null;
}

/** 앱 쪽 월 예산을 셀 수 있는지 (금액·환율이 있고, 비용을 셀 수 있는 회사·가격일 때) */
export function appBudgetActive(pricesKnown: boolean): boolean {
  return !config.mockAi && config.monthlyBudgetKrw > 0 && config.usdKrw > 0 && pricesKnown;
}
