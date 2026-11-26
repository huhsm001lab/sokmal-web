// 내 컴퓨터에서 시험할 때 쓰는 파일 저장소. 서버를 껐다 켜도 오늘 횟수·AI 호출 비용이 남는다.
// 한 사람이 한 컴퓨터에서 쓰는 용도라 단순하게: 바뀔 때마다 JSON 파일 하나를 통째로 다시 쓴다.
import fs from 'node:fs';
import path from 'node:path';
import type { CounterKey } from '../limits';
import { emptyUsage, type CallLog, type DataStore, type DayUsage } from './types';

type Shape = { days: Record<string, DayUsage>; calls: (CallLog & { at: string })[] };

export class FileStore implements DataStore {
  private data: Shape;
  constructor(private file: string) {
    this.data = { days: {}, calls: [] };
    try {
      const v = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (v && typeof v === 'object') this.data = { days: v.days || {}, calls: Array.isArray(v.calls) ? v.calls : [] };
    } catch {
      // 파일이 없으면 새로 시작
    }
  }
  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, this.file); // 쓰다가 꺼져도 파일이 깨지지 않게
  }
  private rec(uid: string, day: string) {
    const k = uid + '|' + day;
    const r = (this.data.days[k] ??= emptyUsage());
    for (const key of ['exam', 'pro', 'mono'] as CounterKey[]) r[key] ??= { run: 0, follow: 0, hits: 0 };
    return r;
  }
  async reserve(uid: string, day: string, key: CounterKey, kind: 'run' | 'follow', limit: number) {
    const r = this.rec(uid, day)[key];
    const ok = r.run + r.follow < limit;
    if (ok) r[kind]++;
    else r.hits++;
    this.save();
    return ok;
  }
  async refund(uid: string, day: string, key: CounterKey, kind: 'run' | 'follow') {
    const r = this.rec(uid, day)[key];
    r[kind] = Math.max(0, r[kind] - 1);
    this.save();
  }
  async hit(uid: string, day: string, key: CounterKey) {
    this.rec(uid, day)[key].hits++;
    this.save();
  }
  async usage(uid: string, day: string) {
    return structuredClone(this.rec(uid, day));
  }
  async costSince(sinceIso: string) {
    return this.data.calls.filter((c) => c.at >= sinceIso).reduce((a, c) => a + (c.costKrw || 0), 0);
  }
  async logCall(row: CallLog) {
    this.data.calls.push({ ...row, at: new Date().toISOString() });
    this.save();
  }
}
