-- SOKMAL(속말) × 배우의 저장소 — 같은 Supabase 프로젝트(actor-archive)에 한 번만 실행 (11-28)
-- Supabase 대시보드 → SQL Editor → New query 에 이 내용을 통째로 붙여 넣고 Run.
-- 여러 번 눌러도 오류 없이 넘어가게 만들었어요.

-- 1) 프로필: 두 서비스가 같이 쓰는 기본 정보 (이름·하는 일·소속·만 14세 이상·동의 시각)
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null default '',
  role         text not null default '',
  affiliation  text not null default '',
  over14       boolean not null default false,
  consent_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.profiles_touch() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.profiles_touch();

-- 행 보안: 본인만 보고, 만들고, 고칠 수 있어요 (관리자 화면은 속말 서버에 남긴 사본을 봐요)
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
grant select, insert, update on public.profiles to authenticated;

-- 2) 내 기록 표(records)에 속말 기록도 담을 수 있게 'sokmal' 추가
alter table public.records drop constraint if exists records_service_check;
alter table public.records add constraint records_service_check
  check (service in ('dialect', 'analyze', 'note', 'sokmal'));
