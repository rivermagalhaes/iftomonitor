import { Capacitor } from '@capacitor/core';
import { BackgroundGeolocation, type BackgroundGeolocationPlugin, type Location, type BackgroundGeolocationPermissionStatus } from '@capgo/background-geolocation';
import { ForegroundProvider, SimulatedProvider, locationError, type Fix, type LocationProvider, type GpsDiagnostics } from './location';
import type { Mode, Settings } from '../data/models';

export const emptyDiagnostics = (): GpsDiagnostics => ({ provider: 'foreground', foreground: 'unknown', background: 'unknown', notification: 'unknown', backgroundActive: false });
const granted = (value?: string) => value === 'granted' || value === 'always';
type Api = Pick<BackgroundGeolocationPlugin, 'start' | 'stop' | 'checkPermissions' | 'requestPermissions' | 'getLocationLog' | 'openSettings'>;

export class BackgroundNativeProvider implements LocationProvider {
    onFix: LocationProvider['onFix'] = () => {};
    onBatchFix?: LocationProvider['onBatchFix'];
    onError: LocationProvider['onError'] = () => {};
    onStatus: LocationProvider['onStatus'] = () => {};
    onDiagnostics?: LocationProvider['onDiagnostics'];
    diagnostics = emptyDiagnostics();
    preserveAll = true;
    private requestBackground = false;
    private running = false;
    private nativeStarted = false;
    private starting = false;
    private replaying = false;
    private buffered: Fix[] = [];
    private since = 0;
    private replay: Promise<void> = Promise.resolve();
    constructor(private api: Api = BackgroundGeolocation, private fallback: LocationProvider = new ForegroundProvider()) {
        fallback.onFix = fix => this.onFix(fix);
        fallback.onError = error => this.onError(error);
        fallback.onStatus = status => this.onStatus(status);
    }
    configurePermissions(allow: boolean) { this.requestBackground = allow; }
    prepareTrip(startedAt: string) { this.since = Date.parse(startedAt); }
    private publish(status: BackgroundGeolocationPermissionStatus) {
        this.diagnostics = { provider: this.nativeStarted ? 'background' : 'foreground', foreground: status.location || this.fallback.diagnostics?.foreground || 'unknown', background: status.backgroundLocation || 'unknown', notification: status.notification || 'unknown', backgroundActive: this.nativeStarted && granted(status.backgroundLocation) && granted(status.notification) };
        this.onDiagnostics?.(this.diagnostics);
    }
    private async permissions(): Promise<BackgroundGeolocationPermissionStatus> {
        try { return await this.api.checkPermissions(); }
        catch { return {}; }
    }
    async checkDiagnostics() { this.publish(await this.permissions()); }
    async requestPermission() {
        // A negativa de segundo plano nunca impede a captura com o aplicativo aberto.
        await this.fallback.requestPermission();
        let status = await this.permissions();
        if (this.requestBackground) {
            for (const permission of ['backgroundLocation', 'notification'] as const) {
                if (!granted(status[permission])) {
                    try { status = await this.api.requestPermissions({ permissions: [permission] }); }
                    catch { status = await this.permissions(); }
                }
            }
            this.requestBackground = false;
        }
        this.publish(status);
    }
    private fix(location: Location): Fix | null {
        const { latitude, longitude, accuracy, speed, time } = location;
        if (time === null || !Number.isFinite(time) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy) || accuracy < 0 || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
        if (time < this.since) return null;
        return { latitude, longitude, accuracy, speed, timestamp: time };
    }
    private deliver(fixes: Fix[]) {
        const ordered = fixes.sort((a, b) => a.timestamp - b.timestamp);
        if (this.onBatchFix) this.onBatchFix(ordered);
        else ordered.forEach(fix => this.onFix(fix));
    }
    private async startFallback(config: Settings) {
        try { await this.fallback.start(config); }
        catch (error) { this.running = false; throw error; }
    }
    async start(config: Settings) {
        if (this.running) return;
        this.running = true;
        const status = await this.permissions();
        if (!granted(status.backgroundLocation) || !granted(status.notification)) {
            this.publish(status);
            await this.startFallback(config);
            return;
        }
        this.starting = true;
        this.replaying = true;
        let initialError: unknown;
        try {
            // O registro nativo em arquivo continua mesmo com a WebView suspensa.
            await this.api.start({ backgroundTitle: 'IFTO Monitor', backgroundMessage: 'Gravando percurso do transporte escolar', requestPermissions: false, stale: false, distanceFilter: 0, minIntervalMs: 10000, locationLog: true, locationLogMaxEntries: 100000, networkFallback: false }, (location, error) => {
                if (!this.running) return;
                if (error) {
                    if (this.starting) initialError = error;
                    else { this.onStatus('unavailable'); this.onError(locationError(error)); }
                    return;
                }
                if (!location) return;
                const fix = this.fix(location);
                if (!fix) return;
                this.onStatus(fix.accuracy <= config.maxAccuracyM ? 'ok' : 'low');
                if (this.replaying) this.buffered.push(fix);
                else this.onFix(fix);
            });
            if (initialError) throw initialError;
            this.nativeStarted = true;
            this.publish(status);
            await this.drain();
        } catch (error) {
            await this.api.stop().catch(() => {});
            this.nativeStarted = false;
            this.replaying = false;
            this.deliver(this.buffered.splice(0));
            this.publish(status);
            await this.startFallback(config);
            this.onError('GPS nativo indisponível: ' + locationError(error));
        } finally { this.starting = false; }
    }
    async drain() {
        this.replay = this.replay.catch(() => {}).then(async () => {
            if (!this.nativeStarted) return;
            this.replaying = true;
            const fixes: Fix[] = [];
            try {
                let afterId = 0;
                while (true) {
                    const { entries } = await this.api.getLocationLog({ afterId, limit: 1000 });
                    if (!entries.length) break;
                    for (const entry of entries) { const fix = this.fix(entry); if (fix) fixes.push(fix); }
                    const next = Math.max(...entries.map(entry => entry.id));
                    if (next <= afterId) throw new Error('Registro nativo sem progresso de leitura.');
                    afterId = next;
                    if (entries.length < 1000) break;
                }
            } finally {
                this.deliver([...fixes, ...this.buffered.splice(0)]);
                this.replaying = false;
            }
        });
        await this.replay;
    }
    async restart(config: Settings) {
        try { await this.stop(); } catch { await this.fallback.stop().catch(() => {}); }
        finally { this.running = false; this.nativeStarted = false; }
        await this.start(config);
    }
    async reconcile(config: Settings) {
        const status = await this.permissions();
        const allowed = granted(status.backgroundLocation) && granted(status.notification);
        if (this.running && !this.nativeStarted && allowed) {
            // Permissoes concedidas nos Ajustes durante uma viagem ja em andamento.
            await this.fallback.stop();
            this.running = false;
            await this.start(config);
        } else if (this.nativeStarted && !allowed) {
            await this.stop();
            await this.start(config);
        }
    }
    async stop() {
        if (!this.running && !this.nativeStarted) return;
        // Para primeiro o sensor; importa os ultimos pontos antes de encerrar a viagem.
        if (this.nativeStarted) { await this.api.stop(); await this.drain(); }
        await this.fallback.stop();
        this.running = false;
        this.nativeStarted = false;
        this.diagnostics = { ...this.diagnostics, backgroundActive: false };
        this.onDiagnostics?.(this.diagnostics);
    }
    async openSettings() { await this.api.openSettings(); }
}
export function createLocationProvider(mode: Mode, platform = Capacitor.getPlatform(), available = Capacitor.isPluginAvailable('BackgroundGeolocation')): LocationProvider {
    if (mode === 'demo') return new SimulatedProvider();
    if (platform === 'android' && available) return new BackgroundNativeProvider();
    return new ForegroundProvider();
}
