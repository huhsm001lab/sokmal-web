// AI 호출 (서버에서만). 스트리밍으로 글자를 흘려보내고, 끝나면 사용량을 돌려준다.
// 회사: OpenAI(11-27 송무 결정, 기본) 또는 Anthropic. 결과는 같은 모양으로 맞춘다.
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { anthropicUsage, openaiPrices, openaiUsage, type Tokens } from './budget';
import { config, modelFor } from './config';
import type { Job } from './prompts/build';

export type AiResult = {
  text: string;
  /** end: 끝까지 씀 / length: 길어서 끊김 / refusal: 거절 */
  stop: 'end' | 'length' | 'refusal';
  tokens: Tokens;
  /** 달러 비용. 가격을 모르면 null */
  usd: number | null;
  model: string;
};

/** 중단은 회사와 상관없이 이 오류로 */
export class AiAborted extends Error {}
/** 회사 쪽 오류를 화면 문구 코드로 */
export function aiErrorCode(e: unknown): string {
  if (e instanceof AiAborted || e instanceof Anthropic.APIUserAbortError || e instanceof OpenAI.APIUserAbortError) return 'cancelled';
  if (e instanceof Anthropic.RateLimitError || e instanceof OpenAI.RateLimitError) return 'busy';
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return 'not_configured';
  if (e instanceof OpenAI.AuthenticationError || e instanceof OpenAI.PermissionDeniedError) return 'not_configured';
  if (e instanceof Anthropic.BadRequestError || e instanceof OpenAI.BadRequestError) return 'bad_request';
  if (e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) return 'busy';
  if (e instanceof OpenAI.InternalServerError || e instanceof OpenAI.APIConnectionError) return 'busy';
  return 'error';
}

/** 관리자 기록용 오류 원인: 상태 코드·종류 + 짧은 설명. 키처럼 보이는 글자는 가린다 */
export function aiErrorDetail(e: unknown): string {
  const o = (e && typeof e === 'object' ? e : {}) as { status?: unknown; code?: unknown; type?: unknown; message?: unknown };
  const head = [o.status, o.code || o.type].filter((x) => x != null && x !== '').join(' ');
  const msg = typeof o.message === 'string' ? o.message : e instanceof Error ? e.message : String(e);
  const safe = msg.replace(/(sk|rk|pk)-[A-Za-z0-9_*\-]{4,}/g, '$1-…').replace(/\s+/g, ' ').trim();
  return (head ? head + ' · ' : '') + safe.slice(0, 200);
}

export async function runAi(job: Job, signal: AbortSignal, onText: (delta: string) => void): Promise<AiResult> {
  const model = modelFor(job.tier);
  if (config.mockAi) return mockRun(job, model, signal, onText);
  return config.provider === 'openai' ? runOpenAI(job, model, signal, onText) : runAnthropic(job, model, signal, onText);
}

/** 대화 기록을 문자열 메시지로 (프롬프트 조립은 문자열만 만듦) */
function plainMessages(job: Job) {
  return job.messages.map((m) => ({
    role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
    content: typeof m.content === 'string' ? m.content : '',
  }));
}

/* ---------- OpenAI (Responses API 스트리밍) ---------- */
let openai: OpenAI | null = null;
const getOpenAI = () => (openai ??= new OpenAI({ apiKey: config.openaiKey }));

/** OpenAI 스트림 이벤트를 읽어 결과로 (테스트에서 가짜 이벤트로 확인) */
export async function readOpenAIStream(
  events: AsyncIterable<OpenAI.Responses.ResponseStreamEvent>,
  model: string,
  onText: (delta: string) => void,
  env: NodeJS.ProcessEnv = process.env,
): Promise<AiResult> {
  let text = '';
  let refused = false;
  let stop: AiResult['stop'] = 'end';
  let final: OpenAI.Responses.Response | null = null;
  for await (const ev of events) {
    switch (ev.type) {
      case 'response.output_text.delta':
        text += ev.delta;
        onText(ev.delta);
        break;
      case 'response.refusal.delta':
        refused = true;
        break;
      case 'response.completed':
        final = ev.response;
        break;
      case 'response.incomplete':
        final = ev.response;
        stop = ev.response.incomplete_details?.reason === 'content_filter' ? 'refusal' : 'length';
        break;
      case 'response.failed':
        throw new Error('OpenAI 응답 실패: ' + (ev.response.error?.message ?? '알 수 없음'));
      case 'error':
        throw new Error('OpenAI 오류: ' + ev.message);
    }
  }
  if (refused && !text.trim()) stop = 'refusal';
  const { tokens, usd } = openaiUsage(final?.usage, env);
  return { text, stop, tokens, usd, model: final?.model || model };
}

async function runOpenAI(job: Job, model: string, signal: AbortSignal, onText: (d: string) => void): Promise<AiResult> {
  const effort = config.openaiEffort as OpenAI.ReasoningEffort | '';
  const stream = await getOpenAI().responses.create(
    {
      model,
      input: plainMessages(job),
      stream: true,
      max_output_tokens: job.tier === 'light' ? 8000 : 32000,
      ...(effort ? { reasoning: { effort } } : {}),
    },
    { signal },
  );
  return readOpenAIStream(stream, model, onText);
}

/* ---------- Anthropic ---------- */
let anthropic: Anthropic | null = null;
const getAnthropic = () => (anthropic ??= new Anthropic({ apiKey: config.anthropicKey }));

/** 거절(refusal) 시 서버가 다른 모델로 이어 쓰는 기능을 지원하는 모델 */
const SUPPORTS_FALLBACK = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-2', 'claude-fable-5-1']);

