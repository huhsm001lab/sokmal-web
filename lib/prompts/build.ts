// 브라우저가 보낸 요청(무슨 기능 + 입력값)을 검사해서, 서버에서 프롬프트를 조립한다.
// 브라우저는 프롬프트 문자열을 보내지 않는다. 우리 AI 키로 아무 글이나 돌릴 수 없게 하려는 것이다.
import type Anthropic from '@anthropic-ai/sdk';
import * as P from './sokmal-prompts.js';
import { LIMITS, type CounterKey } from '../limits';
import { applyMonoSwitches, DEFAULT_SWITCHES, switchTag, type PromptSwitches } from './switches';
import { appendGuide, applyMakeGuide, EMPTY_GUIDE, type MonoGuide } from '../guide';
import { appendNote, matchNote, type WorkNote } from '../notes';

export class BadInput extends Error {
  constructor(public code: 'bad_request' | 'prompt_too_large', msg: string) {
    super(msg);
  }
}

/* ---------- 검사 도구 ---------- */
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
function str(v: unknown, max: number, field: string, tooLarge = false): string {
  if (v == null) return '';
  if (typeof v !== 'string') throw new BadInput('bad_request', field + ' 형식');
  if (v.length > max) throw new BadInput(tooLarge ? 'prompt_too_large' : 'bad_request', field + ' 길이');
  return v;
}
function strArr(v: unknown, maxItems: number, maxLen: number, field: string): string[] {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > maxItems) throw new BadInput('bad_request', field + ' 목록');
  return v.map((x, i) => str(x, maxLen, `${field}[${i}]`));
}
function oneOf<T extends string>(v: unknown, opts: readonly T[], field: string): T {
  if (typeof v === 'string' && (opts as readonly string[]).includes(v)) return v as T;
  throw new BadInput('bad_request', field + ' 값');
}
const bool = (v: unknown) => v === true;

/* ---------- 요청 모양 ---------- */
export type Mode = 'exam' | 'pro';
export type InterpretBase = {
  kind: 'interpret';
  mode: Mode;
  input: { text: string; work: string; part: boolean; mine: string; char: string };
  last: boolean;
};
export type MonoCtx = {
  pro: boolean;
  kw: {
    mtype: string;
    writer: string;
    emotion: string[];
    situation: string[];
    listener: string[];
    mood: string[];
    temper: string[];
    hide: string;
    length: string;
  };
  story: string;
  draft: string;
  memo: string;
  src: string;
  srcFrom: string;
  mat: string;
};
export type QA = { q: string; a: string };
export type MonoBase = { kind: 'mono'; c: MonoCtx; qa: QA[] | null; mMode: 'new' | 'refine' | 'adapt'; hist: string[] };
export type ImageBase = {
  kind: 'image';
  input: {
    f: { self: string; char: string; look: string; strength: string; others: string; want: string };
    purpose: string;
    answers: string[];
  };
};
export type DesignBase = { kind: 'design'; d: Record<string, string> };
export type Base = InterpretBase | MonoBase | ImageBase | DesignBase;

/** 서버가 할 일 하나 */
export type Job = {
  feature: string; // 기록용 이름
  tier: 'main' | 'light';
  messages: Anthropic.Beta.BetaMessageParam[];
  counter: { key: CounterKey; kind: 'run' | 'follow'; limit: number } | null;
  /** 이어서 묻기에 쓸 수 있도록 브라우저에 돌려줄 원래 요청(서버가 정한 값 포함) */
  base: Base | null;
  /** [확인]·[모름] 답이면 횟수를 돌려줄지 */
  refundMeta: boolean;
  /** 검수 기준 (있으면 1차 답을 이 기준으로 검수·수정한 최종본을 보냄) */
  review?: string;
  /** 해석에 쓴 검수된 작품 노트 제목 (화면에 표시) */
  note?: string;
};

/** 오늘 남은 횟수를 알려 주는 함수 (전문 해석의 "오늘 마지막 답" 판단에 씀) */
export type LeftFn = (key: CounterKey) => number;

