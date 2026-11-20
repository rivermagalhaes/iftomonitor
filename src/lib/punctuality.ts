import { haversine } from './geo';
import { localMinutesOfDay, localTimeOnDayOf, parseHM, localDayKey } from './time';
import type { ReferenceConfig } from '../config/reference';

/* Funções puras (sem banco/rede). Horários chegam em UTC e são comparados no horário local de America/Fortaleza. */

export type Shift = 'manha' | 'noite' | 'fora_de_turno';
export type ShiftOverride = 'auto' | 'manha' | 'noite' | 'ignorar';
export type EventKind = 'chegada' | 'saida' | 'retorno';
export type CalculatedStatus = 'adiantado' | 'no_limite' | 'atrasado' | 'pontual' | 'atrasada' | 'antecipada';
export type ProblemStatus = 'sem_deslocamento' | 'nao_chegou' | 'sem_saida_do_campus' | 'nao_retornou';
export type EventStatus = CalculatedStatus | ProblemStatus;
export type Confidence = 'alta' | 'baixa';
export type ExcludedReason = 'ignorada' | 'em_andamento' | 'fora_de_turno' | 'sem_rota' | 'sem_evento';

export interface PunctTrip { id: string; bus_label?: string; route_id?: string | null; route_name?: string; started_at: string; ended_at: string | null; status?: string; shift_override?: ShiftOverride; app_version?: string }
export interface PunctPoint { recorded_at: string; latitude: number; longitude: number; accepted?: boolean | null }
export interface PunctStop { id?: string; arrived_at: string; duration_s: number | null; latitude: number; longitude: number; status?: string | null; label?: string | null }

export interface PunctEvent {
    kind: EventKind;
    status: EventStatus;
    /** Instante do evento (UTC ISO) — null quando o evento não aconteceu. */
    at: string | null;
    /** Alvo local "HH:MM" (08:00, 17:00 ou 19:00). */
    target: string;
    /** chegada/retorno: folga (positivo = antes do prazo). saida: desvio (positivo = depois das 17:00). Minutos inteiros. */
    deltaMin: number | null;
    confidence: Confidence | null;
}
export interface TripMetrics { durationMin: number; distanceKm: number; stopsCount: number; stoppedMin: number }
export interface TripPunctuality {
    tripId: string;
    shift: Shift;
    inferredShift: Shift;
    override: ShiftOverride;
    events: PunctEvent[];
    metrics: TripMetrics;
    excluded: ExcludedReason | null;
    /** Pior confiança entre os eventos calculados. */
    confidence: Confidence | null;
}

const MIN = 60000;
const calculated = new Set<EventStatus>(['adiantado', 'no_limite', 'atrasado', 'pontual', 'atrasada', 'antecipada']);
export const isCalculated = (status: EventStatus): status is CalculatedStatus => calculated.has(status);
const clean = (n: number) => (n === 0 ? 0 : n);

export function median(values: number[]): number | null {
    if (!values.length) return null;
    const s = [...values].sort((a, b) => a - b), mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Turno inferido pelo horário local de INÍCIO da viagem (minuto inteiro, limites inclusivos). */
export function inferShift(startedAt: string, cfg: ReferenceConfig): Shift {
    const m = localMinutesOfDay(startedAt);
    if (m === null) return 'fora_de_turno';
    const minute = Math.floor(m);
    const within = (w: { start: string; end: string }) => minute >= (parseHM(w.start) ?? 0) && minute <= (parseHM(w.end) ?? -1);
    return within(cfg.morningWindow) ? 'manha' : within(cfg.eveningWindow) ? 'noite' : 'fora_de_turno';
}
export function effectiveShift(trip: Pick<PunctTrip, 'started_at' | 'shift_override'>, cfg: ReferenceConfig): { shift: Shift; ignored: boolean } {
    const o = trip.shift_override ?? 'auto';
    if (o === 'ignorar') return { shift: inferShift(trip.started_at, cfg), ignored: true };
    if (o === 'manha' || o === 'noite') return { shift: o, ignored: false };
    return { shift: inferShift(trip.started_at, cfg), ignored: false };
}

export const acceptedSorted = (points: PunctPoint[]) => points.filter(p => p.accepted === true && Number.isFinite(Date.parse(p.recorded_at))).sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at));
export function pathDistanceKm(points: PunctPoint[]) { let m = 0; for (let i = 1; i < points.length; i++) m += haversine(points[i - 1], points[i]); return m / 1000; }

function lowConfidenceAround(points: PunctPoint[], index: number, limitS: number): boolean {
    const lo = Math.max(0, index - 2), hi = Math.min(points.length - 1, index + 2);
    for (let i = lo + 1; i <= hi; i++) if ((Date.parse(points[i].recorded_at) - Date.parse(points[i - 1].recorded_at)) / 1000 > limitS) return true;
    return false;
}
const arrivalStatus = (folga: number, cfg: ReferenceConfig): CalculatedStatus => folga < 0 ? 'atrasado' : folga > cfg.earlyMarginMin ? 'adiantado' : 'no_limite';

export function computeTripPunctuality(trip: PunctTrip, allPoints: PunctPoint[], stops: PunctStop[], cfg: ReferenceConfig): TripPunctuality {
    const points = acceptedSorted(allPoints);
    const { shift, ignored } = effectiveShift(trip, cfg);
    const inferredShift = inferShift(trip.started_at, cfg);
    const startMs = Date.parse(trip.started_at);
    const used = stops.filter(s => s.status !== 'descartada');
    const endMs = trip.ended_at ? Date.parse(trip.ended_at) : points.length ? Date.parse(points[points.length - 1].recorded_at) : startMs;
    const metrics: TripMetrics = {
        durationMin: Math.max(0, (endMs - startMs) / MIN), distanceKm: pathDistanceKm(points), stopsCount: used.length,
        stoppedMin: used.reduce((sum, s) => sum + (s.duration_s ?? 0), 0) / 60
    };
    const campus = { latitude: cfg.campus.lat, longitude: cfg.campus.lng };
    const inside = points.map(p => haversine(p, campus) <= cfg.campus.radiusM);
    const events: PunctEvent[] = [];
    const makeEvent = (kind: EventKind, status: EventStatus, index: number | null, target: string, delta: number | null): PunctEvent => ({
        kind, status, at: index === null ? null : points[index].recorded_at, target, deltaMin: delta === null ? null : clean(delta),
        confidence: index === null ? null : lowConfidenceAround(points, index, cfg.lowConfidenceGapS) ? 'baixa' : 'alta'
    });
    const minutesFrom = (target: string, index: number) => Math.round((localTimeOnDayOf(startMs, target) - Date.parse(points[index].recorded_at)) / MIN);

    if (!ignored && shift === 'manha') {
        const firstOut = inside.indexOf(false);
        const target = cfg.morningArrivalDeadline;
        if (firstOut < 0) events.push(makeEvent('chegada', 'sem_deslocamento', null, target, null));
        else {
            const arrival = inside.findIndex((v, i) => v && i > firstOut);
            if (arrival < 0) events.push(makeEvent('chegada', 'nao_chegou', null, target, null));
            else { const folga = minutesFrom(target, arrival); events.push(makeEvent('chegada', arrivalStatus(folga, cfg), arrival, target, folga)); }
        }
    } else if (!ignored && shift === 'noite') {
        const firstOut = inside.indexOf(false);
        if (firstOut < 0) {
            events.push(makeEvent('saida', 'sem_deslocamento', null, cfg.eveningDeparture, null));
            events.push(makeEvent('retorno', 'sem_deslocamento', null, cfg.eveningArrivalDeadline, null));
        } else {
            if (firstOut === 0) events.push(makeEvent('saida', 'sem_saida_do_campus', null, cfg.eveningDeparture, null));
            else {
                const desvio = -minutesFrom(cfg.eveningDeparture, firstOut - 1);
                const status: CalculatedStatus = Math.abs(desvio) <= cfg.toleranceMin ? 'pontual' : desvio > 0 ? 'atrasada' : 'antecipada';
                events.push(makeEvent('saida', status, firstOut - 1, cfg.eveningDeparture, desvio));
            }
            let ret = -1;
            for (let i = firstOut + 1; i < inside.length; i++) if (inside[i] && !inside[i - 1]) ret = i;
            if (ret < 0) events.push(makeEvent('retorno', 'nao_retornou', null, cfg.eveningArrivalDeadline, null));
            else { const folga = minutesFrom(cfg.eveningArrivalDeadline, ret); events.push(makeEvent('retorno', arrivalStatus(folga, cfg), ret, cfg.eveningArrivalDeadline, folga)); }
        }
    }

    let excluded: ExcludedReason | null = null;
    if (ignored) excluded = 'ignorada';
    else if (trip.status === 'recording') excluded = 'em_andamento';
    else if (shift === 'fora_de_turno') excluded = 'fora_de_turno';
    else if (!trip.route_id && !(trip.route_name || '').trim()) excluded = 'sem_rota';
    else if (!events.some(e => isCalculated(e.status))) excluded = 'sem_evento';
    const confs = events.filter(e => isCalculated(e.status)).map(e => e.confidence);
    const confidence: Confidence | null = confs.length ? (confs.includes('baixa') ? 'baixa' : 'alta') : null;
    return { tripId: trip.id, shift, inferredShift, override: trip.shift_override ?? 'auto', events, metrics, excluded, confidence };
}