async function runAnthropic(job: Job, model: string, signal: AbortSignal, onText: (d: string) => void): Promise<AiResult> {
  const fallback = SUPPORTS_FALLBACK.has(model);
  const stream = getAnthropic().beta.messages.stream(
    {
      model,
      max_tokens: job.tier === 'light' ? 8000 : 32000,
      messages: job.messages,
      // 같은 본문으로 이어서 묻는 대화가 많아서 자동 캐싱을 켠다(마지막 블록까지 캐시)
      cache_control: { type: 'ephemeral' },
      output_config: { effort: job.tier === 'light' ? config.effortLight : config.effortMain },
      ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    },
    { signal },
  );
  stream.on('text', (delta) => onText(delta));
  const msg = await stream.finalMessage();
  const text = msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const used = msg.model || model;
  const { tokens, usd } = anthropicUsage(msg.usage, used);
  const stop = msg.stop_reason === 'refusal' ? 'refusal' : msg.stop_reason === 'max_tokens' ? 'length' : 'end';
  return { text, stop, tokens, usd, model: used };
}

/** 지금 설정으로 비용(달러)을 셀 수 있는지 */
export const pricesKnown = () => (config.provider === 'openai' ? openaiPrices() !== null : true);

/* ---------- 가짜 답 (MOCK_AI=1) ---------- */
const MOCK: Record<string, string> = {
  interpret_exam: `## 줄거리
- (가짜 답) 시험용 줄거리예요.
## 주요 인물과 관계
- 인물 A: 주인공 / 인물 B의 딸
## 주제로 읽을 수 있는 것
- 떠나지 못하는 이야기로 읽을 수도 있어요 (1막)
## 인물별로 보이는 것
- 인물 A: 말을 자주 끊어요 (1막) / 속마음은 두려움일 수도, 미안함일 수도 있어요
## 독백 후보 구간
- 1막 끝 / 떠나기 전날 밤 / 망설임이 보일 수 있어요 / 1분
- 3막 중간 / 편지를 읽는 장면 / 체념이 보일 수 있어요 / 2분
## 내 분석을 위한 한 가지
- 이 인물은 왜 지금 말할까요?`,
  interpret_pro: `(가짜 답) 2장에서 인물이 대답을 미루는 자리를 보면 두려움으로 읽을 수도 있어요.
- 반대로 보면 상대를 지키려는 침묵일 수도 있어요.
어느 쪽이 걸리나요?
[메모] 원하는 것: 떠나도 된다는 말 ｜ 숨기는 것: 겁 ｜ 읽기: 침묵은 보호`,
  mono: `[설계] 미안하다는 말 ｜ 계기 ｜ 쌓임 ｜ 전환 ｜ 요구
## 독백
(가짜 답) 엄마, 그날 나 일부러 늦게 들어간 거야.
[상대] (고개를 돌린다)
알아. 다 알아서 그런 거잖아.
[상대] 밥은 먹었니.
…응. 먹었어. 이제 그만 물어봐.
## 더 나답게 만들려면
- 그날 실제로 몇 시에 들어갔나요?
- 엄마가 자주 하던 말이 있나요?`,
  mono_ask: `Q. 이 말을 누구에게 하나요? 부르는 호칭까지 알려 주세요
Q. 그때 실제로 있었던 일 하나를 떠올려 주세요
Q. 오늘 그 사람에게 꼭 전하고 싶은 한마디는요?`,
  image: `## 내 답에서 보이는 모습
(가짜 답) 편안해 보일 수도 있어요 (1번 답)
## 이미지 키워드
- 편안함 (1번)
## 내 답에서 보이는 강점
- 듣는 힘 (4번)
## 서로 다른 답이 만나는 곳
- 편안함 + 차가운 거리두기
## 이런 역에서 이런 면이 보일 수도 있어요
- 비밀을 지키는 친구 역에서 절제가 보일 수도 있어요
## 찾는 것에 맞춘 참고
- 말을 아끼는 결
## 나에게 물어볼 것
- 내가 가장 편할 때는 언제일까요?
독백 키워드: 절제, 그리움, 친구`,
  chat: `(가짜 답) 이어서 답해요. 이 질문에만 짧게 답했어요.
[메모] 원하는 것: 인정 ｜ 숨기는 것: 미련 ｜ 읽기: 이어진 읽기`,
  design: `## 이미 갖춘 것\n- (가짜 답)`,
};

function mockKey(job: Job): string {
  if (job.messages.length > 1) return 'chat';
  if (job.tier === 'light') return 'mono_ask';
  if (job.base?.kind === 'interpret') {
    if (job.base.input.text.includes('MOCK_CHECK')) return 'check';
    return 'interpret_' + job.base.mode;
  }
  return job.base?.kind ?? 'design';
}

async function mockRun(job: Job, model: string, signal: AbortSignal, onText: (d: string) => void): Promise<AiResult> {
  const key = mockKey(job);
  const text = key === 'check' ? '[확인] 붙여 넣은 글이 희곡이 맞나요?' : (MOCK[key] ?? MOCK.design);
  const parts = text.match(/[\s\S]{1,24}/g) ?? [];
  for (const p of parts) {
    if (signal.aborted) throw new AiAborted();
    await new Promise((r) => setTimeout(r, 8));
    onText(p);
  }
  return { text, stop: 'end', tokens: { input: 1000, output: 300, cacheWrite: 0, cacheRead: 0 }, usd: 0, model: (model || 'mock') + ' (mock)' };
}
