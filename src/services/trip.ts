import { APP_VERSION } from '../config/version';
import { analyzeTrack, chronological, haversine } from '../lib/geo';
import type { Repository } from '../data/repository';
import { tripData, vehicleForBus } from '../data/repository';
import { pending, type GpsPoint, type TripEvent, type Route, type Trip, type Mode, type Settings, type Stop } from '../data/models';
import type { Fix, LocationProvider } from './location';
import { authorize } from './modes';
import { t } from '../i18n/pt-BR';
import { detectStops, nearbyStops } from './stops';
export class TripService {
    active: Trip | null = null;
    capturing = false;
    recordingState: 'recording' | 'restarting' | 'stopped' = 'stopped';
    onEvent: (event: TripEvent) => void = () => {};
    private checking: Promise<boolean> | null = null;
    private lastRestartAt = -Infinity;
    private resumedAt = 0;
    private closing = false;
    onChange: () => void = () => { };
    onError: (error: string) => void = () => { };
    private queue: Promise<void> = Promise.resolve();
    private accepting = false;
    private lastTimestamp = 0;
    private seen = new Set<number>();
    private persistedPoints: GpsPoint[] = [];
    constructor(public repo: Repository, public mode: Mode, public provider: LocationProvider, public config: Settings, public userId: string | null = null) {
        const enqueue = (fixes: Fix[]) => { if (!this.accepting) return;
            this.queue = this.queue.then(async () => { let changed = false; for (const fix of fixes.sort((a, b) => a.timestamp - b.timestamp)) { if (await this.record(fix)) changed = true; } if (changed) { await this.updateStops(); this.onChange(); } }).catch(e => this.onError(e instanceof Error ? e.message : t.dbError));
        };
        provider.onFix = fix => enqueue([fix]);
        provider.onBatchFix = enqueue;
    }
    async recover() { this.active = (await this.repo.all('trips')).find(t => t.status === 'recording') || null; return this.active; }
    async start(vehicleId: string, route: Route | null = null) { await authorize(this.repo, this.mode, this.userId); if (this.active || (await this.repo.all('trips')).some(t => t.status === 'recording'))
        throw new Error(t.recovery); await this.provider.requestPermission(); const bus = (await this.repo.get('app_meta', 'bus_label'))?.value; const vehicle = bus ? await vehicleForBus(this.repo, bus) : await this.repo.get('vehicles', vehicleId); if (!vehicle)
        throw new Error(t.error); const now = new Date().toISOString(); const device = (await this.repo.get('app_meta', 'device_id'))!.value; const operator = (await this.repo.get('app_meta', 'operator_label'))?.value || t.demo; const trip: Trip = { id: crypto.randomUUID(), vehicle_id: vehicle.id, vehicle_label_snapshot: vehicle.label, owner_user_id: this.mode === 'authenticated' ? this.userId : null, operator_label: operator, status: 'recording', started_at: now, ended_at: null, ended_reason: null, device_id: device, bus_label: vehicle.label, app_version: APP_VERSION, gps_interval_ms: this.config.gpsIntervalMs, route_id: route?.id || null, route_name: route?.name || '', events: [{ type: 'trip_started', at: now, details: {} }], created_at: now, updated_at: now, ...pending }; await this.repo.put('trips', trip); this.active = trip; await this.resume(); return trip; }
    async pause() {
        if (!this.active || this.active.paused) return;
        this.closing = true;
        await this.checking;
        await this.provider.stop();
        this.accepting = false;
        await this.flush();
        await this.addEvent('paused', {});
        await this.mutateTrip(this.active.id, trip => ({ ...trip, paused: true, ...pending }));
        this.capturing = false;
        this.recordingState = 'stopped';
        this.onChange();
    }
    async resume() { this.closing = false; if (!this.active)
        return; await authorize(this.repo, this.mode, this.userId); await this.provider.requestPermission();
        const wasPaused = !!this.active.paused;
        this.persistedPoints = chronological((await tripData(this.repo, this.active.id)).points);
        this.seen = new Set(this.persistedPoints.map(p => Date.parse(p.recorded_at)));
        this.lastTimestamp = Math.max(0, ...this.seen);
        this.provider.prepareTrip?.(this.active.started_at);
        if (wasPaused) this.resumedAt = Date.now();
        this.accepting = true; try {
        await this.provider.start(this.config);
        if (wasPaused) {
            await this.addEvent('resumed', {});
            await this.mutateTrip(this.active.id, trip => ({ ...trip, paused: false, ...pending }));
        }
        this.capturing = true;
        this.recordingState = this.interruption ? 'restarting' : 'recording';
        this.onChange();
    }
    catch (e) {
        this.accepting = false; this.recordingState = 'stopped';
        throw e;
    } }
    get interruptionLimitMs() { return Math.max(45000, 3 * this.config.gpsIntervalMs); }
    get lastPointAt() { return this.persistedPoints.at(-1)?.recorded_at || null; }
    get interruption(): TripEvent | null {
        for (const event of [...(this.active?.events || [])].reverse()) {
            if (event.type === 'recording_resumed') return null;
            if (event.type === 'recording_interrupted') return event;
        }
        return null;
    }
    async mutateTrip(id: string, update: (trip: Trip) => Trip): Promise<Trip> {
        const task = this.queue.then(async () => {
            const current = await this.repo.get('trips', id);
            if (!current) throw new Error('Viagem não encontrada.');
            const next = update(current);
            if (next !== current) await this.repo.put('trips', next);
            if (this.active?.id === id) this.active = next;
            this.onChange(); return next;
        });
        this.queue = task.then(() => {}, () => {});
        return task;
    }
    async addEvent(type: TripEvent['type'], details: TripEvent['details'], at = new Date().toISOString(), condition = () => true) {
        if (!this.active) return null;
        const event: TripEvent = { type, at, details };
        let added = false;
        await this.mutateTrip(this.active.id, trip => {
            if (!condition()) return trip;
            added = true;
            return { ...trip, events: [...(trip.events || []), event], updated_at: new Date().toISOString(), ...pending };
        });
        if (added) this.onEvent(event);
        return added ? event : null;
    }
    private async writeEvent(event: TripEvent) {
        if (!this.active) return;
        const current = (await this.repo.get('trips', this.active.id)) || this.active;
        this.active = { ...current, events: [...(current.events || []), event], updated_at: new Date().toISOString(), ...pending };
        await this.repo.put('trips', this.active);
        this.onEvent(event);
    }
    async watchdog(now = Date.now(), reason = 'watchdog'): Promise<boolean> {
        if (!this.active || this.active.paused || this.closing) return false;
        if (this.checking) return this.checking;
        this.checking = this.checkStale(now, reason).finally(() => { this.checking = null; });
        return this.checking;
    }
    private async checkStale(now: number, reason: string) {
        // O registro pode conter pontos atuais ainda nao repassados pela WebView.
        try { await this.provider.drain?.(); } catch { /* Continua com os pontos persistidos. */ }
        await this.flush();
        if (!this.active || this.active.paused || this.closing) return false;
        const stale = () => !!this.active && now - Math.max(this.resumedAt, Date.parse(this.lastPointAt || this.active.started_at)) > this.interruptionLimitMs;
        if (!stale() || now - this.lastRestartAt < this.interruptionLimitMs) return false;
        if (!this.interruption) {
            const event = await this.addEvent('recording_interrupted', { last_point_at: this.lastPointAt, detected_at: new Date(now).toISOString(), reason }, new Date(now).toISOString(), () => stale() && !this.interruption);
            if (!event && !this.interruption) return false;
        }
        this.lastRestartAt = now;
        this.recordingState = 'restarting'; this.onChange();
        try {
            if (this.provider.restart) await this.provider.restart(this.config);
            else { await this.provider.stop().catch(() => {}); await this.flush(); if (this.closing) return false; await this.provider.start(this.config); }
            if (this.closing) return false;
            await this.addEvent('watchdog_restarted', { seconds_without_points: (now - Date.parse(this.lastPointAt || this.active!.started_at)) / 1000, reason }, new Date(now).toISOString());
            this.capturing = true;
            this.recordingState = this.interruption ? 'restarting' : 'recording';
        } catch (error) {
            this.capturing = false; this.recordingState = 'stopped';
            this.onError(error instanceof Error ? error.message : 'Não foi possível reiniciar a gravação.');
        }
        this.onChange(); return true;
    }
    private async record(fix: Fix) {
        if (!this.active || this.seen.has(fix.timestamp)) return;
        if (!Number.isFinite(fix.timestamp) || !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || !Number.isFinite(fix.latitude) || !Number.isFinite(fix.longitude) || Math.abs(fix.latitude) > 90 || Math.abs(fix.longitude) > 180) return;
        if (!this.provider.preserveAll && this.lastTimestamp && fix.timestamp - this.lastTimestamp < this.config.gpsIntervalMs * .9) return;
        const prior = this.persistedPoints.at(-1);
        if (this.mode !== 'demo' && !this.active.paused && prior && Date.parse(prior.recorded_at) >= this.resumedAt && fix.timestamp - Date.parse(prior.recorded_at) > this.interruptionLimitMs && !this.interruption) {
            await this.writeEvent({ type: 'recording_interrupted', at: new Date().toISOString(), details: { last_point_at: prior.recorded_at, detected_at: new Date().toISOString(), reason: 'point_gap' } });
        }
        if (this.interruption && fix.timestamp > Date.parse(String(this.interruption.details.last_point_at || this.active.started_at))) {
            const interrupted = this.interruption;
            await this.writeEvent({ type: 'recording_resumed', at: new Date(fix.timestamp).toISOString(), details: { last_point_at: interrupted.details.last_point_at || this.active.started_at, interrupted_at: interrupted.at } });
            this.recordingState = 'recording';
        }
        const point: GpsPoint = { id: crypto.randomUUID(), trip_id: this.active.id, seq: Math.max(0, ...this.persistedPoints.map(p => p.seq)) + 1, latitude: fix.latitude, longitude: fix.longitude, accuracy_m: fix.accuracy, speed_mps: fix.speed, recorded_at: new Date(fix.timestamp).toISOString(), received_at: new Date().toISOString(), device_id: this.active.device_id, source: this.mode === 'demo' ? 'demo' : 'gps', accepted: fix.accuracy <= Math.min(50, this.config.maxAccuracyM), ...pending };
        const all = chronological([...this.persistedPoints, point]);
        const track = analyzeTrack(all.map(p => ({ ...p, suspect: undefined })), this.config.gpsIntervalMs);
        await this.repo.put('gps_points', track.annotated.get(point.id) || point);
        // Uma amostra atrasada pode mudar a classificacao do ponto seguinte.
        for (const existing of this.persistedPoints) {
            const classified = track.annotated.get(existing.id);
            if (classified && (classified.suspect !== existing.suspect || classified.gap_before_s !== existing.gap_before_s)) await this.repo.put('gps_points', { ...classified, ...pending });
        }
        this.persistedPoints = all.map(p => track.annotated.get(p.id) || p);
        this.seen.add(fix.timestamp);
        this.lastTimestamp = Math.max(this.lastTimestamp, fix.timestamp);
        return true;
    }
    async flush() { await this.queue; }
    async updateStops() { if (!this.active)
        return; const data = await tripData(this.repo, this.active.id); const now = new Date().toISOString(); const absorbed = new Set<string>(); for (const detected of detectStops(chronological(data.points), this.config)) {
        const existing = data.stops.find(s => s.detected_by !== 'manual' && s.arrived_at === detected.arrived_at);
        const stop: Stop = { id: existing?.id || crypto.randomUUID(), trip_id: this.active.id, arrived_at: detected.arrived_at, departed_at: detected.departed_at, duration_s: detected.duration_s, latitude: detected.latitude, longitude: detected.longitude, avg_accuracy_m: detected.avg_accuracy_m, status: existing?.status || 'candidata', label: existing?.label || t.stopAuto, detected_by: existing?.detected_by || 'auto', manually_confirmed: existing?.manually_confirmed, created_at: existing?.created_at || now, updated_at: now, ...pending };
        const manual = data.stops.find(s => s.detected_by === 'manual' && nearbyStops(stop, s));
        if (manual) {
            absorbed.add(manual.id);
            if (!existing) { stop.id = manual.id; stop.status = manual.status; stop.created_at = manual.created_at; stop.label = manual.label; }
            stop.detected_by = 'auto+manual'; stop.manually_confirmed = true;
        }
        await this.repo.put('stops', stop);
    }
    for (const stop of data.stops.filter(s => s.detected_by === 'manual' && !s.departed_at && !absorbed.has(s.id))) {
        const points = chronological(data.points).filter(p => p.accepted && !p.suspect && Date.parse(p.recorded_at) > Date.parse(stop.arrived_at));
        let moving = 0;
        let departure: string | null = null;
        let previous = data.points.filter(p => p.accepted && Date.parse(p.recorded_at) <= Date.parse(stop.arrived_at)).at(-1);
        for (const p of points) {
            const dt = previous ? (Date.parse(p.recorded_at) - Date.parse(previous.recorded_at)) / 1000 : 0;
            const speed = p.speed_mps !== null && p.speed_mps >= 0 ? p.speed_mps * 3.6 : previous && dt > 0 ? Math.max(0, haversine(previous,p)-Math.max(previous.accuracy_m,p.accuracy_m))/dt*3.6 : 0;
            moving = speed > this.config.stopSpeedKmh ? moving + 1 : 0;
            if (moving >= 2) { departure = p.recorded_at; break; }
            previous = p;
        }
        const until = departure || points.at(-1)?.recorded_at || now;
        await this.repo.put('stops', { ...stop, departed_at: departure, duration_s: Math.max(1, (Date.parse(until)-Date.parse(stop.arrived_at))/1000), updated_at: now, ...pending });
    }
    }
    async manualStop() {
        const task = this.queue.then(async () => {
            if (!this.active) return;
            const requestedAt = Date.now(), now = new Date(requestedAt).toISOString();
            const data = await tripData(this.repo, this.active.id);
            if (data.stops.some(s => s.detected_by === 'manual' && !s.departed_at)) return;
            const point = data.points.filter(p => p.accepted).sort((a,b) => Math.abs(Date.parse(a.recorded_at)-requestedAt)-Math.abs(Date.parse(b.recorded_at)-requestedAt))[0];
            if (!point) throw new Error(t.noPoint);
            const stop: Stop = { id: crypto.randomUUID(), trip_id: this.active.id, arrived_at: now, departed_at: null, duration_s: 1, latitude: point.latitude, longitude: point.longitude, avg_accuracy_m: point.accuracy_m, status: 'candidata', label: t.stopManual, detected_by: 'manual', created_at: now, updated_at: now, ...pending };
            const auto = data.stops.find(s => s.detected_by !== 'manual' && nearbyStops(s, stop));
            await this.repo.put('stops', auto ? { ...auto, detected_by: 'auto+manual', manually_confirmed: true, updated_at: now, ...pending } : stop);
            this.onChange();
        });
        this.queue = task.then(() => {}, () => {});
        await task;
    }
    async finish(recovered = false) { if (!this.active)
        return; this.closing = true; await this.checking; await this.provider.stop(); this.accepting = false; await this.queue; const data = await tripData(this.repo, this.active.id); const last = data.points.at(-1)?.recorded_at || this.active.started_at; const ended = recovered ? last : new Date(this.mode === 'demo' ? Math.max(Date.now(), Date.parse(last)) : Date.now()).toISOString(); for (const stop of data.stops.filter(s => s.departed_at === null))
        await this.repo.put('stops', { ...stop, departed_at: stop.detected_by === 'manual' ? new Date(Math.max(Date.parse(ended), Date.parse(stop.arrived_at)+1000)).toISOString() : new Date(Date.parse(stop.arrived_at) + stop.duration_s * 1000).toISOString(), duration_s: stop.detected_by === 'manual' ? Math.max(1,(Date.parse(ended)-Date.parse(stop.arrived_at))/1000) : stop.duration_s, updated_at: ended, ...pending }); await this.addEvent('trip_finished', { reason: recovered ? 'recovered' : 'user' }, ended); const trip: Trip = { ...this.active!, status: 'finished', ended_at: ended, ended_reason: recovered ? 'recovered' : 'user', updated_at: new Date().toISOString(), ...pending }; await this.repo.put('trips', trip); this.active = null; this.capturing = false; this.recordingState = 'stopped'; this.onChange(); return trip; }
    async dispose() { this.closing = true; await this.checking; await this.provider.stop(); this.accepting = false; await this.queue; this.capturing = false; }
}