/* ---------- 입력 정리 ---------- */
function interpretInput(v: unknown) {
  const o = isObj(v) ? v : {};
  return {
    text: str(o.text, LIMITS.maxText, '본문', true),
    work: str(o.work, 200, '작품명'),
    part: bool(o.part),
    mine: str(o.mine, 3000, '내 생각'),
    char: str(o.char, 200, '인물'),
  };
}
function monoCtx(v: unknown): MonoCtx {
  if (!isObj(v)) throw new BadInput('bad_request', '독백 재료');
  const kw = isObj(v.kw) ? v.kw : {};
  return {
    pro: bool(v.pro),
    kw: {
      mtype: str(kw.mtype, 40, '독백 종류') || '입시 독백',
      writer: str(kw.writer, 40, '쓰는 형식') || '희곡 작가',
      emotion: strArr(kw.emotion, 2, 30, '감정'),
      situation: strArr(kw.situation, 1, 30, '상황'),
      listener: strArr(kw.listener, 2, 30, '상대'),
      mood: strArr(kw.mood, 1, 30, '분위기'),
      temper: strArr(kw.temper, 2, 30, '기질'),
      hide: str(kw.hide, 40, '숨기는 방식'),
      length: str(kw.length, 10, '길이') || '1분',
    },
    story: str(v.story, 10000, '내 이야기'),
    draft: str(v.draft, 10000, '초안'),
    memo: str(v.memo, 1500, '내 이미지 메모'),
    src: str(v.src, LIMITS.adaptText, '번안 원문', true),
    srcFrom: str(v.srcFrom, 200, '출처'),
    mat: str(v.mat, 3000, '재료'),
  };
}
function qaList(v: unknown): QA[] | null {
  if (v == null) return null;
  if (!Array.isArray(v) || v.length > 3) throw new BadInput('bad_request', '답 목록');
  return v.map((x, i) => {
    const o = isObj(x) ? x : {};
    return { q: str(o.q, 300, `질문${i}`), a: str(o.a, 500, `답${i}`) };
  });
}
function imageInput(v: unknown): ImageBase['input'] {
  const o = isObj(v) ? v : {};
  const f = isObj(o.f) ? o.f : {};
  return {
    f: {
      self: str(f.self, 3000, '내 이미지'),
      char: str(f.char, 3000, '성격'),
      look: str(f.look, 3000, '외적 매력'),
      strength: str(f.strength, 3000, '장점'),
      others: str(f.others, 3000, '들은 이야기'),
      want: str(f.want, 3000, '하고 싶은 역'),
    },
    purpose: str(o.purpose, 60, '찾는 것') || '그냥 나를 알아보기',
    answers: strArr(o.answers, 10, 300, '고른 답'),
  };
}
const DESIGN_KEYS = ['form', 'work', 'premise', 'theme', 'characters', 'conflict', 'setting', 'events', 'material', 'plants'];
function designInput(v: unknown) {
  const o = isObj(v) ? v : {};
  const d: Record<string, string> = {};
  for (const k of DESIGN_KEYS) d[k] = str(o[k], 5000, k);
  return d;
}

/** 이어서 묻기의 바탕이 되는 원래 요청을 검사한다 (브라우저가 서버에게 받았던 base를 그대로 돌려보냄) */
function parseBase(v: unknown): Base {
  if (!isObj(v)) throw new BadInput('bad_request', '바탕 요청');
  switch (v.kind) {
    case 'interpret':
      return { kind: 'interpret', mode: oneOf(v.mode, ['exam', 'pro'] as const, '모드'), input: interpretInput(v.input), last: bool(v.last) };
    case 'mono':
      return {
        kind: 'mono',
        c: monoCtx(v.c),
        qa: qaList(v.qa),
        mMode: oneOf(v.mMode, ['new', 'refine', 'adapt'] as const, '독백 방식'),
        hist: strArr(v.hist, 4, 240, '이전 설계'),
      };
    case 'image':
      return { kind: 'image', input: imageInput(v.input) };
    case 'design':
      return { kind: 'design', d: designInput(v.d) };
    default:
      throw new BadInput('bad_request', '알 수 없는 기능');
  }
}

/* ---------- 프롬프트 조립 ---------- */
export function basePrompt(b: Base, sw: PromptSwitches = DEFAULT_SWITCHES, guide: MonoGuide = EMPTY_GUIDE, note: WorkNote | null = null): string {
  switch (b.kind) {
    case 'interpret':
    {
      const raw =
        b.mode === 'exam'
          ? P.examPromptOf({ text: b.input.text, work: b.input.work, part: b.input.part, mine: b.input.mine })
          : P.proPromptOf({ ...b.input, last: b.last });
      return appendGuide(appendNote(raw, note), b.mode === 'exam' ? guide.exam : guide.pro);
    }
    case 'mono':
      return applyMakeGuide(applyMonoSwitches(P.monoPrompt(b.c, b.qa, b.mMode, b.hist), sw), sw.monoRules ? guide.make : '', b.c.kw.mtype);
    case 'image':
      return appendGuide(P.imagePromptOf(b.input), guide.image);
    case 'design':
      return P.designPromptOf(b.d);
  }
}

function checkInterpret(b: InterpretBase) {
  if (b.mode === 'exam' && !b.input.text && !b.input.work) throw new BadInput('bad_request', '본문 또는 작품명');
  if (b.mode === 'pro' && !b.input.text) throw new BadInput('bad_request', '본문');
}
function checkMono(b: MonoBase) {
  if (b.mMode === 'refine' && !b.c.draft) throw new BadInput('bad_request', '초안');
  if (b.mMode === 'adapt' && !b.c.src) throw new BadInput('bad_request', '번안 원문');
}

const MAX_CHAT_TURNS = 40;

