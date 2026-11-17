-- =====================================================================
-- IFTO Monitor — nuvem (Supabase / Postgres)
-- Schema isolado: ifto_monitor
-- Seguro para rodar mais de uma vez (idempotente). Roda em UMA transação:
-- se der erro, nada é aplicado.
--
-- DEPOIS DE APLICAR (passo manual, 1 vez):
--   Supabase > Project Settings > Data API > "Exposed schemas":
--   ADICIONE `ifto_monitor` à lista (não troque as que já existem).
-- =====================================================================
begin;

create schema if not exists ifto_monitor;

-- ---------------------------------------------------------------------
-- Administradores (quem pode ler tudo e moderar)
-- Depois de criar o usuário em Authentication > Users, rode:
--   insert into ifto_monitor.admins (user_id) values ('<UUID_DO_USUARIO>');
-- ---------------------------------------------------------------------
create table if not exists ifto_monitor.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function ifto_monitor.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from ifto_monitor.admins a
    where a.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------
-- Cadastros: rotas, ônibus, horários previstos
-- ---------------------------------------------------------------------
create table if not exists ifto_monitor.routes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists ifto_monitor.buses (
  id uuid primary key default gen_random_uuid(),
  label text not null unique check (char_length(label) between 1 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists ifto_monitor.route_schedules (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references ifto_monitor.routes(id) on delete cascade,
  label text not null default 'Chegada ao campus',
  expected_time time not null,
  tolerance_min integer not null default 5 check (tolerance_min between 0 and 120),
  weekdays smallint[] not null default '{1,2,3,4,5}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Viagens enviadas pelos celulares dos ônibus
-- (ids gerados no celular; reenvio é seguro por causa das chaves únicas)
-- ---------------------------------------------------------------------
create table if not exists ifto_monitor.trips (
  id uuid primary key,
  bus_label text check (bus_label is null or char_length(bus_label) <= 60),
  route_name text check (route_name is null or char_length(route_name) <= 80),
  route_id uuid references ifto_monitor.routes(id) on delete set null,
  device_id text not null check (char_length(device_id) <= 80),
  app_version text check (app_version is null or char_length(app_version) <= 20),
  started_at timestamptz not null,
  ended_at timestamptz,
  status text,
  distance_m double precision,
  duration_s integer,
  points_count integer,
  stops_count integer,
  gap_count integer,
  gap_total_s double precision,
  extra jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  constraint trips_ended_after_start check (ended_at is null or ended_at >= started_at)
);

create table if not exists ifto_monitor.trip_points (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references ifto_monitor.trips(id) on delete cascade,
  seq integer not null,
  recorded_at timestamptz not null,
  -- limites aproximados do Brasil (descarta lixo evidente)
  latitude double precision not null check (latitude between -35 and 6),
  longitude double precision not null check (longitude between -75 and -28),
  accuracy_m real,
  speed_mps real,
  accepted boolean,
  source text,
  gap_before_s real,
  suspect boolean,
  unique (trip_id, seq)
);

create table if not exists ifto_monitor.trip_stops (
  id uuid primary key,
  trip_id uuid not null references ifto_monitor.trips(id) on delete cascade,
  arrived_at timestamptz not null,
  departed_at timestamptz,
  duration_s integer,
  latitude double precision not null check (latitude between -35 and 6),
  longitude double precision not null check (longitude between -75 and -28),
  status text,
  label text,
  detected_by text
);

create table if not exists ifto_monitor.trip_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references ifto_monitor.trips(id) on delete cascade,
  event_type text not null check (char_length(event_type) <= 60),
  occurred_at timestamptz not null,
  detail jsonb not null default '{}'::jsonb,
  app_version text,
  unique (trip_id, event_type, occurred_at)
);

-- liga route_id automaticamente pelo nome da rota
create or replace function ifto_monitor.set_trip_route_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.route_id is null and new.route_name is not null then
    select r.id into new.route_id
    from ifto_monitor.routes r
    where lower(r.name) = lower(new.route_name)
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trips_route_id on ifto_monitor.trips;
create trigger trg_trips_route_id
  before insert on ifto_monitor.trips
  for each row execute function ifto_monitor.set_trip_route_id();

-- ---------------------------------------------------------------------
-- Relatos dos alunos (texto e/ou foto) — criados SÓ pela Edge Function
-- ---------------------------------------------------------------------
create table if not exists ifto_monitor.reports (
  id uuid primary key default gen_random_uuid(),
  bus_label text not null check (char_length(bus_label) between 1 and 60),
  route_name text check (route_name is null or char_length(route_name) <= 80),
  category text not null check (category in (
    'atraso','quebra','superlotacao','parada_nao_feita',
    'desvio','limpeza_conservacao','seguranca','outro'
  )),
  message text check (message is null or char_length(message) <= 500),
  photo_count smallint not null default 0 check (photo_count between 0 and 2),
  status text not null default 'novo' check (status in ('novo','visto','resolvido','descartado')),
  internal_note text check (internal_note is null or char_length(internal_note) <= 1000),
  trip_id uuid references ifto_monitor.trips(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  constraint reports_text_or_photo check (message is not null or photo_count > 0)
);

create table if not exists ifto_monitor.report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references ifto_monitor.reports(id) on delete cascade,
  storage_path text not null unique,
  mime_type text,
  size_bytes integer check (size_bytes is null or size_bytes between 1 and 1048576),
  uploaded boolean not null default false,
  keep boolean not null default false,
  created_at timestamptz not null default now()
);

-- limite de envios por aparelho/dia (só a Edge Function acessa)
create table if not exists ifto_monitor.report_rate (
  ip_hash text not null,
  day date not null default current_date,
  count integer not null default 0,
  primary key (ip_hash, day)
);

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
create index if not exists idx_trips_started on ifto_monitor.trips (started_at desc);
create index if not exists idx_trips_bus on ifto_monitor.trips (bus_label);
create index if not exists idx_trips_route on ifto_monitor.trips (route_name);
create index if not exists idx_points_trip on ifto_monitor.trip_points (trip_id, seq);
create index if not exists idx_stops_trip on ifto_monitor.trip_stops (trip_id);
create index if not exists idx_events_trip on ifto_monitor.trip_events (trip_id);
create index if not exists idx_reports_status on ifto_monitor.reports (status, created_at desc);
create index if not exists idx_reports_bus on ifto_monitor.reports (bus_label);
create index if not exists idx_photos_report on ifto_monitor.report_photos (report_id);

-- ---------------------------------------------------------------------
-- Segurança (RLS)
-- ---------------------------------------------------------------------
alter table ifto_monitor.admins          enable row level security;
alter table ifto_monitor.routes          enable row level security;
alter table ifto_monitor.buses           enable row level security;
alter table ifto_monitor.route_schedules enable row level security;
alter table ifto_monitor.trips           enable row level security;
alter table ifto_monitor.trip_points     enable row level security;
alter table ifto_monitor.trip_stops      enable row level security;
alter table ifto_monitor.trip_events     enable row level security;
alter table ifto_monitor.reports         enable row level security;
alter table ifto_monitor.report_photos   enable row level security;
alter table ifto_monitor.report_rate     enable row level security;  -- sem políticas: só service_role

-- admins: cada um enxerga a própria linha
drop policy if exists admins_self_select on ifto_monitor.admins;
create policy admins_self_select on ifto_monitor.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- rotas e ônibus: qualquer pessoa lê os ativos; admin gerencia
drop policy if exists routes_anon_select on ifto_monitor.routes;
create policy routes_anon_select on ifto_monitor.routes
  for select to anon, authenticated using (active);
drop policy if exists routes_admin_all on ifto_monitor.routes;
create policy routes_admin_all on ifto_monitor.routes
  for all to authenticated using (ifto_monitor.is_admin()) with check (ifto_monitor.is_admin());

drop policy if exists buses_anon_select on ifto_monitor.buses;
create policy buses_anon_select on ifto_monitor.buses
  for select to anon, authenticated using (active);
drop policy if exists buses_admin_all on ifto_monitor.buses;
create policy buses_admin_all on ifto_monitor.buses
  for all to authenticated using (ifto_monitor.is_admin()) with check (ifto_monitor.is_admin());

drop policy if exists schedules_admin_all on ifto_monitor.route_schedules;
create policy schedules_admin_all on ifto_monitor.route_schedules
  for all to authenticated using (ifto_monitor.is_admin()) with check (ifto_monitor.is_admin());

-- viagens e derivados: celulares (anon) só INSEREM; admin lê e apaga
drop policy if exists trips_anon_insert on ifto_monitor.trips;
create policy trips_anon_insert on ifto_monitor.trips
  for insert to anon with check (true);
drop policy if exists trips_admin_select on ifto_monitor.trips;
create policy trips_admin_select on ifto_monitor.trips
  for select to authenticated using (ifto_monitor.is_admin());
drop policy if exists trips_admin_delete on ifto_monitor.trips;
create policy trips_admin_delete on ifto_monitor.trips
  for delete to authenticated using (ifto_monitor.is_admin());

drop policy if exists points_anon_insert on ifto_monitor.trip_points;
create policy points_anon_insert on ifto_monitor.trip_points
  for insert to anon with check (true);
drop policy if exists points_admin_select on ifto_monitor.trip_points;
create policy points_admin_select on ifto_monitor.trip_points
  for select to authenticated using (ifto_monitor.is_admin());

drop policy if exists stops_anon_insert on ifto_monitor.trip_stops;
create policy stops_anon_insert on ifto_monitor.trip_stops
  for insert to anon with check (true);
drop policy if exists stops_admin_select on ifto_monitor.trip_stops;
create policy stops_admin_select on ifto_monitor.trip_stops
  for select to authenticated using (ifto_monitor.is_admin());

drop policy if exists events_anon_insert on ifto_monitor.trip_events;
create policy events_anon_insert on ifto_monitor.trip_events
  for insert to anon with check (true);
drop policy if exists events_admin_select on ifto_monitor.trip_events;
create policy events_admin_select on ifto_monitor.trip_events
  for select to authenticated using (ifto_monitor.is_admin());

-- relatos e fotos: aluno NÃO acessa direto (só pela Edge Function); admin modera
drop policy if exists reports_admin_all on ifto_monitor.reports;
create policy reports_admin_all on ifto_monitor.reports
  for all to authenticated using (ifto_monitor.is_admin()) with check (ifto_monitor.is_admin());

drop policy if exists photos_admin_all on ifto_monitor.report_photos;
create policy photos_admin_all on ifto_monitor.report_photos
  for all to authenticated using (ifto_monitor.is_admin()) with check (ifto_monitor.is_admin());

-- ---------------------------------------------------------------------
-- Permissões de tabela
-- ---------------------------------------------------------------------
grant usage on schema ifto_monitor to anon, authenticated, service_role;

grant all on all tables    in schema ifto_monitor to service_role;
grant all on all sequences in schema ifto_monitor to service_role;
grant execute on all functions in schema ifto_monitor to anon, authenticated, service_role;

grant select on ifto_monitor.routes, ifto_monitor.buses to anon;
grant insert on ifto_monitor.trips, ifto_monitor.trip_points,
                ifto_monitor.trip_stops, ifto_monitor.trip_events to anon;

grant select, insert, update, delete on all tables in schema ifto_monitor to authenticated;
revoke all on ifto_monitor.report_rate from authenticated, anon;

alter default privileges in schema ifto_monitor grant all on tables to service_role;
alter default privileges in schema ifto_monitor grant all on sequences to service_role;

-- ---------------------------------------------------------------------
-- Fotos: bucket PRIVADO (upload só por URL assinada criada pela Edge Function)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ifto-reports', 'ifto-reports', false, 1048576,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ifto_reports_admin_select on storage.objects;
create policy ifto_reports_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'ifto-reports' and ifto_monitor.is_admin());

drop policy if exists ifto_reports_admin_delete on storage.objects;
create policy ifto_reports_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'ifto-reports' and ifto_monitor.is_admin());

-- ---------------------------------------------------------------------
-- Dados iniciais
-- ---------------------------------------------------------------------
insert into ifto_monitor.routes (name, slug) values
  ('Jardim Paulista', 'jardim-paulista'),
  ('Pouso Alegre',    'pouso-alegre'),
  ('Serrano',         'serrano')
on conflict (name) do nothing;

insert into ifto_monitor.buses (label) values
  ('Ônibus 01'), ('Ônibus 02'), ('Ônibus 03')
on conflict (label) do nothing;

commit;
