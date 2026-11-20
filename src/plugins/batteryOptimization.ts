import { Capacitor, registerPlugin } from '@capacitor/core';
export interface BatteryOptimizationPlugin {
    isIgnoringBatteryOptimizations(): Promise<{ value: boolean }>;
    requestIgnoreBatteryOptimizations(): Promise<{ value: boolean }>;
}
const native = registerPlugin<BatteryOptimizationPlugin>('BatteryOptimization');
/** Fora do Android nativo não há otimização de bateria a tratar: considera-se isento. */
export async function isIgnoringBatteryOptimizations(api: BatteryOptimizationPlugin = native, isNative = Capacitor.getPlatform() === 'android'): Promise<boolean> {
    if (!isNative) return true;
    try { return (await api.isIgnoringBatteryOptimizations()).value; } catch { return false; }
}
export async function requestIgnoreBatteryOptimizations(api: BatteryOptimizationPlugin = native, isNative = Capacitor.getPlatform() === 'android'): Promise<boolean> {
    if (!isNative) return true;
    try { return (await api.requestIgnoreBatteryOptimizations()).value; } catch { return false; }
}
