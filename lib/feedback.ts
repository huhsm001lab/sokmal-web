// 의견·후기 문서 검사 (테스터가 보내는 것이라 모양·크기를 제한)
import type { FeedbackDoc } from './data/types';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** 글자·숫자·참거짓만 남기고, 글자는 길이 제한 */
function prim(v: unknown, max = 300): string | number | boolean | undefined {
  if (typeof v === 'string') return v.slice(0, max);
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v;
  return undefined;
}
function flat(o: unknown, maxKeys = 40, maxLen = 300): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!isObj(o)) return out;
  for (const [k, v] of Object.entries(o).slice(0, maxKeys)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) continue;
    const p = prim(v, maxLen);
    if (p !== undefined) out[k] = p;
  }
  return out;
}

export function cleanFeedback(v: unknown): FeedbackDoc | null {
  if (!isObj(v)) return null;
  const entries = Array.isArray(v.entries) ? v.entries.slice(-300).map((e) => flat(e)) : [];
  let review: FeedbackDoc['review'] = null;
  if (isObj(v.review)) {
    const r = v.review;
    review = { ...flat(r, 20, 1000), answers: flat(r.answers, 20, 60) };
  }
  const reviewSkip = typeof v.reviewSkip === 'number' && Number.isFinite(v.reviewSkip) ? v.reviewSkip : null;
  return { entries, review, reviewSkip, updatedAt: Date.now() };
}
