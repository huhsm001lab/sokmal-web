// 키 없이 개발·테스트할 때 쓰는 메모리 저장소. 서버를 다시 켜면 비워진다.
import type { CounterKey } from '../limits';
import { emptyUsage, type CallLog, type DataStore, type DayUsage } from './types';

export class MemoryStore implements DataStore {
  private days = new Map<string, DayUsage>();
  calls: (CallLog & { at: string })[] = [];

  private rec(uid: string, day: string) {
    const k = uid + '|' + day;
    let r = this.days.get(k);
    if (!r) this.days.set(k, (r = emptyUsage()));
    return r;
  }
  async reserve(uid: string, day: string, key: CounterKey, kind: 'run' | 'follow', limit: number) {
    const r = this.rec(uid, day)[key];
    if (r.run + r.follow >= limit) {
      r.hits++;
      return false;
    }
    r[kind]++;
    return true;
  }
  async refund(uid: string, day: string, key: CounterKey, kind: 'run' | 'follow') {
    const r = this.rec(uid, day)[key];
    r[kind] = Math.max(0, r[kind] - 1);
  }
  async hit(uid: string, day: string, key: CounterKey) {
    this.rec(uid, day)[key].hits++;
  }
  async usage(uid: string, day: string) {
    return structuredClone(this.rec(uid, day));
  }
  async costSince(sinceIso: string) {
    return this.calls.filter((c) => c.at >= sinceIso).reduce((a, c) => a + c.costKrw, 0);
  }
  async logCall(row: CallLog) {
    this.calls.push({ ...row, at: new Date().toISOString() });
  }
}
