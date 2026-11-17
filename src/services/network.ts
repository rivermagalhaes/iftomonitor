import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
export interface NetworkApi {
    getStatus(): Promise<{
        connected: boolean;
    }>;
    addListener(name: 'networkStatusChange', listener: (status: {
        connected: boolean;
    }) => void): Promise<{
        remove(): Promise<void>;
    }>;
}
export async function observeNetwork(listener: (online: boolean) => void, api: NetworkApi | undefined = Capacitor.isNativePlatform() ? Network : undefined) { if (api) {
    listener((await api.getStatus()).connected);
    const handle = await api.addListener('networkStatusChange', s => listener(s.connected));
    return () => { void handle.remove(); };
} const update = () => listener(navigator.onLine); window.addEventListener('online', update); window.addEventListener('offline', update); update(); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }
