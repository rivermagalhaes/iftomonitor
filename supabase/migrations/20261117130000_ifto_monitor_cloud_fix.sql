begin;
alter table ifto_monitor.reports add column if not exists finalize_token uuid;
revoke select (finalize_token) on ifto_monitor.reports from anon;
create or replace function ifto_monitor.consume_report_rate(p_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into ifto_monitor.report_rate(ip_hash,day,count) values(p_hash,(now() at time zone 'UTC')::date,1)
 on conflict(ip_hash,day) do update set count=ifto_monitor.report_rate.count+1
 where ifto_monitor.report_rate.count<10 returning count into n;
 return n is not null;
end; $$;
revoke all on function ifto_monitor.consume_report_rate(text) from public,anon,authenticated;
grant execute on function ifto_monitor.consume_report_rate(text) to service_role;
commit;