/** 요청 하나를 서버가 할 일로 바꾼다 */
export function buildJob(body: unknown, left: LeftFn, sw: PromptSwitches = DEFAULT_SWITCHES, guide: MonoGuide = EMPTY_GUIDE, notes: WorkNote[] = []): Job {
  const noteOf = (b: InterpretBase) => matchNote(notes, b.input.work, b.input.text);
  const tag = switchTag(sw) + (sw.monoRules && guide.make ? ' [제작 기준]' : '');
  if (!isObj(body)) throw new BadInput('bad_request', '요청');
  const user = (content: string): Anthropic.Beta.BetaMessageParam => ({ role: 'user', content });

  switch (body.kind) {
    case 'interpret': {
      const mode = oneOf(body.mode, ['exam', 'pro'] as const, '모드');
      const b: InterpretBase = { kind: 'interpret', mode, input: interpretInput(body.input), last: false };
      checkInterpret(b);
      // 원본과 같은 판단: 이번이 오늘 마지막 1번이면 마무리 답으로 (전문 모드)
      if (mode === 'pro') b.last = left('pro') === 1;
      const note = noteOf(b);
      return {
        ...(note ? { note: note.title } : {}),
        feature: '해석·' + mode + (note ? ' [작품 노트]' : ''),
        tier: 'main',
        messages: [user(basePrompt(b, sw, guide, note))],
        counter: { key: mode, kind: 'run', limit: LIMITS.daily[mode] },
        base: b,
        refundMeta: true,
      };
    }
    case 'mono': {
      const b = parseBase({ ...body, kind: 'mono' }) as MonoBase;
      checkMono(b);
      return {
        feature: '독백·' + b.mMode + tag,
        tier: 'main',
        messages: [user(basePrompt(b, sw, guide))],
        counter: { key: 'mono', kind: 'run', limit: LIMITS.daily.mono },
        base: b,
        refundMeta: true,
        ...(guide.reviewOn && guide.review ? { review: guide.review } : {}),
      };
    }
    case 'mono_ask': {
      const c = monoCtx(body.c);
      return { feature: '독백·질문', tier: 'light', messages: [user(P.askPrompt(c))], counter: null, base: null, refundMeta: false };
    }
    case 'image': {
      const b = parseBase({ ...body, kind: 'image' }) as ImageBase;
      const written = [b.input.f.self, b.input.f.char, b.input.f.look, b.input.f.strength].filter(Boolean).length;
      if (written === 0 && b.input.answers.length < 5) throw new BadInput('bad_request', '내 이미지 입력');
      return { feature: '내 이미지', tier: 'main', messages: [user(basePrompt(b, sw, guide))], counter: null, base: b, refundMeta: false };
    }
    case 'design': {
      const b = parseBase({ ...body, kind: 'design' }) as DesignBase;
      return { feature: '설계 점검', tier: 'main', messages: [user(basePrompt(b))], counter: null, base: b, refundMeta: false };
    }
    case 'chat': {
      const base = parseBase(body.base);
      const first = str(body.first, 40000, '첫 답');
      const q = str(body.q, 2000, '질문').trim();
      if (!q || !first) throw new BadInput('bad_request', '질문');
      if (!Array.isArray(body.turns) || body.turns.length >= MAX_CHAT_TURNS) throw new BadInput('prompt_too_large', '대화 길이');
      const turns = body.turns.map((t, i) => {
        const o = isObj(t) ? t : {};
        return { q: str(o.q, 2000, `질문${i}`), a: str(o.a, 40000, `답${i}`) };
      });

      let wrap: (q: string, info: { turn: number; last: boolean }) => string;
      let counter: Job['counter'] = null;
      if (base.kind === 'interpret') {
        checkInterpret(base);
        counter = { key: base.mode, kind: 'follow', limit: LIMITS.daily[base.mode] };
        wrap = base.mode === 'exam' ? (x) => P.examFollowWrap(x) : (x, info) => P.proFollowWrap(x, info);
      } else if (base.kind === 'mono' && base.c.pro) {
        wrap = (x) => P.monoChatWrap(x);
      } else {
        throw new BadInput('bad_request', '이 결과는 이어서 묻기를 쓰지 않음');
      }
      // 원본 브라우저 코드와 같은 순서로 대화를 다시 쌓는다
      const chatNote = base.kind === 'interpret' ? noteOf(base) : null;
      const msgs: Anthropic.Beta.BetaMessageParam[] = [user(basePrompt(base, sw, guide, chatNote)), { role: 'assistant', content: first }];
      turns.forEach((t, i) => {
        msgs.push(user(wrap(t.q, { turn: i + 2, last: false })));
        msgs.push({ role: 'assistant', content: t.a });
      });
      const last = base.kind === 'interpret' && base.mode === 'pro' ? left('pro') === 1 : false;
      msgs.push(user(wrap(q, { turn: turns.length + 2, last })));
      return {
        feature: base.kind === 'interpret' ? '해석·' + base.mode + '·이어서' : '독백·대화' + tag,
        tier: 'main',
        messages: msgs,
        counter,
        base,
        refundMeta: true,
      };
    }
    default:
      throw new BadInput('bad_request', '알 수 없는 기능');
  }
}

/** 공개 저장소의 예시 프롬프트로 돌고 있는지 (원문이 없을 때) */
export const usingExamplePrompts = P.IS_EXAMPLE === true;

export const isMetaReply = (t: string) => /^\s*\[(확인|모름)\]/.test(String(t));
