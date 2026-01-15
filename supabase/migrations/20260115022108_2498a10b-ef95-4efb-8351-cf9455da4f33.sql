-- EHR connections (user-visible status)
create table if not exists public.ehr_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider_id text not null,
  status text not null default 'disconnected',
  last_sync_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider_id)
);

alter table public.ehr_connections enable row level security;

create policy "Users can view their own EHR connections"
on public.ehr_connections
for select
using (auth.uid() = user_id);

create policy "Users can create their own EHR connections"
on public.ehr_connections
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own EHR connections"
on public.ehr_connections
for update
using (auth.uid() = user_id);

create policy "Users can delete their own EHR connections"
on public.ehr_connections
for delete
using (auth.uid() = user_id);

-- EHR tokens (service-only; no user policies)
create table if not exists public.ehr_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider_id text not null,
  access_token text not null,
  refresh_token text null,
  expires_at timestamptz null,
  scope text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider_id)
);

alter table public.ehr_tokens enable row level security;

-- Timestamp trigger
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_ehr_connections_updated_at on public.ehr_connections;
create trigger trg_ehr_connections_updated_at
before update on public.ehr_connections
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_ehr_tokens_updated_at on public.ehr_tokens;
create trigger trg_ehr_tokens_updated_at
before update on public.ehr_tokens
for each row execute function public.update_updated_at_column();

create index if not exists idx_ehr_connections_user on public.ehr_connections(user_id);
create index if not exists idx_ehr_tokens_user on public.ehr_tokens(user_id);
