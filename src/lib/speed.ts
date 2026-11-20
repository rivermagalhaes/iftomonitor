// Velocímetro e excessos de velocidade, calculados dos pontos GPS (sem novo tipo de evento nem SQL).
// Usado pelo app (Viagem, Histórico, CSV) e pelo painel web (#/painel), sem duplicação.
import { SPEED_EPISODE_MIN_S, SPEED_HIGH_KMH, SPEED_MAX_ACCURACY_M, SPEED_WARN_KMH } from '../config/reference';
import { csvBr } from '../shared/csvBr';
import { haversine } from './geo';
import { localDateTimeFortaleza, localDayKey } from './time';

export interface SpeedPoint { trip_id?: string; recorded_at: string; latitude: number; longitude: number; accuracy_m: number; speed_mps: number | null; seq?: number; accepted?: boolean }
export const mpsToKmh = (mps: number) => mps * 3.6;
/** Acima disto (km/h) o ponto é tratado como erro de GPS e descartado. */
export const MAX_PLAUSIBLE_KMH = 160;
/** Aceleração máxima plausível para um ônibus (m/s²); acima disso, nos dois sentidos, o ponto é um salto de GPS. */
export const MAX_ACCEL_MPS2 = 2;
/** Intervalo máximo (s) entre pontos para considerar a sequência contínua. */
export const MAX_SAMPLE_GAP_S = 45;
export const MOVING_KMH = 3;

export interface Sample { t: number; iso: string; kmh: number; latitude: number; longitude: number; good: boolean; estimated: boolean }
const time = (p: SpeedPoint) => Date.parse(p.recorded_at);

/** Uma amostra por ponto aceito, em ordem cronológica. `good` = precisão ≤ 20 m e sem salto de GPS. */
export function toSamples(points: readonly SpeedPoint[]): Sample[] {
    const sorted = points.filter(p => p.accepted !== false && Number.isFinite(time(p))).sort((a, b) => time(a) - time(b) || (a.seq ?? 0) - (b.seq ?? 0));
    const out: Sample[] = [];
    sorted.forEach((p, i) => {
        let kmh: number | null = null, estimated = false;
        if (typeof p.speed_mps === 'number' && Number.isFinite(p.speed_mps) && p.speed_mps >= 0) kmh = mpsToKmh(p.speed_mps);
        else if (i > 0) {
            const dt = (time(p) - time(sorted[i - 1])) / 1000;
            if (dt >= 1 && dt <= MAX_SAMPLE_GAP_S) { kmh = mpsToKmh(haversine(sorted[i - 1], p) / dt); estimated = true; }
        }
        out.push({ t: time(p), iso: p.recorded_at, kmh: kmh ?? 0, latitude: p.latitude, longitude: p.longitude, good: kmh !== null && p.accuracy_m <= SPEED_MAX_ACCURACY_M && kmh <= MAX_PLAUSIBLE_KMH, estimated });
    });
    // Saltos: ponto que destoa dos vizinhos com aceleração impossível nos dois sentidos.
    const bad = new Set<number>();
    for (let i = 0; i < out.length; i++) {
        if (!out[i].good) continue;
        const prev = out[i - 1], next = out[i + 1];
        const jump = (o: Sample | undefined) => !!o && o.good && Math.abs(out[i].kmh - o.kmh) / 3.6 / Math.max(1, Math.abs(out[i].t - o.t) / 1000) > MAX_ACCEL_MPS2;
        if ((prev && next && jump(prev) && jump(next)) || (!prev && next && jump(next) && out[i].kmh > next.kmh + 40) || (!next && prev && jump(prev) && out[i].kmh > prev.kmh + 40)) bad.add(i);
    }
    return out.map((s, i) => bad.has(i) ? { ...s, good: false } : s);
}

/** Valor do velocímetro: média curta (até 3 últimos pontos válidos); null = mostrar "—". */
export function displaySpeed(points: readonly SpeedPoint[], nowMs = Date.now(), staleS = 30): number | null {
    const samples = toSamples(points);
    const last = samples.at(-1);
    if (!last || !last.good || (nowMs - last.t) / 1000 > staleS) return null;
    const recent: Sample[] = [];
    for (let i = samples.length - 1; i >= 0 && recent.length < 3; i--) { const s = samples[i]; if (!s.good || last.t - s.t > MAX_SAMPLE_GAP_S * 1000) break; recent.push(s); }
    const avg = recent.reduce((sum, s) => sum + s.kmh, 0) / recent.length;
    return avg < MOVING_KMH ? 0 : Math.round(avg);
}
export type SpeedBand = 'ok' | 'warn' | 'high' | 'none';
export const speedBand = (kmh: number | null, warn = SPEED_WARN_KMH, high = SPEED_HIGH_KMH): SpeedBand => kmh === null ? 'none' : kmh >= high ? 'high' : kmh >= warn ? 'warn' : 'ok';
export const speedBandLabel: Record<SpeedBand, string> = { ok: '', warn: 'Atenção', high: 'Velocidade alta', none: '' };

