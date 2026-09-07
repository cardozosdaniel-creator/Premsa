-- Pla de comunicació d'obres — esquema Supabase
-- Executa aquest fitxer al SQL Editor de Supabase la primera vegada.
-- És idempotent: pots tornar-lo a executar sense trencar res.

-- Extensió per a IDs curts aleatoris (ja habilitada per defecte).
create extension if not exists pgcrypto;

-- ══════════════ Taula principal: obres ══════════════
create table if not exists works (
  id           text primary key default gen_random_uuid()::text,
  dept         text not null default 'PRE',
  obra         text not null default '',
  loc          text not null default '',
  imp          text not null default '—',
  fita         text not null default '',
  data         text not null default '',
  bucket       text not null default 'SENSE',
  vegueria     text not null default '',
  encarregat   text not null default '',        -- '' | 'delegacio' | 'conseller' | 'serveis-territorials'
  nivell       text not null default '',        -- '' | '1' | '2' | '3'
  kind         text not null default '',        -- '' | 'inaugura' | ... (auto si buit)
  top          boolean not null default false,
  comms        text not null default '',
  status       text not null default 'todo',    -- 'todo' | 'doing' | 'done'
  sort_order   integer not null default 0,
  updated_at   timestamptz not null default now(),
  updated_by   text
);

create index if not exists works_bucket_idx on works(bucket);
create index if not exists works_dept_idx on works(dept);
create index if not exists works_updated_at_idx on works(updated_at desc);

-- ══════════════ Historial de canvis (append-only) ══════════════
create table if not exists history (
  id         text primary key default gen_random_uuid()::text,
  ts         timestamptz not null default now(),
  user_name  text,
  kind       text not null,                     -- 'edit' | 'add' | 'delete' | 'import' | 'reset' | 'signin' | 'password'
  row_id     text,
  row_label  text,
  field      text,
  before_val text,
  after_val  text,
  extra      jsonb
);

create index if not exists history_ts_idx on history(ts desc);

-- ══════════════ Usuaris actius (presència) ══════════════
-- Cada sessió actualitza la seva pròpia fila cada 30 s. Netegem sessions
-- inactives des del client abans d'ensenyar-les.
create table if not exists active_users (
  session_id text primary key,
  user_name  text,
  last_seen  timestamptz not null default now()
);

-- ══════════════ Config global (contrasenya, admins) ══════════════
create table if not exists app_settings (
  key   text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- ══════════════ Realtime: activa les taules ══════════════
alter publication supabase_realtime add table works;
alter publication supabase_realtime add table history;
alter publication supabase_realtime add table active_users;
alter publication supabase_realtime add table app_settings;

-- ══════════════ Row-Level Security ══════════════
-- Per a la simplicitat del pilot, cap RLS: la URL de l'app és privada
-- (només qui la té la coneix) i l'entrada demana contrasenya.
-- L'anon key només serveix per llegir/escriure aquestes taules.
alter table works disable row level security;
alter table history disable row level security;
alter table active_users disable row level security;
alter table app_settings disable row level security;
