// Cadastro rápido (nome + e-mail, sem senha) e aceite dos termos. Tudo local; nenhum SQL.
export const TERMS_VERSION = '2.3';
const PROFILE_KEY = 'ifto_profile', TERMS_KEY = 'ifto_terms';
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const safe = (): Store | null => { try { return localStorage; } catch { return null; } };
export interface Profile { name: string; email: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Valida e normaliza; devolve erro curto em português ou o perfil. */
export function validateProfile(nameInput: string, emailInput: string): { error: string } | { profile: Profile } {
    const name = nameInput.replace(/\s+/g, ' ').replace(/[<>|\[\]]/g, '').trim(), email = emailInput.trim().toLowerCase();
    if (name.length < 2) return { error: 'Digite seu nome.' };
    if (name.length > 60) return { error: 'O nome deve ter até 60 caracteres.' };
    if (email.length > 120 || !EMAIL.test(email)) return { error: 'Digite um e-mail válido.' };
    return { profile: { name, email } };
}
export function getProfile(store: Store | null = safe()): Profile | null {
    try { const p = JSON.parse(store?.getItem(PROFILE_KEY) || 'null'); return p && typeof p.name === 'string' && typeof p.email === 'string' && p.name && p.email ? { name: p.name, email: p.email } : null; } catch { return null; }
}
export const saveProfile = (profile: Profile, store: Store | null = safe()) => { store?.setItem(PROFILE_KEY, JSON.stringify(profile)); };
/** "Trocar usuário": apaga só o cadastro (viagens, relatos e configuração ficam). */
export const clearProfile = (store: Store | null = safe()) => { store?.removeItem(PROFILE_KEY); };
export const firstName = (profile: Profile | null) => profile?.name.split(' ')[0] ?? '';

export function termsAccepted(store: Store | null = safe(), version = TERMS_VERSION): boolean {
    try { return JSON.parse(store?.getItem(TERMS_KEY) || 'null')?.version === version; } catch { return false; }
}
export function acceptTerms(store: Store | null = safe(), version = TERMS_VERSION, now = new Date()) {
    store?.setItem(TERMS_KEY, JSON.stringify({ version, accepted_at: now.toISOString() }));
}
/** Permissões do Android: o assistente roda uma vez, no primeiro "Iniciar viagem". */
const TRIP_SETUP_KEY = 'ifto_trip_setup_done';
export const tripSetupDone = (store: Store | null = safe()) => store?.getItem(TRIP_SETUP_KEY) === '1';
export const markTripSetupDone = (store: Store | null = safe()) => store?.setItem(TRIP_SETUP_KEY, '1');
