// 저장소(KvStore)가 쓰는 최소한의 키-값 명령.
// 운영: Upstash Redis(Vercel에서 연결) / 개발·테스트: 메모리 또는 파일. 같은 명령 이름·뜻을 따른다.
import fs from 'node:fs';
import path from 'node:path';

export interface Kv {
  hincrby(key: string, field: string, by: number): Promise<number>;
  hincrbyfloat(key: string, field: string, by: number): Promise<number>;
  hgetall(key: string): Promise<Record<string, unknown> | null>;
  hset(key: string, kv: Record<string, string | number>): Promise<unknown>;
  hsetnx(key: string, field: string, value: string): Promise<unknown>;
  hdel(key: string, field: string): Promise<unknown>;
  sadd(key: string, member: string): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  lpush(key: string, value: string): Promise<unknown>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
  lrange(key: string, start: number, stop: number): Promise<unknown[]>;
  incrbyfloat(key: string, by: number): Promise<number>;
  get(key: string): Promise<unknown>;
  set(key: string, value: string): Promise<unknown>;
}

type Data = { h: Record<string, Record<string, string>>; s: Record<string, string[]>; l: Record<string, string[]>; v: Record<string, string> };

/** 메모리 키-값 (서버를 끄면 사라짐). onChange 로 파일에 남길 수 있음 */
export class MemKv implements Kv {
  protected d: Data = { h: {}, s: {}, l: {}, v: {} };
  protected changed() {}
  private hash(k: string) {
    return (this.d.h[k] ??= {});
  }
  async hincrby(k: string, f: string, by: number) {
    const h = this.hash(k);
    const n = Math.trunc(Number(h[f] ?? 0)) + by;
    h[f] = String(n);
    this.changed();
    return n;
  }
  async hincrbyfloat(k: string, f: string, by: number) {
    const h = this.hash(k);
    const n = Number(h[f] ?? 0) + by;
    h[f] = String(n);
    this.changed();
    return n;
  }
  async hgetall(k: string) {
    const h = this.d.h[k];
    return h && Object.keys(h).length ? { ...h } : null;
  }
  async hset(k: string, kv: Record<string, string | number>) {
    const h = this.hash(k);
    for (const [f, v] of Object.entries(kv)) h[f] = String(v);
    this.changed();
    return Object.keys(kv).length;
  }
  async hsetnx(k: string, f: string, v: string) {
    const h = this.hash(k);
    if (f in h) return 0;
    h[f] = v;
    this.changed();
    return 1;
  }
  async hdel(k: string, f: string) {
    const h = this.hash(k);
    const had = f in h;
    delete h[f];
    this.changed();
    return had ? 1 : 0;
  }
  async sadd(k: string, m: string) {
    const s = (this.d.s[k] ??= []);
    if (s.includes(m)) return 0;
    s.push(m);
    this.changed();
    return 1;
  }
  async smembers(k: string) {
    return [...(this.d.s[k] ?? [])];
  }
  async lpush(k: string, v: string) {
    const l = (this.d.l[k] ??= []);
    l.unshift(v);
    this.changed();
    return l.length;
  }
  async ltrim(k: string, start: number, stop: number) {
    const l = this.d.l[k];
    if (l) this.d.l[k] = l.slice(start, stop < 0 ? undefined : stop + 1);
    this.changed();
    return 'OK';
  }
  async lrange(k: string, start: number, stop: number) {
    const l = this.d.l[k] ?? [];
    return l.slice(start, stop < 0 ? undefined : stop + 1);
  }
  async incrbyfloat(k: string, by: number) {
    const n = Number(this.d.v[k] ?? 0) + by;
    this.d.v[k] = String(n);
    this.changed();
    return n;
  }
  async get(k: string) {
    return this.d.v[k] ?? null;
  }
  async set(k: string, v: string) {
    this.d.v[k] = v;
    this.changed();
    return 'OK';
  }
}

/** 파일에 남는 키-값 (내 컴퓨터 시험용). 바뀔 때마다 JSON 파일 하나를 통째로 다시 씀 */
export class FileKv extends MemKv {
  constructor(private file: string) {
    super();
    try {
      const v = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (v && v.h && v.s && v.l && v.v) this.d = v;
    } catch {
      // 파일이 없거나 예전 모양이면 새로 시작
    }
  }
  protected changed() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.d));
    fs.renameSync(tmp, this.file); // 쓰다가 꺼져도 파일이 깨지지 않게
  }
}
