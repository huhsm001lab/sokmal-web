-- SOKMAL 2단계: 사용자별 하루 횟수 + AI 호출 비용 기록
-- Supabase 대시보드 > SQL Editor 에 붙여 넣어 한 번 실행해요.
-- 사용자는 Supabase Auth(익명 로그인 + 이메일 연결)로 구분해요. 저장함·지표·후기는 3단계에서 추가해요.

-- 하루 사용 횟수 (하루 = 한국 시간 날짜)
create table if not exists public.usage_daily (
  uid    uuid not null references auth.users(id) on delete cascade,
  day    date not null,
  key    text not null check (key in ('exam', 'pro', 'mono')),
  run    int  not null default 0,
  follow int  not null default 0,
  hits   int  not null default 0,   -- 한도에 걸린 횟수
  primary key (uid, day, key)
);

-- AI 호출 기록 (비용 측정·월 예산 차단의 근거)
create table if not exists public.ai_calls (
  id                 bigserial primary key,
  at                 timestamptz not null default now(),
  uid                uuid references auth.users(id) on delete set null,
  feature            text not null,
  model              text not null,
  status             text not null,          -- ok / meta / refused / error / cancelled
  input_tokens       int not null default 0,
  output_tokens      int not null default 0,
  cache_write_tokens int not null default 0,
  cache_read_tokens  int not null default 0,
  cost_krw           numeric(12, 2) not null default 0
);
create index if not exists ai_calls_at_idx on public.ai_calls (at);

-- 행 단위 보안: 본인 횟수만 읽기. 쓰기는 서버(서비스 키)만.
alter table public.usage_daily enable row level security;
alter table public.ai_calls enable row level security;
drop policy if exists "read own usage" on public.usage_daily;
create policy "read own usage" on public.usage_daily for select to authenticated using (auth.uid() = uid);
-- ai_calls 에는 정책을 두지 않아요 → 서비스 키로만 읽고 써요.

-- 횟수 1번 예약 (한 문장 안에서 확인하고 올림: 동시에 눌러도 한도를 넘지 않음)
create or replace function public.sokmal_reserve(p_uid uuid, p_day date, p_key text, p_kind text, p_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into usage_daily (uid, day, key) values (p_uid, p_day, p_key) on conflict do nothing;
  if p_kind = 'run' then
    update usage_daily set run = run + 1
     where uid = p_uid and day = p_day and key = p_key and run + follow < p_limit
     returning true into ok;
  elsif p_kind = 'follow' then
    update usage_daily set follow = follow + 1
     where uid = p_uid and day = p_day and key = p_key and run + follow < p_limit
     returning true into ok;
  else
    raise exception 'bad kind %', p_kind;
  end if;
  if ok is null then
    update usage_daily set hits = hits + 1 where uid = p_uid and day = p_day and key = p_key;
    return false;
  end if;
  return true;
end $$;

-- 예약 취소 (AI 오류, [확인]·[모름] 답, 중단)
create or replace function public.sokmal_refund(p_uid uuid, p_day date, p_key text, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'run' then
    update usage_daily set run = greatest(run - 1, 0) where uid = p_uid and day = p_day and key = p_key;
  else
    update usage_daily set follow = greatest(follow - 1, 0) where uid = p_uid and day = p_day and key = p_key;
  end if;
end $$;

-- 화면에서 미리 막혔을 때 '한도에 걸림'만 기록
create or replace function public.sokmal_hit(p_uid uuid, p_day date, p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into usage_daily (uid, day, key, hits) values (p_uid, p_day, p_key, 1)
  on conflict (uid, day, key) do update set hits = usage_daily.hits + 1;
end $$;

-- 기간 비용 합계 (월 예산 상한 확인용)
create or replace function public.sokmal_cost_since(p_since timestamptz)
returns numeric language sql security definer set search_path = public as $$
  select coalesce(sum(cost_krw), 0) from ai_calls where at >= p_since;
$$;

-- 서버(서비스 키)만 부를 수 있게
revoke all on function public.sokmal_reserve(uuid, date, text, text, int) from public, anon, authenticated;
revoke all on function public.sokmal_refund(uuid, date, text, text) from public, anon, authenticated;
revoke all on function public.sokmal_hit(uuid, date, text) from public, anon, authenticated;
revoke all on function public.sokmal_cost_since(timestamptz) from public, anon, authenticated;
grant execute on function public.sokmal_reserve(uuid, date, text, text, int) to service_role;
grant execute on function public.sokmal_refund(uuid, date, text, text) to service_role;
grant execute on function public.sokmal_hit(uuid, date, text) to service_role;
grant execute on function public.sokmal_cost_since(timestamptz) to service_role;
