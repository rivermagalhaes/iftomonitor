# Rotas e eventos v1.7 — preparação para Supabase

Nenhuma nuvem foi acessada ou alterada. Este documento é uma proposta para revisão administrativa; não foi aplicada nem validada por um PostgreSQL local. O esquema base continua em `supabase/migrations/0001_init.sql`.

## Modelo local

IndexedDB v2 adiciona `routes` sem remover stores ou registros. `initialize` preenche apenas campos ausentes de viagens antigas: `route_id = null`, `route_name = ''`, `events = []`. A rotina é idempotente e preserva IDs, pontos, paradas, status e datas. O adaptador SQLite cria `routes` com `CREATE TABLE IF NOT EXISTS`, mantém payloads e atualiza `user_version` para 2. O app continua usando IndexedDB; não foi instalado SQLite nativo.

Campo local e Demo usam bancos separados. Apenas cadastro vazio é semeado; Demo recebe nomes de exemplo. Nomes têm 2–60 caracteres e chave normalizada por remoção de acentos, caixa e espaços extras. Viagens guardam a fotografia legível `route_name`; renomear corrige todas as viagens vinculadas. Desativar não altera o histórico. A exclusão não é exposta pelo aplicativo.

## Proposta de DDL aditivo

UUIDs continuam gerados no cliente. `owner_user_id` é adicional no servidor para seguir as políticas do plano existente. A rota selecionada deve pertencer ao mesmo coletor da viagem. Os campos de sincronização auxiliares seguem o restante do esquema.

```sql
-- Rascunho: revisar em ambiente de testes autorizado antes de aplicar.
begin;
create table if not exists public.routes (
  id uuid primary key,
  owner_user_id uuid not null references public.profiles(id),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  sync_status text not null default 'synced'
    check (sync_status in ('pending','synced','error')),
  sync_attempts integer not null default 0,
  last_error text,
  next_retry_at timestamptz,
  unique(id, owner_user_id)
);
alter table public.trips add column if not exists route_id uuid;
alter table public.trips add column if not exists route_name text not null default '';
alter table public.trips add column if not exists events jsonb not null default '[]'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='trips_route_owner_fk'
                 and conrelid='public.trips'::regclass) then
    alter table public.trips add constraint trips_route_owner_fk
      foreign key(route_id,owner_user_id) references public.routes(id,owner_user_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='trips_events_array'
                 and conrelid='public.trips'::regclass) then
    alter table public.trips add constraint trips_events_array
      check (jsonb_typeof(events)='array');
  end if;
end $$;
create index if not exists trips_route on public.trips(route_id);
alter table public.routes enable row level security;
revoke all on public.routes from anon, authenticated;
grant select,insert,update on public.routes to authenticated;
drop policy if exists routes_read on public.routes;
create policy routes_read on public.routes for select to authenticated
  using ((public.is_active_collector() and owner_user_id=auth.uid())
         or public.is_active_coordinator());
drop policy if exists routes_insert on public.routes;
create policy routes_insert on public.routes for insert to authenticated
  with check (public.is_active_collector() and owner_user_id=auth.uid());
drop policy if exists routes_update on public.routes;
create policy routes_update on public.routes for update to authenticated
  using (public.is_active_collector() and owner_user_id=auth.uid())
  with check (public.is_active_collector() and owner_user_id=auth.uid());
commit;
```

Antes da publicação, revisar/aumentar as restrições: nome canônico com unicidade por proprietário ignorando acentos (por exemplo, chave calculada em trigger com `unaccent` após aprovação da extensão), paridade `route_id`/`route_name`, imutabilidade do proprietário e formato permitido dos eventos `{type,at,details}`. A validação local existente não substitui essas restrições no servidor. Não reutilizar a unicidade apenas por `lower(name)`, que não trata acentos.

## Acesso do coordenador e sincronização futura

As políticas propostas preservam o plano atual: coletor ativo administra seus registros; coordenador ativo lê todos; anon e DELETE não são autorizados. Para o coordenador corrigir rotas de outra pessoa na nuvem, implementar uma RPC transacional restrita a rota, snapshot, `route_edited`, data e pendência, validando o perfil ativo e preservando a propriedade da viagem. Não liberar UPDATE geral de viagens alheias apenas para possibilitar essa correção.

O modo Campo local não simula papéis de autenticação; as correções locais ocorrem no aparelho. Também será necessária uma operação transacional de renomear rota e snapshots vinculados no servidor. Eventos são anexados, não descartados em cada atualização.

Antes de habilitar nuvem real, preparar o envio de rotas antes das viagens que as referenciam, com o proprietário definido pela sessão. O cliente de sincronização atual não foi ampliado nem acionado remotamente nesta tarefa. Validar RLS, adoção dos registros locais, conflitos entre dispositivos, eventos concorrentes, renomeação e ID de rota desativada. Dados Demo nunca entram na nuvem.
