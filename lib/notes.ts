// 검수된 작품 노트 (11-28, 차별점 ③ "정보가 맞다"): 지정희곡의 줄거리·인물·독백 후보 위치를 사람이 검수해 관리자 화면에서 쌓는다.
// 해석할 때 작품명(또는 본문 첫 줄)이 노트 제목·별칭과 맞으면, 노트를 사실의 기준으로 프롬프트에 넣는다.
// 작품 원문 대사는 넣지 않는다(저작권). 노트는 저장소(Redis)에만 있다.

export type WorkNote = {
  id: string;
  title: string;
  aliases: string[];
  author: string;
  summary: string;
  characters: string;
  monoSpots: string;
  checkedBy: string;
  status: '검수됨' | '초안';
  updatedAt: string;
};

export const NOTE_MAX = 200;
const cut = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, n) : '');

/** 비교용 제목: 괄호·따옴표·띄어쓰기·대소문자 무시 */
export const normTitle = (s: string) => s.replace(/[\s〈〉<>《》「」『』'"“”‘’()[\]]/g, '').toLowerCase();

export function cleanNote(v: unknown, now = new Date()): WorkNote | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const title = cut(o.title, 100);
  if (!title) return null;
  const aliasesRaw = Array.isArray(o.aliases) ? o.aliases : typeof o.aliases === 'string' ? o.aliases.split(',') : [];
  const aliases = [...new Set(aliasesRaw.map((a) => cut(a, 100)).filter(Boolean))].slice(0, 10);
  const id = typeof o.id === 'string' && /^[a-z0-9-]{6,40}$/.test(o.id) ? o.id : 'n-' + now.getTime().toString(36) + Math.random().toString(36).slice(2, 6);
  return {
    id,
    title,
    aliases,
    author: cut(o.author, 100),
    summary: cut(o.summary, 6000),
    characters: cut(o.characters, 6000),
    monoSpots: cut(o.monoSpots, 4000),
    checkedBy: cut(o.checkedBy, 60),
    status: o.status === '검수됨' ? '검수됨' : '초안',
    updatedAt: now.toISOString(),
  };
}

/** 해석 요청에 맞는 검수된 노트 찾기: 작품명이 제목·별칭과 같거나, 작품명이 없으면 본문 첫 줄에 제목이 들어 있을 때 */
export function matchNote(notes: WorkNote[], work: string, text: string): WorkNote | null {
  const ok = notes.filter((n) => n.status === '검수됨');
  const names = (n: WorkNote) => [n.title, ...n.aliases].map(normTitle).filter((x) => x.length >= 2);
  const w = normTitle(work || '');
  if (w) return ok.find((n) => names(n).includes(w)) ?? null;
  const first = normTitle((text || '').split('\n').find((l) => l.trim()) || '').slice(0, 80);
  if (!first) return null;
  return ok.find((n) => names(n).some((x) => first.includes(x))) ?? null;
}

/** 프롬프트에 넣을 노트 블록 */
export function noteBlock(n: WorkNote): string {
  const L = [
    `[SOKMAL 검수된 작품 노트 — 사람이 확인한 사실입니다. 줄거리·인물·관계·위치 같은 사실은 이 노트를 가장 먼저 따르고, 노트와 다른 기억은 쓰지 않습니다. 작품명만 받았어도 이 노트로 정리하며 [모름]으로 답하지 않습니다. 노트에 없는 세부는 지어내지 말고 "노트에 없음"으로 둡니다.]`,
    `작품: ${n.title}${n.author ? ` (${n.author})` : ''}`,
    n.summary && `줄거리:\n${n.summary}`,
    n.characters && `인물과 관계:\n${n.characters}`,
    n.monoSpots && `독백 후보 위치:\n${n.monoSpots}`,
  ];
  return L.filter(Boolean).join('\n\n');
}

export function appendNote(prompt: string, n: WorkNote | null): string {
  return n ? `${prompt}\n\n${noteBlock(n)}` : prompt;
}
