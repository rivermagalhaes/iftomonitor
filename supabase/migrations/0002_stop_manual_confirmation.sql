alter table public.stops drop constraint if exists stops_detected_by_check;
alter table public.stops add constraint stops_detected_by_check check (detected_by in ('auto','manual','auto+manual'));
alter table public.stops add column if not exists manually_confirmed boolean;
