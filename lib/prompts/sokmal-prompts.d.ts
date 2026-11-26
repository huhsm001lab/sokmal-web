// sokmal-prompts.js(원문 그대로 옮긴 프롬프트)의 타입 선언
/* eslint-disable @typescript-eslint/no-explicit-any */
export const EXPERT: string;
export const MONO_EXAMPLE: string;
export const SRC_RULE: string;
export const TITLE_RULE: string;
export const CHECK_RULE: string;
export const PRO_RULES: string;
export const CLOSING: string;
export function imagePromptOf(p: { f: Record<string, string>; purpose: string; answers: string[] }): string;
export function parseDesign(t: string): string | null;
export function monoRules(mtype: string): string;
export function memoBlock(memo: string): string;
export function qaBlock(qa: { q: string; a: string }[] | null): string;
export function monoPrompt(c: any, qa: { q: string; a: string }[] | null, mMode: string, hist: string[]): string;
export function askPrompt(c: any): string;
export function examPromptOf(p: { text: string; work: string; part: boolean; mine: string }): string;
export function proPromptOf(p: { text: string; work: string; char: string; part: boolean; mine: string; last: boolean }): string;
export const examFollowWrap: (q: string) => string;
export const proFollowWrap: (q: string, info: { turn: number; last: boolean }) => string;
export const monoChatWrap: (q: string) => string;
export function designText(d: Record<string, string>): string;
export function designPromptOf(d: Record<string, string>): string;
/** 예시 프롬프트(공개 저장소용)일 때만 true. 원문에는 없음 */
export const IS_EXAMPLE: boolean | undefined;
