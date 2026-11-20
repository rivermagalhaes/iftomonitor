import { mergeStops } from './stops';
import { RouteService } from './routes';
import { BackgroundNativeProvider, createLocationProvider, emptyDiagnostics } from './background-location';
import { IndexedDbRepository } from '../data/indexeddb';
import { initialize, databaseName, vehicleForBus, type Repository } from '../data/repository';
import { defaults, pending, type Settings, type Mode, type Vehicle, type Route, type TripEvent, type Trip, type GpsPoint, type Stop } from '../data/models';
import { SimulatedProvider, type LocationProvider, type GpsStatus, type GpsDiagnostics } from './location';
import { TripService } from './trip';
import { acceptConsent, allowLocalFieldMode } from './modes';
import { t } from '../i18n/pt-BR';
import { MonitorPermissions } from './monitorPermissions';
import { getSupabase, exchangeCallback, signInEmail, signInGoogle } from './auth';
import { cloudWriter, syncCloud } from './cloudSync';
import { cloneReference, defaultReference, mergeReference, validateReference, type ReferenceConfig } from '../config/reference';
import type { ShiftOverride } from '../lib/punctuality';

export interface Snapshot {
    mode: Mode | null;
    operator: string;
    busLabel: string;
    batteryConfirmed: boolean;
    vehicles: Vehicle[];
    routes: Route[];
    recordingState: 'recording' | 'restarting' | 'stopped';
    lastPointAt: string | null;
    interruption: { from: string; to: string } | null;
    trips: Trip[];
    points: GpsPoint[];
    stops: Stop[];
    active: Trip | null;
    recovery: boolean;
    gps: GpsStatus;
    gpsDiagnostics: GpsDiagnostics;
    backgroundExplained: boolean;
    error: string;
    notice: string;
    /** Atalho opcional exibido junto ao aviso (rota do app). */
    noticeLink?: string;
    busy: boolean;
    settings: Settings;
    reference: ReferenceConfig;
    online: boolean;
}
export class Monitor {
    private listeners = new Set<() => void>();
    private repository: Repository | null = null;
    service: TripService | null = null;
    provider: LocationProvider | null = null;
    private userId: string | null = null;
    private watchdogTimer: ReturnType<typeof setInterval> | null = null;
    private reconnectTask: Promise<void> | null = null;
    private restartedTrips = new Set<string>();
    private syncTimer: ReturnType<typeof setTimeout> | null = null;
    snapshot: Snapshot = { mode: null, operator: '', busLabel: '', batteryConfirmed: false, vehicles: [], routes: [], recordingState: 'recording', lastPointAt: null, interruption: null, trips: [], points: [], stops: [], active: null, recovery: false, gps: 'waiting', gpsDiagnostics: emptyDiagnostics(), backgroundExplained: false, error: '', notice: '', busy: false, settings: { ...defaults }, reference: cloneReference(defaultReference), online: navigator.onLine };
    constructor(private open: (name: string) => Promise<Repository> = async (name) => new IndexedDbRepository(name), private location: (mode: Mode) => LocationProvider = createLocationProvider, public permissions: MonitorPermissions = new MonitorPermissions()) { }
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
    getSnapshot = () => this.snapshot;
    patch(patch: Partial<Snapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(fn => fn()); }
    async run(action: () => Promise<unknown>) { if (this.snapshot.busy)
        return; this.patch({ busy: true, error: '', notice: '' }); try {
        return await action();
    }
    catch (e) {
        this.patch({ error: e instanceof Error ? e.message : t.error });
    }
    finally {
        this.patch({ busy: false });
    } }
    async enter(mode: Mode, operator?: string, accepted = false) { if (mode === 'field' && !allowLocalFieldMode())
        throw new Error(t.fieldDisabled); if (this.service?.capturing)
        throw new Error(t.recording); await this.service?.dispose(); await this.repository?.close(); const repository = await this.open(databaseName(mode)); await initialize(repository, mode); const savedBus = (await repository.get('app_meta', 'bus_label'))?.value; if (savedBus?.trim()) await vehicleForBus(repository, savedBus); if (mode === 'field' && operator !== undefined)
        await acceptConsent(repository, operator, accepted); this.repository = repository; const settingsRow = await repository.get('app_meta', 'settings'); let settings = { ...defaults }; try {
        if (settingsRow)
            settings = { ...defaults, ...JSON.parse(settingsRow.value) };
    }
    catch { /* retain defaults */ } settings.maxGapS = Math.max(60, settings.maxGapS, 3 * settings.gpsIntervalMs / 1000); const provider = this.location(mode); provider.onDiagnostics = gpsDiagnostics => {
        const previous = this.snapshot.gpsDiagnostics;
        if (this.service?.active && (previous.foreground !== gpsDiagnostics.foreground || previous.background !== gpsDiagnostics.background || previous.notification !== gpsDiagnostics.notification)) void this.service.addEvent('permission_changed', { previous, current: gpsDiagnostics }).catch(error => this.patch({ error: String(error) }));
        this.patch({ gpsDiagnostics });
    }; provider.onError = message => this.patch({ error: message }); provider.onStatus = gps => {
        const previous = this.snapshot.gps;
        if (this.service?.active && gps !== previous) {
            const type = gps === 'denied' || previous === 'denied' ? 'permission_changed' : gps === 'unavailable' ? 'gps_lost' : previous === 'unavailable' && (gps === 'ok' || gps === 'low') ? 'gps_restored' : null;
            if (type) void this.service.addEvent(type, { previous, current: gps }).catch(error => this.patch({ error: String(error) }));
        }
        this.patch({ gps });
    }; this.provider = provider; this.service = new TripService(repository, mode, provider, settings, this.userId); this.service.onChange = () => { void this.refresh().catch(() => this.patch({ error: t.dbError })); }; this.service.onError = error => this.patch({ error }); this.service.onEvent = event => this.recordingEvent(event); const active = await this.service.recover(); let reference = cloneReference(); try { const row = await repository.get('app_meta', 'reference'); if (row) reference = mergeReference(JSON.parse(row.value)); } catch { /* mantém os padrões */ } this.patch({ reference, busLabel: (await repository.get('app_meta', 'bus_label'))?.value || '', batteryConfirmed: (await repository.get('app_meta', 'battery_confirmed'))?.value === '1', gpsDiagnostics: { ...emptyDiagnostics(), provider: mode === 'demo' ? 'simulated' : 'foreground' }, interruption: null, backgroundExplained: !!await repository.get('app_meta', 'background_education_seen'), mode, settings, operator: (await repository.get('app_meta', 'operator_label'))?.value || t.demo, active, recovery: !!active, gps: 'waiting' }); localStorage.setItem('ifto_mode', mode); await this.refresh(); await this.refreshGpsDiagnostics();
        if (active && mode !== 'demo') {
            if (!this.restartedTrips.has(active.id)) {
                this.restartedTrips.add(active.id);
                await this.service.addEvent('app_restarted', { last_point_at: this.snapshot.lastPointAt, detected_at: new Date().toISOString() });
            }
            if (!active.paused) { await this.resume(); await this.checkRecording('app_restarted'); } else this.patch({ recovery: false });
        }
        if (this.watchdogTimer) clearInterval(this.watchdogTimer);
        if (mode !== 'demo') this.watchdogTimer = setInterval(() => { if (!this.snapshot.busy) void this.checkRecording().catch(error => this.patch({ error: String(error) })); }, 15000);
        void this.sync().catch(() => { }); }
    async restore() { const mode = localStorage.getItem('ifto_mode'); if (mode === 'demo' || mode === 'field' && allowLocalFieldMode()) {
        await this.enter(mode);
        return;
    } const client = getSupabase(); if (client) {
        await exchangeCallback(window.location.href);
        const { data } = await client.auth.getSession();
        if (data.session) {
            const { data: profile, error } = await client.from('profiles').select('active').eq('id', data.session.user.id).single();
            if (error || !profile?.active)
                throw new Error(t.authUnavailable);
            this.userId = data.session.user.id;
            await this.enter('authenticated');
        }
    } }
    async loginEmail(email: string) { await signInEmail(email); this.patch({ error: t.authSent }); }
    async loginGoogle() { await signInGoogle(); }
    async leave() { if (this.snapshot.active)
        throw new Error(t.recording); await this.dispose(); localStorage.removeItem('ifto_mode'); this.repository = null; this.service = null; this.provider = null; this.patch({ mode: null, operator: '', busLabel: '', batteryConfirmed: false, vehicles: [], routes: [], trips: [], points: [], stops: [], active: null, recovery: false, interruption: null, lastPointAt: null, recordingState: 'stopped' }); }
    get cloudEnabled() { return localStorage.getItem('ifto_cloud_enabled') !== '0'; }
    get lastCloudSync() { return this.snapshot.trips.map(t=>t.synced_at||'').sort().at(-1)||''; }
    async setCloudEnabled(enabled: boolean) { localStorage.setItem('ifto_cloud_enabled',enabled?'1':'0'); await this.refresh(); if(enabled) void this.sync(); }
    async sync(manual = false) {
        if (!this.repository) return;
        const writer = cloudWriter();
        if (!writer && manual) this.patch({ notice: t.cloudMissing });
        await syncCloud(this.repository,writer,()=>this.cloudEnabled && this.snapshot.online && this.snapshot.mode!=='demo' && !this.service?.active,manual);
        await this.refresh();
        if(this.syncTimer) clearTimeout(this.syncTimer);
        const retries=this.snapshot.trips.filter(t=>!t.synced_at && t.next_retry_at).map(t=>Date.parse(t.next_retry_at!));
        if(retries.length && this.cloudEnabled && this.snapshot.online && !this.service?.active) this.syncTimer=setTimeout(()=>{void this.sync();},Math.max(5000,Math.min(...retries)-Date.now()));
    }
    setOnline(online: boolean) { const changed = !this.snapshot.online && online; this.patch({ online }); if (changed)
        void this.sync().catch(() => { }); }
    async refresh() { if (!this.repository)
        return; const [vehicles, trips, points, stops, routes] = await Promise.all([this.repository.all('vehicles'), this.repository.all('trips'), this.repository.all('gps_points'), this.repository.all('stops'), this.repository.all('routes')]); const active = this.service?.active || null; const last = points.filter(p => p.trip_id === active?.id).sort((a,b) => a.recorded_at.localeCompare(b.recorded_at)).at(-1); this.patch({ vehicles, routes: routes.sort((a,b) => a.name.localeCompare(b.name, 'pt-BR')), lastPointAt: last?.recorded_at || null, recordingState: this.service?.recordingState || 'stopped', trips: trips.sort((a, b) => b.started_at.localeCompare(a.started_at)), points: points.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at) || a.seq - b.seq), stops: mergeStops(stops), active: this.service?.active || null }); }
    get needsBackgroundEducation() { return this.snapshot.mode !== 'demo' && this.provider instanceof BackgroundNativeProvider && !this.snapshot.backgroundExplained; }
    async refreshGpsDiagnostics() {
        try { await this.provider?.checkDiagnostics?.(); if (this.snapshot.mode !== 'demo') this.patch({ batteryConfirmed: (await this.permissions.read()).batteryExempt }); }
        catch { this.patch({ gpsDiagnostics: { ...emptyDiagnostics(), provider: this.snapshot.gpsDiagnostics.provider } }); }
    }
    private recordingEvent(event: TripEvent) {
        if (event.type === 'recording_interrupted' || event.type === 'recording_resumed' || event.type === 'app_restarted') {
            const from = String(event.details.last_point_at || this.service?.active?.started_at || event.at);
            this.patch({ interruption: { from, to: event.type === 'recording_resumed' ? event.at : String(event.details.detected_at || event.at) } });
        }
    }
    async checkRecording(reason = 'watchdog', now = Date.now()) {
        if (!this.service?.active || this.snapshot.mode === 'demo') return false;
        const result = await this.service.watchdog(now, reason); await this.refresh(); return result;
    }
    async reconnectNative() {
        if (this.reconnectTask) return this.reconnectTask;
        this.reconnectTask = this.handleResume().finally(() => { this.reconnectTask = null; });
        return this.reconnectTask;
    }
    private async handleResume() {
        await this.refreshGpsDiagnostics();
        if (!this.service?.active || this.service.active.paused) return;
        if (this.provider instanceof BackgroundNativeProvider) await this.provider.reconcile(this.snapshot.settings);
        await this.checkRecording('resume');
    }
    async saveBusLabel(value: string) {
        const busLabel = value.trim().slice(0, 60);
        if (!busLabel) throw new Error('Escolha o nome do onibus.');
        await vehicleForBus(this.repository!, busLabel);
        await this.repository!.put('app_meta', { key: 'bus_label', value: busLabel });
        await this.refresh();
        this.patch({ busLabel });
    }
    get recordingReadiness(): 'ready' | 'foreground' | 'attention' | 'denied' | 'demo' {
        const s = this.snapshot, d = s.gpsDiagnostics;
        if (s.mode === 'demo') return 'demo';
        if (d.foreground === 'denied' || d.foreground === 'denied_permanently' || (d.foreground === 'unknown' && s.gps === 'denied')) return 'denied';
        if (d.foreground !== 'granted' && d.foreground !== 'always') return 'attention';
        if (d.background !== 'granted' && d.background !== 'always') return 'foreground';
        return this.reliableRecording && (!s.active || (!s.active.paused && d.backgroundActive && s.recordingState === 'recording')) ? 'ready' : 'attention';
    }
    /** Reabre SOMENTE a etapa pendente (um diálogo do sistema); negar não impede a viagem. */
    async requestPendingPermission() {
        const step = this.permissions.pending(await this.permissions.read());
        if (step) await this.permissions.request(step);
        await this.refreshGpsDiagnostics();
    }
    get reliableRecording() {
        const d = this.snapshot.gpsDiagnostics;
        return (this.provider instanceof BackgroundNativeProvider || d.backgroundActive) && this.snapshot.batteryConfirmed && ['granted', 'always'].includes(d.foreground) && ['granted', 'always'].includes(d.background) && ['granted', 'always'].includes(d.notification);
    }
    private routeService() {
        if (!this.repository || !this.service) throw new Error('Entre em um modo antes de editar rotas.');
        return new RouteService(this.repository, (id, update) => this.service!.mutateTrip(id, update));
    }
    async addRoute(name: string) { const route = await this.routeService().create(name); await this.refresh(); return route; }
    async renameRoute(id: string, name: string) { await this.routeService().rename(id, name); await this.refresh(); }
    async setRouteActive(id: string, active: boolean) { await this.routeService().setActive(id, active); await this.refresh(); }
    async setTripRoute(id: string, routeId: string | null) { await this.routeService().change(id, routeId); await this.refresh(); }
    lastRouteForVehicle(vehicleId: string) {
        const trip = this.snapshot.trips.find(t => t.vehicle_id === vehicleId);
        return this.snapshot.routes.some(r => r.id === trip?.route_id && r.active) ? trip!.route_id! : null;
    }
    async start(vehicleId: string, allowBackground?: boolean, routeId: string | null = null) {
        vehicleId = (await vehicleForBus(this.repository!, this.snapshot.busLabel)).id;
        if (allowBackground !== undefined) {
            this.provider?.configurePermissions?.(allowBackground);
            await this.repository?.put('app_meta', { key: 'background_education_seen', value: '1' });
            this.patch({ backgroundExplained: true });
        }
        if (this.service)
        this.service.userId = this.userId; try {
        const route = routeId ? await this.repository!.get('routes', routeId) : null;
        if (routeId && (!route || !route.active)) throw new Error('Escolha uma rota ativa.');
        if (this.snapshot.mode !== 'demo') await this.requestPendingPermission();
        const { batteryExempt, locationAlways, notifications } = await this.permissions.read(); const flags = { batteryExempt, locationAlways, notifications };
        await this.service?.start(vehicleId, route, flags);
        this.patch({ interruption: null });
        this.patch({ recovery: false });
    }
    finally {
        await this.refresh();
        if (this.service?.active && !this.service.capturing)
            this.patch({ recovery: true });
    } }
    async pause() { await this.service?.pause(); await this.refresh(); }
    async resume() { await this.service?.resume(); this.patch({ recovery: false }); await this.refresh(); }
    async finish(recovered = false) { const trip = await this.service?.finish(recovered); this.patch({ recovery: false }); await this.refresh(); void this.sync().catch(() => { }); return trip; }
    async renameVehicle(id: string, label: string) { const v = this.snapshot.vehicles.find(v => v.id === id); if (!v || !label.trim())
        return; await this.repository!.put('vehicles', { ...v, label: label.trim().slice(0, 60), updated_at: new Date().toISOString(), ...pending }); await this.refresh(); }
    async editStop(id: string, patch: Partial<Pick<Stop, 'status' | 'label'>>) { const stop = this.snapshot.stops.find(s => s.id === id); if (!stop)
        return; await this.repository!.put('stops', { ...stop, ...patch, updated_at: new Date().toISOString(), ...pending }); await this.refresh(); }
    async saveSettings(settings: Settings) { settings = { ...settings, stopMinDurationS: Math.max(10, settings.stopMinDurationS), maxGapS: Math.max(60, settings.maxGapS, 3 * settings.gpsIntervalMs / 1000) }; for (const n of Object.values(settings))
        if (!Number.isFinite(n) || n <= 0)
            throw new Error(t.error); if (this.service?.capturing)
        throw new Error(t.recording); await this.repository!.put('app_meta', { key: 'settings', value: JSON.stringify(settings) }); if (this.service)
        this.service.config = settings; this.patch({ settings }); }
    async saveReference(reference: ReferenceConfig) {
        const errors = validateReference(reference);
        if (errors.length) throw new Error(errors.join(' '));
        await this.repository!.put('app_meta', { key: 'reference', value: JSON.stringify(reference) });
        this.patch({ reference: cloneReference(reference) });
    }
    async setTripShift(id: string, shift: ShiftOverride) {
        const now = new Date().toISOString();
        const write = (update: (trip: Trip) => Trip) => this.service ? this.service.mutateTrip(id, update) : Promise.reject(new Error('Entre em um modo antes.'));
        await write(trip => ({ ...trip, shift_override: shift, updated_at: now }));
        await this.refresh();
    }
    async manual() { await this.service?.manualStop(); await this.refresh(); }
    simulateStop() { if (this.provider instanceof SimulatedProvider)
        this.provider.simulateStop(); }
    async clearDemo() {
        if (this.snapshot.mode !== 'demo' || this.snapshot.active) throw new Error(t.recording);
        await this.dispose();
        await new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase('ifto_monitor_demo');
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error || new Error(t.dbError));
            request.onblocked = () => reject(new Error(t.demoDatabaseBusy));
        });
        await this.enter('demo');
    }
    async dispose() { if (this.watchdogTimer) clearInterval(this.watchdogTimer); this.watchdogTimer = null; if (this.syncTimer)
        clearTimeout(this.syncTimer); await this.service?.dispose(); await this.repository?.close(); }
}
