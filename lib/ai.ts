// Anthropic API 호출 (서버에서만). 스트리밍으로 글자를 흘려보내고, 끝나면 사용량을 돌려준다.
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config';
import type { Job } from './prompts/build';

export type AiResult = {
  text: string;
  stopReason: string | null;
  usage: Anthropic.Beta.BetaUsage | null;
  model: string;
};

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: config.anthropicKey }));

/** 거절(refusal) 시 서버가 다른 모델로 이어 쓰는 기능을 지원하는 모델 */
const SUPPORTS_FALLBACK = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-2', 'claude-fable-5-1']);

export async function runAi(job: Job, signal: AbortSignal, onText: (delta: string) => void): Promise<AiResult> {
  const model = job.tier === 'light' ? config.modelLight : config.modelMain;
  if (config.mockAi) return mockRun(job, model, signal, onText);

  const fallback = SUPPORTS_FALLBACK.has(model);
  const stream = getClient().beta.messages.stream(
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
  return { text, stopReason: msg.stop_reason, usage: msg.usage, model: msg.model || model };
}

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
    if (signal.aborted) throw new Anthropic.APIUserAbortError();
    await new Promise((r) => setTimeout(r, 8));
    onText(p);
  }
  const usage = { input_tokens: 1000, output_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, iterations: null } as unknown as Anthropic.Beta.BetaUsage;
  return { text, stopReason: 'end_turn', usage, model: model + ' (mock)' };
}
