import type { GpsPoint, Settings, Stop } from '../data/models';
import { haversine } from '../lib/geo';
export interface DetectedStop {
    key: string;
    arrived_at: string;
    departed_at: string | null;
    duration_s: number;
    latitude: number;
    longitude: number;
    avg_accuracy_m: number;
}
const centroid = (points: GpsPoint[]) => ({ latitude: points.reduce((s, p) => s + p.latitude, 0) / points.length, longitude: points.reduce((s, p) => s + p.longitude, 0) / points.length });
export class StopDetector {
    private group: (GpsPoint & { stationary_extended?: boolean })[] = [];
    private lastAccepted: GpsPoint | null = null;
    private frozen: (GpsPoint & { stationary_extended: boolean })[] = [];
    private previous: GpsPoint | null = null;
    private outside = 0;
    private closed: DetectedStop[] = [];
    constructor(private config: Settings) { }
    private current(closed = false): DetectedStop | null { if (this.group.length === 0)
        return null; const first = this.group[0], last = this.group.at(-1)!; const duration = (Date.parse(last.recorded_at) - Date.parse(first.recorded_at)) / 1000; if (duration < Math.max(10, this.config.stopMinDurationS))
        return null; return { key: first.id, arrived_at: first.recorded_at, departed_at: closed ? last.recorded_at : null, duration_s: duration, ...centroid(this.group), avg_accuracy_m: this.group.reduce((sum, p) => sum + p.accuracy_m, 0) / this.group.length }; }
    private close() { const stop = this.current(true); if (stop)
        this.closed.push(stop); this.group = []; this.outside = 0; }
    get stops() {
        const open = this.current();
        const result: DetectedStop[] = [];
        for (const stop of [...this.closed, ...(open ? [open] : [])]) {
            const previous = result.at(-1);
            if (previous && haversine(previous, stop) < this.config.stopRadiusM &&
                (Date.parse(stop.arrived_at) - Date.parse(previous.departed_at!)) / 1000 < Math.max(60, this.config.maxGapS, 3 * this.config.gpsIntervalMs / 1000)) {
                result[result.length - 1] = { ...previous, departed_at: stop.departed_at,
                    duration_s: (Date.parse(stop.departed_at || new Date(Date.parse(stop.arrived_at) + stop.duration_s * 1000).toISOString()) - Date.parse(previous.arrived_at)) / 1000 };
            } else result.push({ ...stop });
        }
        return result;
    }
    push(point: GpsPoint) {
        if (!point.accepted || point.accuracy_m > Math.min(50, this.config.maxAccuracyM)) {
            const last = this.lastAccepted;
            const latest = this.group.at(-1) || this.frozen.at(-1) || last;
            const identical = last && point.latitude === last.latitude && point.longitude === last.longitude;
            if (point.accuracy_m > Math.min(50, this.config.maxAccuracyM) && identical && point.speed_mps === 0 && latest && Date.parse(point.recorded_at) > Date.parse(latest.recorded_at)) {
                const extended = { ...point, accepted: true, accuracy_m: last!.accuracy_m, stationary_extended: true as const };
                if (this.group.length && this.outside === 0) {
                    this.group.push(extended);
                    this.previous = extended;
                } else this.frozen.push(extended);
            }
            return this.stops;
        }
        if (this.lastAccepted && Date.parse(point.recorded_at) <= Date.parse(this.lastAccepted.recorded_at)) return this.stops;
        // Rejeitados nao criam parada: so um ponto bom e parado confirma a extensao retroativa.
        if (this.frozen.length) {
            const last = this.lastAccepted;
            const confirms = last && point.latitude === last.latitude && point.longitude === last.longitude && point.speed_mps === 0;
            if (confirms && this.outside > 0) this.close();
            if (confirms && !this.group.length) { this.group = [...this.frozen]; this.previous = this.frozen.at(-1)!; }
            this.frozen = [];
        }
        this.lastAccepted = point; let dt = this.previous ? (Date.parse(point.recorded_at) - Date.parse(this.previous.recorded_at)) / 1000 : 0; if (this.previous && dt <= 0)
        return this.stops; if (dt > Math.max(60, this.config.maxGapS, 3 * this.config.gpsIntervalMs / 1000)) {
        // Um retorno ao mesmo local preserva o grupo; não inferimos movimento no intervalo sem sinal.
        if (dt > Math.max(60, this.config.maxGapS, 3 * this.config.gpsIntervalMs / 1000) + this.config.gpsIntervalMs / 1000 || !this.group.length || haversine(centroid(this.group), point) > Math.max(this.config.stopRadiusM, point.accuracy_m)) this.close();
        this.previous = null;
        dt = 0;
    } const speed = point.speed_mps !== null && point.speed_mps >= 0 ? point.speed_mps * 3.6 : this.previous && dt > 0 ? Math.max(0, haversine(this.previous, point) - Math.max(this.previous.accuracy_m, point.accuracy_m)) / dt * 3.6 : null; const within = this.group.length === 0 || haversine(centroid(this.group), point) <= Math.max(this.config.stopRadiusM, point.accuracy_m); const still = (speed === null || speed < this.config.stopSpeedKmh) && within; if (still) {
        this.group.push(point);
        this.outside = 0;
    }
    else if (this.group.length && ++this.outside >= 2) {
        this.close();
        if (speed === null || speed < this.config.stopSpeedKmh)
            this.group = [point];
    } this.previous = point; return this.stops; }
}
export function detectStops(points: GpsPoint[], config: Settings) { const detector = new StopDetector(config); for (const point of points)
    detector.push(point); return detector.stops; }

// Interval distance, including open stops up to their last observed duration.
export function nearbyStops(a: Stop, b: Stop) {
    const end = (s: Stop) => s.departed_at ? Date.parse(s.departed_at) : Date.parse(s.arrived_at) + s.duration_s * 1000;
    return a.trip_id === b.trip_id && haversine(a, b) < 30 &&
        Math.max(Date.parse(a.arrived_at) - end(b), Date.parse(b.arrived_at) - end(a)) < 60000;
}
export function mergeStops(stops: Stop[]): Stop[] {
    const autos = stops.filter(s => s.detected_by !== 'manual').map(s => ({ ...s }));
    const isolated: Stop[] = [];
    for (const manual of stops.filter(s => s.detected_by === 'manual')) {
        const auto = autos.filter(a => nearbyStops(a, manual)).sort((a,b) => Math.abs(Date.parse(a.arrived_at)-Date.parse(manual.arrived_at))-Math.abs(Date.parse(b.arrived_at)-Date.parse(manual.arrived_at)))[0];
        if (auto) { auto.detected_by = 'auto+manual'; auto.manually_confirmed = true; }
        else isolated.push({ ...manual });
    }
    return [...autos, ...isolated].sort((a,b) => a.arrived_at.localeCompare(b.arrived_at));
}