/** Evento "principal" do turno: chegada (manhã) ou retorno (noite). */
export const primaryEvent = (r: TripPunctuality) => r.events.find(e => e.kind === (r.shift === 'manha' ? 'chegada' : 'retorno') && isCalculated(e.status));
export const departureEvent = (r: TripPunctuality) => r.events.find(e => e.kind === 'saida' && isCalculated(e.status));

export interface GroupSummary {
    key: string; routeName: string; shift: 'manha' | 'noite';
    trips: number;
    /** % de viagens com chegada/retorno adiantado ou no limite (null se nenhuma tem o evento). */
    onTimePct: number | null;
    /** % de saídas pontuais (somente turno da noite). */
    departureOnTimePct: number | null;
    medianFolga: number | null; worstFolga: number | null; bestFolga: number | null;
    tripIds: string[];
}
export interface ExcludedTrip { tripId: string; reason: ExcludedReason }
export interface Aggregate { groups: GroupSummary[]; excluded: ExcludedTrip[]; validTripIds: string[] }

export function aggregatePunctuality(trips: PunctTrip[], results: Map<string, TripPunctuality> | TripPunctuality[]): Aggregate {
    const list = Array.isArray(results) ? results : [...results.values()];
    const byId = new Map(list.map(r => [r.tripId, r]));
    const excluded: ExcludedTrip[] = [], buckets = new Map<string, { routeName: string; shift: 'manha' | 'noite'; items: TripPunctuality[] }>();
    for (const trip of trips) {
        const r = byId.get(trip.id); if (!r) continue;
        if (r.excluded) { excluded.push({ tripId: trip.id, reason: r.excluded }); continue; }
        const routeName = (trip.route_name || '').trim() || 'Rota';
        const key = `${trip.route_id || routeName}|${r.shift}`;
        const bucket = buckets.get(key) ?? { routeName, shift: r.shift as 'manha' | 'noite', items: [] };
        bucket.items.push(r); buckets.set(key, bucket);
    }
    const groups: GroupSummary[] = [...buckets.entries()].map(([key, b]) => {
        const primaries = b.items.map(r => ({ r, e: primaryEvent(r) })).filter((x): x is { r: TripPunctuality; e: PunctEvent } => !!x.e && x.e.deltaMin !== null);
        const folgas = primaries.map(x => x.e.deltaMin as number);
        const worstPool = primaries.filter(x => x.r.confidence !== 'baixa').map(x => x.e.deltaMin as number);
        const onTime = primaries.filter(x => x.e.status === 'adiantado' || x.e.status === 'no_limite').length;
        const deps = b.items.map(departureEvent).filter((e): e is PunctEvent => !!e);
        return {
            key, routeName: b.routeName, shift: b.shift, trips: b.items.length,
            onTimePct: primaries.length ? Math.round(onTime / primaries.length * 100) : null,
            departureOnTimePct: deps.length ? Math.round(deps.filter(e => e.status === 'pontual').length / deps.length * 100) : null,
            medianFolga: median(folgas), worstFolga: worstPool.length ? Math.min(...worstPool) : null, bestFolga: folgas.length ? Math.max(...folgas) : null,
            tripIds: b.items.map(r => r.tripId)
        };
    }).sort((a, b) => a.routeName.localeCompare(b.routeName, 'pt-BR') || a.shift.localeCompare(b.shift));
    return { groups, excluded, validTripIds: groups.flatMap(g => g.tripIds) };
}

/** Folga mediana por dia local (para as barras): só viagens válidas, evento principal. */
export function dailyFolga(trips: PunctTrip[], results: TripPunctuality[]): { day: string; folga: number; n: number }[] {
    const byId = new Map(trips.map(t => [t.id, t])), days = new Map<string, number[]>();
    for (const r of results) {
        if (r.excluded) continue;
        const e = primaryEvent(r), t = byId.get(r.tripId);
        if (!e || e.deltaMin === null || !t) continue;
        const day = localDayKey(t.started_at); days.set(day, [...(days.get(day) ?? []), e.deltaMin]);
    }
    return [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, v]) => ({ day, folga: median(v) as number, n: v.length }));
}
