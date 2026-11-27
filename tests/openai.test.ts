// OpenAI로 바꾼 부분 확인 (11-27): 실제 OpenAI는 부르지 않고, SDK 이벤트 모양 그대로 흉내 낸 가짜 스트림으로 확인
import { afterEach, describe, expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import { readOpenAIStream } from '@/lib/ai';
import { openaiPrices, openaiUsage } from '@/lib/budget';

type Ev = OpenAI.Responses.ResponseStreamEvent;
async function* events(list: unknown[]) {
  for (const e of list) yield e as Ev;
}
const usage = { input_tokens: 1_000_000, input_tokens_details: { cached_tokens: 400_000, cache_write_tokens: 100_000 }, output_tokens: 1_000_000 };
const PRICES = { OPENAI_PRICE_INPUT: '2', OPENAI_PRICE_CACHED_INPUT: '0.5', OPENAI_PRICE_OUTPUT: '8' } as unknown as NodeJS.ProcessEnv;

describe('OpenAI 스트림 읽기', () => {
  it('글자를 흘려보내고, 끝나면 토큰·비용을 셈', async () => {
    const seen: string[] = [];
    const r = await readOpenAIStream(
      events([
        { type: 'response.created', response: {} },
        { type: 'response.output_text.delta', delta: '## 독백\n' },
        { type: 'response.output_text.delta', delta: '엄마, 그날.' },
        { type: 'response.completed', response: { model: 'some-model-2026', usage } },
      ]),
      'some-model',
      (d) => seen.push(d),
      PRICES,
    );
    expect(seen.join('')).toBe('## 독백\n엄마, 그날.');
    expect(r.text).toBe('## 독백\n엄마, 그날.');
    expect(r.stop).toBe('end');
    expect(r.model).toBe('some-model-2026');
    expect(r.tokens).toEqual({ input: 500_000, cacheRead: 400_000, cacheWrite: 100_000, output: 1_000_000 });
    // (50만+10만)×$2 + 40만×$0.5 + 100만×$8 = 1.2 + 0.2 + 8 = 9.4
    expect(r.usd).toBeCloseTo(9.4, 6);
  });
  it('길어서 끊기면 length', async () => {
    const r = await readOpenAIStream(
      events([
        { type: 'response.output_text.delta', delta: '반쯤' },
        { type: 'response.incomplete', response: { incomplete_details: { reason: 'max_output_tokens' }, usage } },
      ]),
      'm',
      () => {},
    );
    expect(r.stop).toBe('length');
    expect(r.text).toBe('반쯤');
  });
  it('거절이면 refusal (내용 필터로 멈춘 것도)', async () => {
    const a = await readOpenAIStream(events([{ type: 'response.refusal.delta', delta: '도와드릴 수 없어요' }, { type: 'response.completed', response: { usage } }]), 'm', () => {});
    expect(a.stop).toBe('refusal');
    const b = await readOpenAIStream(events([{ type: 'response.incomplete', response: { incomplete_details: { reason: 'content_filter' }, usage } }]), 'm', () => {});
    expect(b.stop).toBe('refusal');
  });
  it('실패·오류 이벤트는 오류로', async () => {
    await expect(readOpenAIStream(events([{ type: 'response.failed', response: { error: { message: 'x' } } }]), 'm', () => {})).rejects.toThrow(/실패/);
    await expect(readOpenAIStream(events([{ type: 'error', message: 'boom' }]), 'm', () => {})).rejects.toThrow(/boom/);
  });
});

describe('OpenAI 비용', () => {
  it('가격 3개가 다 있어야 비용을 셈, 하나라도 없으면 null', () => {
    expect(openaiPrices(PRICES)).toEqual({ input: 2, cached: 0.5, output: 8 });
    expect(openaiPrices({ OPENAI_PRICE_INPUT: '2', OPENAI_PRICE_OUTPUT: '8' } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(openaiUsage(usage, {} as NodeJS.ProcessEnv).usd).toBeNull();
    expect(openaiUsage(null, PRICES)).toEqual({ tokens: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }, usd: 0 });
  });
});

describe('회사 선택과 준비 확인', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  const load = async (env: Record<string, string>) => {
    vi.resetModules();
    for (const k of ['AI_PROVIDER', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'ANTHROPIC_API_KEY', 'MONTHLY_BUDGET_KRW', 'USD_KRW', 'MOCK_AI']) vi.stubEnv(k, env[k] ?? '');
    return import('@/lib/config');
  };
  it('OpenAI 키가 있으면 OpenAI, 키와 모델 이름이 있으면 준비 끝(예산은 선택)', async () => {
    const c = await load({ OPENAI_API_KEY: 'sk-test', OPENAI_MODEL: 'some-model' });
    expect(c.config.provider).toBe('openai');
    expect(c.aiNotReady()).toBeNull();
    expect(c.modelFor('light')).toBe('some-model');
    expect(c.appBudgetActive(true)).toBe(false); // 금액·환율이 없으면 앱 예산은 안 셈
  });
  it('모델 이름이 없으면 AI를 열지 않음', async () => {
    const c = await load({ OPENAI_API_KEY: 'sk-test' });
    expect(c.aiNotReady()).toMatch(/OPENAI_MODEL/);
  });
  it('Anthropic 키만 있으면 Anthropic (예산 필수 규칙 그대로)', async () => {
    const c = await load({ ANTHROPIC_API_KEY: 'x' });
    expect(c.config.provider).toBe('anthropic');
    expect(c.aiNotReady()).toMatch(/MONTHLY_BUDGET_KRW/);
  });
  it('금액·환율·가격이 다 있으면 앱도 예산을 셈', async () => {
    const c = await load({ OPENAI_API_KEY: 'k', OPENAI_MODEL: 'm', MONTHLY_BUDGET_KRW: '200000', USD_KRW: '1400' });
    expect(c.appBudgetActive(true)).toBe(true);
    expect(c.appBudgetActive(false)).toBe(false);
  });
});

describe('DB 없는 운영', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  const load = async (env: Record<string, string>) => {
    vi.resetModules();
    for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SOKMAL_DEV_AUTH', 'SOKMAL_LOCAL_DATA', 'SOKMAL_INVITE_CODES']) vi.stubEnv(k, env[k] ?? '');
    (globalThis as { __sokmalMem?: unknown }).__sokmalMem = undefined;
    return import('@/lib/server');
  };
  it('DB도 초대 코드도 없으면 저장소가 없어 AI를 열지 않음', async () => {
    const s = await load({});
    expect(s.getStore()).toBeNull();
  });
  it('초대 코드가 있으면 코드 하나 = 사용자 하나 (코드 자체는 남기지 않음)', async () => {
    const s = await load({ SOKMAL_INVITE_CODES: '482913,705162' });
    expect(s.getStore()).not.toBeNull();
    const a = await s.userIdOf(new Request('http://x/', { headers: { 'x-sokmal-invite': '482913' } }));
    const b = await s.userIdOf(new Request('http://x/', { headers: { 'x-sokmal-invite': ' 482913 ' } }));
    const c = await s.userIdOf(new Request('http://x/', { headers: { 'x-sokmal-invite': '705162' } }));
    expect(a).toMatch(/^inv-[0-9a-f]{16}$/);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toContain('482913');
    expect(await s.userIdOf(new Request('http://x/', { headers: { 'x-sokmal-invite': '111111' } }))).toBeNull();
  });
});

describe('오류 원인 기록 (11-27)', () => {
  it('상태·종류와 설명을 남기고 키는 가림', async () => {
    const { aiErrorDetail } = await import('@/lib/ai');
    const e = Object.assign(new Error('Incorrect API key provided: sk-proj-abcd1234efgh. You can find your API key at …'), { status: 401, code: 'invalid_api_key' });
    const d = aiErrorDetail(e);
    expect(d.startsWith('401 invalid_api_key · Incorrect API key provided: sk-…')).toBe(true);
    expect(d).not.toContain('abcd1234');
  });
});
