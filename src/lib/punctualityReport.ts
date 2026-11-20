import { csvText } from './csv';
import { aggregatePunctuality, computeTripPunctuality, dailyFolga, isCalculated, type Aggregate, type EventStatus, type ExcludedReason, type PunctEvent, type PunctPoint, type PunctStop, type PunctTrip, type Shift, type TripPunctuality } from './punctuality';
import { observedTimetable, type ObservedRow } from './observedTimetable';
import { formatMinutesOfDay, localDateTimeFortaleza, localDayStartMs, localHM } from './time';
import type { ReferenceConfig } from '../config/reference';

export type Period = '7d' | '30d' | 'all';
export const periodLabels: Record<Period, string> = { '7d': '7 dias', '30d': '30 dias', all: 'Tudo' };
export const periodStartMs = (period: Period, nowMs: number) => period === 'all' ? 0 : localDayStartMs(nowMs) - (period === '7d' ? 6 : 29) * 86400000;

export const shiftLabels: Record<Shift | 'ignorar', string> = { manha: 'Manhã', noite: 'Tarde/noite', fora_de_turno: 'Fora de turno', ignorar: 'Ignorada' };
export const excludedLabels: Record<ExcludedReason, string> = { ignorada: 'Viagem ignorada', em_andamento: 'Viagem em andamento', fora_de_turno: 'Fora de turno', sem_rota: 'Sem rota', sem_evento: 'Sem chegada/saída calculável' };
export const statusLabels: Record<EventStatus, string> = {
    adiantado: 'Adiantado', no_limite: 'No limite', atrasado: 'Atrasado', pontual: 'Pontual', atrasada: 'Atrasada', antecipada: 'Antecipada',
    sem_deslocamento: 'Sem deslocamento', nao_chegou: 'Não chegou', sem_saida_do_campus: 'Sem saída do campus', nao_retornou: 'Não retornou'
};
export type Tone = 'ok' | 'warn' | 'bad' | 'muted';
export const statusTone = (s: EventStatus): Tone => s === 'adiantado' || s === 'pontual' ? 'ok' : s === 'no_limite' || s === 'antecipada' ? 'warn' : s === 'atrasado' || s === 'atrasada' ? 'bad' : 'muted';

const plural = (n: number) => `${n} min`;
/** "Chegou 07:43 (17 min antes das 08:00)" etc. */
export function describeEvent(e: PunctEvent): string {
    if (!isCalculated(e.status) || !e.at || e.deltaMin === null) {
        return e.status === 'nao_chegou' ? 'Não chegou ao campus' : e.status === 'nao_retornou' ? 'Não voltou ao campus' : e.status === 'sem_saida_do_campus' ? 'Viagem não começou no campus' : 'Não saiu do campus';
    }
    const time = localHM(e.at), d = e.deltaMin;
    const verb = e.kind === 'chegada' ? 'Chegou' : e.kind === 'saida' ? 'Saiu' : 'Voltou';
    if (e.kind === 'saida') return `${verb} ${time} (${d === 0 ? `na hora das ${e.target}` : d > 0 ? `${plural(d)} após as ${e.target}` : `${plural(-d)} antes das ${e.target}`})`;
    return `${verb} ${time} (${d === 0 ? `na hora das ${e.target}` : d > 0 ? `${plural(d)} antes das ${e.target}` : `${plural(-d)} após as ${e.target}`})`;
}
export const describeTrip = (r: TripPunctuality) => r.events.map(describeEvent).join(' · ');
export const formatMinutes = (n: number | null) => n === null ? '—' : Number.isInteger(n) ? `${n} min` : `${n.toFixed(1).replace('.', ',')} min`;

export interface TripBundle { trip: PunctTrip; points: PunctPoint[]; stops: PunctStop[] }
export interface Filters { period: Period; routeKey: string; shift: 'todos' | 'manha' | 'noite'; nowMs: number }
export const routeKeyOf = (t: Pick<PunctTrip, 'route_id' | 'route_name'>) => t.route_id || (t.route_name || '').trim() || 'none';

