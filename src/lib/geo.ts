import type { GpsPoint } from '../data/models';
export function haversine(a: {
    latitude: number;
    longitude: number;
}, b: {
    latitude: number;
    longitude: number;
}) { const r = Math.PI / 180; const dlat = (b.latitude - a.latitude) * r, dlon = (b.longitude - a.longitude) * r; const x = Math.sin(dlat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dlon / 2) ** 2; return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x))); }
export const gapLimitS = (intervalMs = 10000) => Math.max(60, 3 * intervalMs / 1000);
export const chronological = (points: GpsPoint[]) => [...points].sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at) || a.seq - b.seq);
export interface SignalGap { before: GpsPoint; after: GpsPoint; seconds: number }
export function analyzeTrack(points: GpsPoint[], intervalMs = 10000) {
    const accepted = chronological(points.filter(p => p.accepted));
    const segments: GpsPoint[][] = [], gaps: SignalGap[] = [];
    const annotated = new Map<string, GpsPoint>();
    let total = 0, previous: GpsPoint | undefined;
    for (const point of accepted) {
        const seconds = previous ? (Date.parse(point.recorded_at) - Date.parse(previous.recorded_at)) / 1000 : 0;
        const meters = previous ? haversine(previous, point) : 0;
        const gap = !!previous && seconds > gapLimitS(intervalMs);
        const suspect = !!point.suspect || (!!previous && seconds > 0 && meters / seconds * 3.6 > 200);
        const current = { ...point, suspect, gap_before_s: gap ? seconds : undefined };
        annotated.set(point.id, current);
        if (gap) gaps.push({ before: previous!, after: current, seconds });
        if (!previous || gap || suspect) segments.push([current]);
        else { segments.at(-1)!.push(current); if (seconds > 0) total += meters; }
        previous = current;
    }
    return { accepted: accepted.map(p => annotated.get(p.id)!), segments, gaps, distance: total,
        gapSeconds: gaps.reduce((sum, gap) => sum + gap.seconds, 0), annotated };
}
export function distance(points: GpsPoint[], intervalMs = 10000) { return analyzeTrack(points, intervalMs).distance; }
export function durationMMSS(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }
