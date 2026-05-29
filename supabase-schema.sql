-- NOX Supabase schema
-- À lancer dans Supabase → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

create table if not exists public.nox_context_secrets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_name text default '',
  text text not null
);

create table if not exists public.nox_archives (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message text default '',
  photo_data_url text default '',
  question text default '',
  oracle_sentence text default '',
  action text default '',
  fatum integer,
  reaction text default '',
  reactions jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb
);

create table if not exists public.nox_fatum_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  score integer not null default 0,
  credited jsonb not null default '[]'::jsonb,
  secretum_unlocked_level integer not null default 0
);

create table if not exists public.nox_labyrinthus_chronicon (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  timestamp text default '',
  text text not null
);

create index if not exists nox_context_secrets_created_at_idx on public.nox_context_secrets (created_at desc);
create index if not exists nox_archives_created_at_idx on public.nox_archives (created_at desc);
create index if not exists nox_fatum_users_created_at_idx on public.nox_fatum_users (created_at asc);
create index if not exists nox_labyrinthus_chronicon_created_at_idx on public.nox_labyrinthus_chronicon (created_at desc);

alter table public.nox_context_secrets enable row level security;
alter table public.nox_archives enable row level security;
alter table public.nox_fatum_users enable row level security;
alter table public.nox_labyrinthus_chronicon enable row level security;

-- Le serveur utilise SUPABASE_SERVICE_ROLE_KEY, qui contourne RLS.
-- Ne jamais exposer cette clé côté client.


alter table public.nox_archives add column if not exists reactions jsonb not null default '[]'::jsonb;
