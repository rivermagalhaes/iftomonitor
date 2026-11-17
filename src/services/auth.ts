import { createClient } from '@supabase/supabase-js';
import { t } from '../i18n/pt-BR';
export function isSupabaseConfigured() { const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY; return !!url && /^https:\/\//.test(url) && !!key && !key.includes('placeholder'); }
const makeClient = () => createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, { db: { schema: 'ifto_monitor' }, auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
let client: ReturnType<typeof makeClient> | null = null;
export function getSupabase() { if (!isSupabaseConfigured())
    return null; return client ??= makeClient(); }
export const redirectUrl = () => window.location.protocol === 'capacitor:' ? 'br.edu.ifto.monitor://auth/callback' : window.location.origin + window.location.pathname;
export async function signInEmail(email: string) { const client = getSupabase(); if (!client)
    throw new Error(t.cloudMissing); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error(t.authUnavailable); const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl() } }); if (error)
    throw new Error(t.authUnavailable); }
export async function signInGoogle() { const client = getSupabase(); if (!client)
    throw new Error(t.cloudMissing); const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } }); if (error)
    throw new Error(t.authUnavailable); }
export async function exchangeCallback(url: string) { const code = new URL(url).searchParams.get('code'); if (!code)
    return; const client = getSupabase(); if (!client)
    throw new Error(t.cloudMissing); const { error } = await client.auth.exchangeCodeForSession(code); if (error)
    throw new Error(t.authUnavailable); }