export interface Episode { limit: number; start: string; end: string; durationS: number; vmax: number; vavg: number; latitude: number; longitude: number }
/** Sequências de ≥2 pontos consecutivos bons com velocidade ≥ limite, sustentadas por ≥ 10 s. */
export function findEpisodes(samples: readonly Sample[], limit: number, minS = SPEED_EPISODE_MIN_S): Episode[] {
    const out: Episode[] = [];
    let run: Sample[] = [];
    const close = () => {
        if (run.length >= 2 && (run[run.length - 1].t - run[0].t) / 1000 >= minS) {
            const last = run[run.length - 1], top = run.reduce((a, b) => b.kmh > a.kmh ? b : a);
            out.push({ limit, start: run[0].iso, end: last.iso, durationS: Math.round((last.t - run[0].t) / 1000), vmax: Math.round(top.kmh * 10) / 10, vavg: Math.round(run.reduce((s, x) => s + x.kmh, 0) / run.length * 10) / 10, latitude: top.latitude, longitude: top.longitude });
        }
        run = [];
    };
    for (const s of samples) {
        const prev = run[run.length - 1], over = s.good && s.kmh >= limit;
        if (over && (!prev || (s.t - prev.t) / 1000 <= MAX_SAMPLE_GAP_S)) run.push(s);
        else { close(); if (over) run.push(s); }
    }
    close();
    return out;
}

export interface TripSpeed { vmax: number; vavg: number; minAbove80: number; minAbove100: number; episodes80: Episode[]; episodes100: Episode[]; samples: number }
export function tripSpeedStats(points: readonly SpeedPoint[], warn = SPEED_WARN_KMH, high = SPEED_HIGH_KMH): TripSpeed {
    const samples = toSamples(points), good = samples.filter(s => s.good), moving = good.filter(s => s.kmh >= MOVING_KMH);
    const above = (limit: number) => { let ms = 0; for (let i = 1; i < samples.length; i++) { const a = samples[i - 1], b = samples[i]; if (a.good && b.good && a.kmh >= limit && b.kmh >= limit && b.t - a.t <= MAX_SAMPLE_GAP_S * 1000) ms += b.t - a.t; } return Math.round(ms / 60000 * 10) / 10; };
    return {
        vmax: good.length ? Math.round(Math.max(...good.map(s => s.kmh))) : 0,
        vavg: moving.length ? Math.round(moving.reduce((s, x) => s + x.kmh, 0) / moving.length * 10) / 10 : 0,
        minAbove80: above(warn), minAbove100: above(high), episodes80: findEpisodes(samples, warn), episodes100: findEpisodes(samples, high), samples: good.length,
    };
}
export const mapsLink = (latitude: number, longitude: number) => `https://www.google.com/maps?q=${latitude},${longitude}`;

export interface SpeedTripInfo { id: string; bus_label?: string | null; route_name?: string | null; started_at: string; app_version?: string | null }
export const speedEpisodeColumns = ['trip_id', 'onibus', 'rota', 'data_local', 'inicio_local', 'fim_local', 'duracao_s', 'vmax_kmh', 'vmedia_kmh', 'limite_kmh_usado', 'latitude', 'longitude', 'app_version'] as const;
export const speedSummaryColumns = ['trip_id', 'onibus', 'rota', 'data_local', 'vmax_kmh', 'vmedia_movimento_kmh', 'min_acima_80', 'min_acima_100', 'n_episodios', 'n_episodios_100', 'app_version'] as const;
export interface SpeedBundle { trip: SpeedTripInfo; points: SpeedPoint[] }
/** Uma linha por (episódio, limite): um excesso ≥100 aparece também como ≥80. */
export function speedEpisodesCsv(bundles: readonly SpeedBundle[], appVersion = ''): string {
    const rows: unknown[][] = [];
    for (const { trip, points } of bundles) {
        const stats = tripSpeedStats(points);
        for (const e of [...stats.episodes80, ...stats.episodes100].sort((a, b) => a.start.localeCompare(b.start) || a.limit - b.limit))
            rows.push([trip.id, trip.bus_label ?? '', trip.route_name ?? '', localDayKey(e.start), localDateTimeFortaleza(e.start), localDateTimeFortaleza(e.end), e.durationS, e.vmax, e.vavg, e.limit, e.latitude, e.longitude, trip.app_version || appVersion]);
    }
    return csvBr(speedEpisodeColumns, rows);
}
export function speedSummaryCsv(bundles: readonly SpeedBundle[], appVersion = ''): string {
    return csvBr(speedSummaryColumns, bundles.map(({ trip, points }) => { const s = tripSpeedStats(points); return [trip.id, trip.bus_label ?? '', trip.route_name ?? '', localDayKey(trip.started_at), s.vmax, s.vavg, s.minAbove80, s.minAbove100, s.episodes80.length, s.episodes100.length, trip.app_version || appVersion]; }));
}
export const speedFileName = (period: string) => `ifto-monitor_velocidade_${period}.csv`;
export const speedSummaryFileName = (period: string) => `ifto-monitor_velocidade-resumo_${period}.csv`;
