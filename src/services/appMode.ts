// Modo do aplicativo (aluno ou monitor) e aceite dos termos. Tudo local, sem SQL.
export type AppMode = 'aluno' | 'monitor';
export const TERMS_VERSION = '2.2';
const MODE_KEY = 'ifto_app_mode', TERMS_KEY = 'ifto_terms', SETUP_KEY = 'ifto_monitor_setup_done';
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const safe = (): Store | null => { try { return localStorage; } catch { return null; } };
export function getAppMode(store: Store | null = safe()): AppMode | null {
    const value = store?.getItem(MODE_KEY);
    return value === 'aluno' || value === 'monitor' ? value : null;
}
export function setAppMode(mode: AppMode, store: Store | null = safe()) { store?.setItem(MODE_KEY, mode); }
export function termsAccepted(store: Store | null = safe(), version = TERMS_VERSION): boolean {
    try { return JSON.parse(store?.getItem(TERMS_KEY) || 'null')?.version === version; } catch { return false; }
}
export function acceptTerms(store: Store | null = safe(), version = TERMS_VERSION, now = new Date()) {
    store?.setItem(TERMS_KEY, JSON.stringify({ version, accepted_at: now.toISOString() }));
}
/** O assistente de permissões do monitor já foi concluído neste aparelho? */
export const monitorSetupDone = (store: Store | null = safe()) => store?.getItem(SETUP_KEY) === '1';
export const markMonitorSetupDone = (store: Store | null = safe()) => store?.setItem(SETUP_KEY, '1');
/** Detecta instalações antigas (v2.1 ou anterior) com viagens salvas no banco local. */
export async function hasLegacyTrips(store: Store | null = safe()): Promise<boolean> {
    if (store?.getItem('ifto_mode') === 'field' || store?.getItem('ifto_mode') === 'authenticated') return true;
    try {
        const list = await indexedDB.databases?.();
        if (!list?.some(db => db.name === 'ifto_monitor')) return false;
        const { IndexedDbRepository } = await import('../data/indexeddb');
        const repo = new IndexedDbRepository('ifto_monitor');
        try { return (await repo.all('trips')).length > 0; } finally { await repo.close(); }
    } catch { return false; }
}
/** Modo salvo; sem modo salvo, quem já tem viagens vira monitor automaticamente (sem pedir o código). */
export async function resolveInitialMode(store: Store | null = safe(), legacy: () => Promise<boolean> = () => hasLegacyTrips(store)): Promise<AppMode | null> {
    const saved = getAppMode(store);
    if (saved) return saved;
    if (await legacy()) { setAppMode('monitor', store); return 'monitor'; }
    return null;
}