export interface Analysis {
    trips: PunctTrip[];
    results: TripPunctuality[];
    aggregate: Aggregate;
    daily: { day: string; folga: number; n: number }[];
    /** Tabela observada por grupo (chave = GroupSummary.key). */
    timetables: Map<string, ObservedRow[]>;
}
/** Orquestra o cálculo para um conjunto de viagens já carregadas (usado pelo app e pelo painel). */
export function analyze(bundles: TripBundle[], cfg: ReferenceConfig, filters: Filters): Analysis {
    const from = periodStartMs(filters.period, filters.nowMs);
    const selected = bundles.filter(b => Date.parse(b.trip.started_at) >= from && (filters.routeKey === 'todas' || routeKeyOf(b.trip) === filters.routeKey));
    const all = selected.map(b => ({ b, r: computeTripPunctuality(b.trip, b.points, b.stops, cfg) }));
    const visible = all.filter(x => filters.shift === 'todos' || x.r.shift === filters.shift || x.r.excluded === 'ignorada' || x.r.shift === 'fora_de_turno');
    const trips = visible.map(x => x.b.trip), results = visible.map(x => x.r);
    const aggregate = aggregatePunctuality(trips, results);
    const timetables = new Map<string, ObservedRow[]>();
    const stopsByTrip = new Map(visible.map(x => [x.b.trip.id, x.b.stops]));
    for (const g of aggregate.groups) timetables.set(g.key, observedTimetable(g.tripIds.map(id => ({ tripId: id, stops: stopsByTrip.get(id) ?? [] })), cfg));
    return { trips, results, aggregate, daily: dailyFolga(trips, results), timetables };
}

export const punctualityHeaders = ['trip_id', 'bus_label', 'route', 'shift', 'start_local', 'event', 'event_time_local', 'target_time', 'delta_min', 'status', 'confidence', 'duration_min', 'distance_km', 'stops_count', 'stopped_min', 'app_version'] as const;
export function punctualityCsv(trips: PunctTrip[], results: TripPunctuality[], appVersion: string) {
    const byId = new Map(trips.map(t => [t.id, t]));
    const rows: unknown[][] = [];
    for (const r of results) {
        const t = byId.get(r.tripId); if (!t) continue;
        const base = [t.id, t.bus_label || '', t.route_name || '', r.override === 'ignorar' ? 'ignorar' : r.shift, localDateTimeFortaleza(t.started_at)];
        const tail = [r.metrics.durationMin.toFixed(1), r.metrics.distanceKm.toFixed(2), r.metrics.stopsCount, r.metrics.stoppedMin.toFixed(1), t.app_version || appVersion];
        if (r.excluded === 'ignorada' || r.excluded === 'em_andamento' || r.excluded === 'fora_de_turno' || !r.events.length) { rows.push([...base, '', '', '', '', r.excluded || 'sem_evento', '', ...tail]); continue; }
        for (const e of r.events) rows.push([...base, e.kind, e.at ? localDateTimeFortaleza(e.at) : '', e.target, e.deltaMin ?? '', e.status, e.confidence ?? '', ...tail]);
    }
    return csvText(punctualityHeaders, rows);
}
export const observedHeaders = ['route', 'shift', 'order', 'label', 'latitude', 'longitude', 'trips_count', 'median_time_local', 'earliest_time_local', 'latest_time_local', 'median_stop_duration_s'] as const;
export const observedCsv = (route: string, shift: 'manha' | 'noite', rows: ObservedRow[]) => csvText(observedHeaders, rows.map(r => [route, shift, r.order, r.label, r.latitude.toFixed(6), r.longitude.toFixed(6), r.tripsCount, formatMinutesOfDay(r.medianMin), formatMinutesOfDay(r.earliestMin), formatMinutesOfDay(r.latestMin), Math.round(r.medianDurationS)]));
export const slug = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'sem-rota';
export const punctualityFileName = (period: Period) => `ifto-monitor_pontualidade_${period === 'all' ? 'tudo' : period}.csv`;
export const observedFileName = (route: string, shift: 'manha' | 'noite') => `ifto-monitor_tabela-observada_${slug(route)}_${shift}.csv`;
