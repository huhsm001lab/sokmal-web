// Supabase(Postgres) 저장소. 서버에서만, 서비스 키로 쓴다. 표와 함수는 supabase/migrations/001_init.sql
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CounterKey } from '../limits';
import { emptyUsage, type CallLog, type DataStore } from './types';

export class SupabaseStore implements DataStore {
  constructor(private db: SupabaseClient) {}

  async reserve(uid: string, day: string, key: CounterKey, kind: 'run' | 'follow', limit: number) {
    const { data, error } = await this.db.rpc('sokmal_reserve', { p_uid: uid, p_day: day, p_key: key, p_kind: kind, p_limit: limit });
    if (error) throw error;
    return data === true;
  }
  async refund(uid: string, day: string, key: CounterKey, kind: 'run' | 'follow') {
    const { error } = await this.db.rpc('sokmal_refund', { p_uid: uid, p_day: day, p_key: key, p_kind: kind });
    if (error) throw error;
  }
  async hit(uid: string, day: string, key: CounterKey) {
    const { error } = await this.db.rpc('sokmal_hit', { p_uid: uid, p_day: day, p_key: key });
    if (error) throw error;
  }
  async usage(uid: string, day: string) {
    const { data, error } = await this.db.from('usage_daily').select('key,run,follow,hits').eq('uid', uid).eq('day', day);
    if (error) throw error;
    const u = emptyUsage();
    for (const r of data ?? []) {
      if (r.key in u) u[r.key as CounterKey] = { run: r.run, follow: r.follow, hits: r.hits };
    }
    return u;
  }
  async costSince(sinceIso: string) {
    const { data, error } = await this.db.rpc('sokmal_cost_since', { p_since: sinceIso });
    if (error) throw error;
    return Number(data ?? 0);
  }
  async logCall(r: CallLog) {
    const { error } = await this.db.from('ai_calls').insert({
      uid: r.uid,
      feature: r.feature,
      model: r.model,
      status: r.status,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      cache_write_tokens: r.cacheWriteTokens,
      cache_read_tokens: r.cacheReadTokens,
      cost_krw: r.costKrw,
    });
    if (error) throw error;
  }
}
