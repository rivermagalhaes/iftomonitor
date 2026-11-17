import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { Settings } from '../data/models';
import { t } from '../i18n/pt-BR';
export interface Fix {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number | null;
    timestamp: number;
}
export type GpsStatus = 'waiting' | 'ok' | 'low' | 'unavailable' | 'denied';
export interface GpsDiagnostics {
    provider: 'background' | 'foreground' | 'simulated';
    foreground: string;
    background: string;
    notification: string;
    backgroundActive: boolean;
}
export interface LocationProvider {
    diagnostics?: GpsDiagnostics;
    onDiagnostics?: (state: GpsDiagnostics) => void;
    onBatchFix?: (fixes: Fix[]) => void;
    preserveAll?: boolean;
    configurePermissions?(allow: boolean): void;
    prepareTrip?(startedAt: string): void;
    drain?(): Promise<void>;
    checkDiagnostics?(): Promise<void>;
    openSettings?(): Promise<void>;
    onFix: (fix: Fix) => void;
    onError: (message: string) => void;
    onStatus: (status: GpsStatus) => void;
    requestPermission(): Promise<void>;
    start(config: Settings): Promise<void>;
    stop(): Promise<void>;
    restart?(config: Settings): Promise<void>;
}
export interface GeolocationApi {
    checkPermissions?(): Promise<{ location: string }>;
    requestPermissions(): Promise<{
        location: string;
    }>;
    watchPosition(options: {
        enableHighAccuracy: boolean;
        timeout: number;
        maximumAge: number;
        minimumUpdateInterval: number;
        interval: number;
    }, callback: (position: {
        coords: {
            latitude: number;
            longitude: number;
            accuracy: number;
            speed: number | null;
        };
        timestamp: number;
    } | null, error?: {
        code?: string | number;
        message?: string;
    }) => void): Promise<string>;
    clearWatch(options: {
        id: string;
    }): Promise<void>;
}
const browserApi: GeolocationApi = {
    async checkPermissions() {
        if (!navigator.permissions) return { location: 'unknown' };
        const state = (await navigator.permissions.query({ name: 'geolocation' })).state;
        return { location: state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt' };
    },
    async requestPermissions() {
        if (!navigator.geolocation) throw new Error(t.noSignal);
        if (navigator.permissions) {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            if (permission.state === 'denied') throw new Error(t.permissionDenied);
            if (permission.state === 'granted') return { location: 'granted' };
        }
        await new Promise<void>((resolve, reject) => navigator.geolocation.getCurrentPosition(
            () => resolve(), error => reject(new Error(locationError(error))),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }));
        return { location: 'granted' };
    },
    async watchPosition(options, callback) {
        if (!navigator.geolocation) throw new Error(t.noSignal);
        return String(navigator.geolocation.watchPosition(p => callback(p), e => callback(null, e), options));
    },
    async clearWatch({ id }) { navigator.geolocation?.clearWatch(Number(id)); }
};
export class ForegroundProvider implements LocationProvider {
    diagnostics: GpsDiagnostics = { provider: 'foreground', foreground: 'unknown', background: 'not_supported', notification: 'not_supported', backgroundActive: false };
    onDiagnostics?: LocationProvider['onDiagnostics'];
    async checkDiagnostics() {
        const status = await this.api.checkPermissions?.();
        this.diagnostics = { ...this.diagnostics, foreground: status?.location || 'unknown' };
        this.onDiagnostics?.(this.diagnostics);
    }

