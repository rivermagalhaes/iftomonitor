import { Capacitor } from '@capacitor/core';
import { BackgroundGeolocation, type BackgroundGeolocationPlugin } from '@capgo/background-geolocation';
import { isIgnoringBatteryOptimizations, requestIgnoreBatteryOptimizations } from '../plugins/batteryOptimization';
export interface PermissionFlags { batteryExempt: boolean; locationAlways: boolean; notifications: boolean; locationForeground: boolean }
export type PermissionStep = 'location' | 'notifications' | 'battery';
type Api = Pick<BackgroundGeolocationPlugin, 'checkPermissions' | 'requestPermissions' | 'openSettings'>;
export interface PermissionDeps { api: Api; native: boolean; battery: () => Promise<boolean>; requestBattery: () => Promise<boolean> }
const ok = (v?: string) => v === 'granted' || v === 'always';
const defaults = (): PermissionDeps => ({ api: BackgroundGeolocation, native: Capacitor.getPlatform() === 'android', battery: () => isIgnoringBatteryOptimizations(), requestBattery: () => requestIgnoreBatteryOptimizations() });
export class MonitorPermissions {
    constructor(private deps: PermissionDeps = defaults()) { }
    async read(): Promise<PermissionFlags> {
        if (!this.deps.native) return { batteryExempt: true, locationAlways: true, notifications: true, locationForeground: true };
        let status: Awaited<ReturnType<Api['checkPermissions']>> = {};
        try { status = await this.deps.api.checkPermissions(); } catch { /* trata como negado */ }
        return { locationForeground: ok(status.location), locationAlways: ok(status.location) && ok(status.backgroundLocation), notifications: ok(status.notification), batteryExempt: await this.deps.battery() };
    }
    pending(flags: PermissionFlags): PermissionStep | null {
        return !flags.locationAlways ? 'location' : !flags.notifications ? 'notifications' : !flags.batteryExempt ? 'battery' : null;
    }
    /** Pede somente uma etapa (um diálogo do sistema). Retorna se, depois do pedido, ela está concedida. */
    async request(step: PermissionStep): Promise<{ done: boolean; needsSettings: boolean }> {
        if (!this.deps.native) return { done: true, needsSettings: false };
        if (step === 'battery') { await this.deps.requestBattery(); return { done: (await this.read()).batteryExempt, needsSettings: false }; }
        if (step === 'notifications') {
            try { await this.deps.api.requestPermissions({ permissions: ['notification'] }); } catch { /* negado */ }
            return { done: (await this.read()).notifications, needsSettings: false };
        }
        let flags = await this.read();
        if (!flags.locationForeground) { try { await this.deps.api.requestPermissions({ permissions: ['location'] }); } catch { /* negado */ } flags = await this.read(); }
        if (flags.locationForeground && !flags.locationAlways) { try { await this.deps.api.requestPermissions({ permissions: ['backgroundLocation'] }); } catch { /* negado */ } flags = await this.read(); }
        // Android 11+: só "durante o uso" → levar o usuário às permissões do app.
        return { done: flags.locationAlways, needsSettings: flags.locationForeground && !flags.locationAlways };
    }
    async openSettings() { try { await this.deps.api.openSettings(); } catch { /* sem tela de ajustes */ } }
}
