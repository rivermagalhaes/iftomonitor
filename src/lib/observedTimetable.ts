import { haversine } from './geo';
import { localMinutesOfDay } from './time';
import { median, type PunctStop } from './punctuality';
import type { ReferenceConfig } from '../config/reference';

export interface ObservedInput { tripId: string; stops: PunctStop[] }
export interface ObservedRow {
    order: number; label: string; latitude: number; longitude: number; tripsCount: number;
    medianMin: number; earliestMin: number; latestMin: number; medianDurationS: number;
}
const GENERIC = new Set(['parada manual', 'parada detectada']);
const norm = (s: string) => s.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');

interface Item { tripId: string; minute: number; durationS: number; latitude: number; longitude: number; label: string }
interface Cluster { items: Item[]; lat: number; lng: number }

/**
 * Agrupa paradas (não descartadas) de viagens válidas por PROXIMIDADE (≤ stopClusterRadiusM do centróide),
 * de forma gulosa por ordem de horário. O nome não entra na decisão.
 */
export function observedTimetable(inputs: ObservedInput[], cfg: ReferenceConfig): ObservedRow[] {
    const items: Item[] = [];
    for (const input of inputs) for (const s of input.stops) {
        if (s.status === 'descartada') continue;
        const minute = localMinutesOfDay(s.arrived_at); if (minute === null) continue;
        items.push({ tripId: input.tripId, minute, durationS: s.duration_s ?? 0, latitude: s.latitude, longitude: s.longitude, label: (s.label || '').trim() });
    }
    items.sort((a, b) => a.minute - b.minute);
    const clusters: Cluster[] = [];
    for (const item of items) {
        let best: Cluster | null = null, bestD = Infinity;
        for (const c of clusters) { const d = haversine({ latitude: c.lat, longitude: c.lng }, item); if (d <= cfg.stopClusterRadiusM && d < bestD) { best = c; bestD = d; } }
        if (!best) { clusters.push({ items: [item], lat: item.latitude, lng: item.longitude }); continue; }
        best.items.push(item);
        best.lat = best.items.reduce((s, i) => s + i.latitude, 0) / best.items.length;
        best.lng = best.items.reduce((s, i) => s + i.longitude, 0) / best.items.length;
    }
    const rows = clusters.map(c => {
        // uma parada por viagem (a mais cedo), para que "viagens" seja a contagem de viagens distintas
        const perTrip = new Map<string, Item>();
        for (const i of c.items) { const prev = perTrip.get(i.tripId); if (!prev || i.minute < prev.minute) perTrip.set(i.tripId, i); }
        const own = [...perTrip.values()], minutes = own.map(i => i.minute);
        const counts = new Map<string, { n: number; label: string }>();
        for (const i of c.items) { if (!i.label || GENERIC.has(norm(i.label))) continue; const k = norm(i.label), e = counts.get(k); counts.set(k, { n: (e?.n ?? 0) + 1, label: e?.label ?? i.label }); }
        const label = [...counts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'pt-BR'))[0]?.label ?? 'Parada sem nome';
        return { label, latitude: c.lat, longitude: c.lng, tripsCount: own.length, medianMin: median(minutes) as number, earliestMin: Math.min(...minutes), latestMin: Math.max(...minutes), medianDurationS: median(own.map(i => i.durationS)) as number };
    }).filter(r => r.tripsCount >= cfg.minTripsForObservedTable).sort((a, b) => a.medianMin - b.medianMin);
    return rows.map((r, i) => ({ order: i + 1, ...r }));
}