    onFix: LocationProvider['onFix'] = () => { };
    onError: LocationProvider['onError'] = () => { };
    onStatus: LocationProvider['onStatus'] = () => { };
    private watchId: string | null = null;
    private running = false;
    private last = 0;
    constructor(private api: GeolocationApi = Capacitor.isNativePlatform() ? Geolocation : browserApi) { }
    async requestPermission() {
        try {
            let result = await this.api.checkPermissions?.();
            if (result?.location === 'denied') throw new Error(t.permissionPermanent);
            if (result?.location !== 'granted') result = await this.api.requestPermissions();
            if (result.location === 'denied') throw new Error(t.permissionDenied);
            this.diagnostics = { ...this.diagnostics, foreground: result.location };
            this.onDiagnostics?.(this.diagnostics);
        } catch (error) {
            const message = locationError(error);
            this.onStatus(message === t.permissionDenied || message === t.permissionPermanent ? 'denied' : 'unavailable');
            throw new Error(message);
        }
    }
    async start(config: Settings) { if (this.running)
        return; this.running = true; this.last = 0; this.onStatus('waiting'); try {
        const id = await this.api.watchPosition({ enableHighAccuracy: true, timeout: Math.max(30000, config.gpsIntervalMs * 3), maximumAge: 0, minimumUpdateInterval: config.gpsIntervalMs * .9, interval: config.gpsIntervalMs }, (position, error) => { if (!this.running)
            return; if (error || !position) {
            const denied = error?.code === 1 || error?.code === 'OS-PLUG-GLOC-0003' || error?.code === 'PERMISSION_DENIED';
            this.onStatus(denied ? 'denied' : 'unavailable');
            this.onError(locationError(error));
            return;
        } const c = position.coords; if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || !Number.isFinite(c.accuracy) || c.accuracy < 0 || Math.abs(c.latitude) > 90 || Math.abs(c.longitude) > 180)
            return; this.onStatus(c.accuracy > config.maxAccuracyM ? 'low' : 'ok'); if (this.last && position.timestamp - this.last < config.gpsIntervalMs * .9)
            return; this.last = position.timestamp; this.onFix({ latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy, speed: c.speed, timestamp: position.timestamp }); });
        if (!this.running)
            await this.api.clearWatch({ id });
        else
            this.watchId = id;
    }
    catch (error) {
        this.running = false;
        this.onStatus('unavailable');
        throw new Error(locationError(error));
    } }
    async stop() { this.running = false; if (this.watchId !== null) {
        const id = this.watchId;
        this.watchId = null;
        await this.api.clearWatch({ id });
    } }
}
export class SimulatedProvider implements LocationProvider {
    diagnostics: GpsDiagnostics = { provider: 'simulated', foreground: 'not_applicable', background: 'not_applicable', notification: 'not_applicable', backgroundActive: false };
    onDiagnostics?: LocationProvider['onDiagnostics'];
    async checkDiagnostics() { this.onDiagnostics?.(this.diagnostics); }

    onFix: LocationProvider['onFix'] = () => { };
    onError: LocationProvider['onError'] = () => { };
    onStatus: LocationProvider['onStatus'] = () => { };
    private timer: ReturnType<typeof setInterval> | null = null;
    private index = 0;
    private paused = false;
    private time = Date.now();
    private latitude = -10.175;
    private longitude = -48.884;
    async requestPermission() { }
    async start(config: Settings) { if (this.timer)
        return; this.time = Date.now(); this.index = 0; this.onStatus('ok'); this.emit(config.gpsIntervalMs); this.timer = setInterval(() => this.emit(config.gpsIntervalMs), 1000); }
    private emit(step: number) { this.time += step; this.index++; const automaticStop = this.index % Math.max(8, Math.ceil(120000 / step)) < Math.max(3, Math.ceil(30000 / step));
        const stationary = this.paused || automaticStop;
        if (!stationary) {
        this.latitude += .00012;
        this.longitude += .00008;
    } this.onFix({ latitude: this.latitude, longitude: this.longitude, accuracy: 5, speed: stationary ? 0 : 2.5, timestamp: this.time }); }
    simulateStop() { this.paused = !this.paused; }
    async stop() { if (this.timer)
        clearInterval(this.timer); this.timer = null; }
}

export function locationError(error: unknown): string {
    const e = error as { code?: string | number; message?: string } | null;
    if (e?.code === 'OS-PLUG-GLOC-0007' || e?.code === 'OS-PLUG-GLOC-0009') return t.gpsDisabled;
    if (e?.code === 2 || e?.code === 3 || e?.code === 'OS-PLUG-GLOC-0010') return t.noSignal;
    if (e?.code === 1 || e?.code === 'OS-PLUG-GLOC-0003') return t.permissionDenied;
    return e?.message || t.noSignal;
}
