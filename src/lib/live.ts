// Lógica do mapa "Ao vivo" (painel): viagens ativas, última posição, "sem sinal", velocidade e rastro. Pura e testável.
import { SPEED_HIGH_KMH, SPEED_WARN_KMH } from '../config/reference';
import { displaySpeed, speedBand, type SpeedBand, type SpeedPoint } from './speed';
import { localHM } from './time';

export const LIVE_WINDOW_MS = 12 * 3600000;
export const STALE_MS = 2 * 60000;
export const TRAIL_MS = 30 * 60000;
export const POLL_MS = 10000;
export const CAMPUS_CENTER: [number, number] = [-10.2006, -48.90172];
export const SPEED_COLORS: Record<SpeedBand, string> = { ok: '#2e7d32', warn: '#f9a825', high: '#c62828', none: '#6b7280' };

export interface LiveTrip { id: string; bus_label?: string | null; route_name?: string | null; started_at: string; ended_at?: string | null; status?: string | null }
export interface LivePoint extends SpeedPoint { id?: string }

/** Viagens "sombra" ativas: status live, sem fim, começadas nas últimas 12 h e ainda não finalizadas de verdade (live_id nas viagens finalizadas). */
export function activeLiveTrips(liveTrips: readonly LiveTrip[], finishedLiveIds: ReadonlySet<string>, nowMs: number): LiveTrip[] {
    return liveTrips.filter(t => (t.status ?? 'live') === 'live' && !t.ended_at && nowMs - Date.parse(t.started_at) <= LIVE_WINDOW_MS && !finishedLiveIds.has(t.id))
        .sort((a, b) => String(a.bus_label).localeCompare(String(b.bus_label), 'pt-BR'));
}
/** Última posição aceita (por tempo, depois seq). */
export function pickLastPoint<T extends SpeedPoint>(points: readonly T[]): T | null {
    let best: T | null = null;
    for (const p of points) {
        if (p.accepted === false || !Number.isFinite(Date.parse(p.recorded_at))) continue;
        if (!best || Date.parse(p.recorded_at) > Date.parse(best.recorded_at) || (p.recorded_at === best.recorded_at && (p.seq ?? 0) > (best.seq ?? 0))) best = p;
    }
    return best;
}
/** Última posição de cada viagem, a partir de pontos de várias viagens. */
export function lastPointByTrip<T extends SpeedPoint & { trip_id?: string }>(points: readonly T[]): Map<string, T> {
    const groups = new Map<string, T[]>();
    for (const p of points) { const k = p.trip_id ?? ''; (groups.get(k) ?? groups.set(k, []).get(k)!).push(p); }
    return new Map([...groups].map(([k, list]) => [k, pickLastPoint(list)!] as const).filter(([, p]) => p));
}
export const trailSince = <T extends SpeedPoint>(points: readonly T[], nowMs: number, windowMs = TRAIL_MS) =>
    points.filter(p => p.accepted !== false && nowMs - Date.parse(p.recorded_at) <= windowMs).sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at) || (a.seq ?? 0) - (b.seq ?? 0));

export function formatAge(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000));
    return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min`;
}
export interface LiveState { stale: boolean; ageMs: number; text: string; speedKmh: number | null; band: SpeedBand; color: string }
/** Estado exibido: >2 min sem ponto = cinza "sem sinal desde HH:MM" (hora de Fortaleza); senão velocidade e cor (verde <80, amarelo 80–99, vermelho ≥100). */
export function liveState(trail: readonly SpeedPoint[], nowMs: number): LiveState | null {
    const last = pickLastPoint(trail);
    if (!last) return null;
    const ageMs = Math.max(0, nowMs - Date.parse(last.recorded_at));
    if (ageMs > STALE_MS) return { stale: true, ageMs, text: `sem sinal desde ${localHM(last.recorded_at)}`, speedKmh: null, band: 'none', color: SPEED_COLORS.none };
    const speedKmh = displaySpeed(trail, nowMs, STALE_MS / 1000), band = speedBand(speedKmh, SPEED_WARN_KMH, SPEED_HIGH_KMH);
    return { stale: false, ageMs, text: `atualizado há ${formatAge(ageMs)}`, speedKmh, band, color: SPEED_COLORS[band] };
}
