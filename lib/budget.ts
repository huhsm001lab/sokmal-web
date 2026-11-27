// AI 비용 계산. 가격은 Anthropic 공식 API 요금(100만 토큰당 달러, 2026-11 기준)이에요.
// 캐시 쓰기는 입력가의 1.25배(5분 캐시), 캐시 읽기는 표에 있는 값이에요.
import type Anthropic from '@anthropic-ai/sdk';

type Price = { in: number; out: number; cacheWrite: number; cacheRead: number };
const PRICES: Record<string, Price> = {
  'claude-sonnet-5-5': { in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  'claude-sonnet-5': { in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  'claude-opus-5-5': { in: 4, out: 20, cacheWrite: 5, cacheRead: 0.2 },
  // Haiku 5.5: 입력 10만 토큰까지의 값. 캐시 읽기는 입력가의 0.1배로 잡음(표에 따로 없음)
  'claude-haiku-5-5': { in: 0.1, out: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
};
const HAIKU_LONG: Price = { in: 0.5, out: 2.5, cacheWrite: 0.625, cacheRead: 0.05 };
/** 모르는 모델이면 비싼 쪽(Opus 5.5)으로 셈 → 예산을 넘기지 않는 쪽으로 틀림 */
const FALLBACK_PRICE = PRICES['claude-opus-5-5'];

function priceOf(model: string, promptTokens: number): Price {
  if (model === 'claude-haiku-5-5' && promptTokens > 100_000) return HAIKU_LONG;
  return PRICES[model] ?? FALLBACK_PRICE;
}

export type Tokens = { input: number; output: number; cacheWrite: number; cacheRead: number };

function usdOf(model: string, t: Tokens) {
  const p = priceOf(model, t.input + t.cacheWrite + t.cacheRead);
  return (t.input * p.in + t.output * p.out + t.cacheWrite * p.cacheWrite + t.cacheRead * p.cacheRead) / 1_000_000;
}

/** Anthropic 응답 usage → 토큰 합계와 달러 비용. 거절 뒤 다른 모델로 넘어간 경우(iterations)는 시도마다 그 모델 값으로 셈 */
export function anthropicUsage(usage: Anthropic.Beta.BetaUsage | null | undefined, requestedModel: string) {
  const tokens: Tokens = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  if (!usage) return { tokens, usd: 0 };
  let usd = 0;
  const its = (usage.iterations ?? []).filter((x) => x.type === 'message' || x.type === 'fallback_message');
  if (its.length) {
    for (const it of its) {
      const t = {
        input: it.input_tokens ?? 0,
        output: it.output_tokens ?? 0,
        cacheWrite: it.cache_creation_input_tokens ?? 0,
        cacheRead: it.cache_read_input_tokens ?? 0,
      };
      tokens.input += t.input;
      tokens.output += t.output;
      tokens.cacheWrite += t.cacheWrite;
      tokens.cacheRead += t.cacheRead;
      usd += usdOf(('model' in it && it.model) || requestedModel, t);
    }
  } else {
    tokens.input = usage.input_tokens ?? 0;
    tokens.output = usage.output_tokens ?? 0;
    tokens.cacheWrite = usage.cache_creation_input_tokens ?? 0;
    tokens.cacheRead = usage.cache_read_input_tokens ?? 0;
    usd = usdOf(requestedModel, tokens);
  }
  return { tokens, usd };
}

/** 달러 → 원 (소수 둘째 자리) */
export const toKrw = (usd: number, usdKrw: number) => Math.round(usd * usdKrw * 100) / 100;

/** Anthropic usage → 토큰 합계와 원화 비용 */
export function costOf(usage: Anthropic.Beta.BetaUsage | null | undefined, requestedModel: string, usdKrw: number) {
  const { tokens, usd } = anthropicUsage(usage, requestedModel);
  return { tokens, krw: toKrw(usd, usdKrw) };
}

/* ---------- OpenAI ----------
   가격은 코드에 박지 않고 환경변수로 받아요(100만 토큰당 달러): OPENAI_PRICE_INPUT / OPENAI_PRICE_CACHED_INPUT / OPENAI_PRICE_OUTPUT.
   하나라도 없으면 비용을 셀 수 없다고 보고(null), 앱 쪽 월 예산은 건너뛰어요 → OpenAI 대시보드 한도에 맡김. */
export function openaiPrices(env: NodeJS.ProcessEnv = process.env) {
  const n = (k: string) => {
    const v = Number((env[k] ?? '').trim());
    return (env[k] ?? '').trim() !== '' && Number.isFinite(v) && v >= 0 ? v : null;
  };
  const input = n('OPENAI_PRICE_INPUT');
  const cached = n('OPENAI_PRICE_CACHED_INPUT');
  const output = n('OPENAI_PRICE_OUTPUT');
  return input === null || cached === null || output === null ? null : { input, cached, output };
}

/** OpenAI usage(입력 토큰 안에 캐시 읽기·쓰기가 포함됨) → 토큰 나눔 + 달러 비용(가격이 없으면 null).
    캐시 쓰기는 따로 값이 없어서 일반 입력 가격으로 셈 */
export function openaiUsage(
  u: { input_tokens: number; output_tokens: number; input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number } | null } | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
) {
  const cacheRead = u?.input_tokens_details?.cached_tokens ?? 0;
  const cacheWrite = u?.input_tokens_details?.cache_write_tokens ?? 0;
  const tokens: Tokens = {
    input: Math.max(0, (u?.input_tokens ?? 0) - cacheRead - cacheWrite),
    cacheRead,
    cacheWrite,
    output: u?.output_tokens ?? 0,
  };
  const p = openaiPrices(env);
  const usd = p ? ((tokens.input + tokens.cacheWrite) * p.input + tokens.cacheRead * p.cached + tokens.output * p.output) / 1_000_000 : null;
  return { tokens, usd };
}
