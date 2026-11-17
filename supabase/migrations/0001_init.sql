-- Preparação P2: aplicar somente por um administrador em ambiente autorizado.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id), email text,
 role text not null check(role in ('coletor','coordenador')), active boolean not null default false
);
create function public.is_active_collector() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and active and role='coletor'); $$;
create function public.is_active_coordinator() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and active and role='coordenador'); $$;
revoke all on function public.is_active_collector() from public;
revoke all on function public.is_active_coordinator() from public;
grant execute on function public.is_active_collector(),public.is_active_coordinator() to authenticated;

create table public.app_meta(owner_user_id uuid not null references public.profiles(id), key text not null,value text not null,primary key(owner_user_id,key));
create table public.vehicles (
 id uuid primary key, owner_user_id uuid not null references public.profiles(id), label text not null, active boolean not null default true,
 created_at timestamptz not null, updated_at timestamptz not null,
 sync_status text not null default 'synced' check(sync_status in ('pending','synced','error')),sync_attempts integer not null default 0,last_error text,next_retry_at timestamptz,
 unique(id,owner_user_id)
);
create table public.trips (
 id uuid primary key, vehicle_id uuid not null, vehicle_label_snapshot text not null,
 owner_user_id uuid not null references public.profiles(id), operator_label text not null,
 status text not null check(status in ('recording','finished')), started_at timestamptz not null,ended_at timestamptz,
 ended_reason text check(ended_reason in ('user','recovered')),device_id uuid not null,created_at timestamptz not null,updated_at timestamptz not null,
 sync_status text not null default 'synced' check(sync_status in ('pending','synced','error')),sync_attempts integer not null default 0,last_error text,next_retry_at timestamptz,
 foreign key(vehicle_id,owner_user_id) references public.vehicles(id,owner_user_id)
);
create table public.gps_points (
 id uuid primary key,trip_id uuid not null references public.trips(id),seq integer not null check(seq>=1),latitude double precision not null check(latitude between -90 and 90),longitude double precision not null check(longitude between -180 and 180),
 accuracy_m double precision not null check(accuracy_m>=0),speed_mps double precision,recorded_at timestamptz not null,received_at timestamptz not null,device_id uuid not null,
 source text not null check(source='gps'),accepted boolean not null,
 sync_status text not null default 'synced' check(sync_status in ('pending','synced','error')),sync_attempts integer not null default 0,last_error text,next_retry_at timestamptz,
 unique(trip_id,seq)
);
create table public.stops (
 id uuid primary key,trip_id uuid not null references public.trips(id),arrived_at timestamptz not null,departed_at timestamptz,duration_s double precision not null check(duration_s>=0),
 latitude double precision not null check(latitude between -90 and 90),longitude double precision not null check(longitude between -180 and 180),avg_accuracy_m double precision not null,
 status text not null check(status in ('candidata','confirmada','descartada')),label text not null,detected_by text not null check(detected_by in ('auto','manual')),
 created_at timestamptz not null,updated_at timestamptz not null,
 sync_status text not null default 'synced' check(sync_status in ('pending','synced','error')),sync_attempts integer not null default 0,last_error text,next_retry_at timestamptz
);
create index gps_points_trip_time on public.gps_points(trip_id,recorded_at);
create index trips_owner_time on public.trips(owner_user_id,started_at);
create index stops_trip on public.stops(trip_id);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated using ((id=auth.uid() and active) or public.is_active_coordinator());

do $$ declare table_name text; predicate text; begin
 foreach table_name in array array['app_meta','vehicles','trips','gps_points','stops'] loop
  execute format('alter table public.%I enable row level security',table_name);
  execute format('revoke all on public.%I from anon',table_name);
  execute format('revoke all on public.%I from authenticated',table_name);
  execute format('grant select,insert,update on public.%I to authenticated',table_name);
  if table_name in ('gps_points','stops') then
   predicate=format('public.is_active_collector() and exists(select 1 from public.trips t where t.id=%I.trip_id and t.owner_user_id=auth.uid())',table_name);
  else predicate='public.is_active_collector() and owner_user_id=auth.uid()'; end if;
  execute format('create policy owned_select on public.%I for select to authenticated using ((%s) or public.is_active_coordinator())',table_name,predicate);
  execute format('create policy owned_insert on public.%I for insert to authenticated with check (%s)',table_name,predicate);
  execute format('create policy owned_update on public.%I for update to authenticated using (%s) with check (%s)',table_name,predicate,predicate);
 end loop;
end $$;
commit;
