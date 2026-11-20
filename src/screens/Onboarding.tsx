import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { termsSections } from '../config/terms';
import { validateProfile, type Profile } from '../services/profile';
import type { MonitorPermissions, PermissionFlags, PermissionStep } from '../services/monitorPermissions';

export function TermsText() {
    return <>{termsSections.map(section => <section key={section.title}><h3>{section.title}</h3><ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul></section>)}</>;
}

export function TermsScreen({ onAccept }: { onAccept: () => void }) {
    const [agree, setAgree] = useState(false);
    return <section className="card stack" aria-label="Termos de uso e privacidade"><h2>Termos de uso e privacidade</h2><TermsText/><label><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)}/>Li e concordo</label><button disabled={!agree} onClick={onAccept}>Continuar</button></section>;
}

export function SignupScreen({ initial, onDone, onBack }: { initial?: Profile | null; onDone: (profile: Profile) => void; onBack?: () => void }) {
    const [name, setName] = useState(initial?.name ?? ''), [email, setEmail] = useState(initial?.email ?? ''), [error, setError] = useState('');
    const submit = () => { const r = validateProfile(name, email); if ('error' in r) setError(r.error); else onDone(r.profile); };
    return <form noValidate className="card stack" onSubmit={e => { e.preventDefault(); submit(); }}><h2>Cadastro rápido</h2><p className="muted">Sem senha. Leva 20 segundos.</p>
        <label>Nome<input value={name} autoComplete="name" maxLength={60} onChange={e => { setName(e.target.value); setError(''); }}/></label>
        <label>E-mail<input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}/></label>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="bigChoice">Entrar</button>{onBack && <button type="button" className="link" onClick={onBack}>Voltar</button>}</form>;
}

const stepInfo: Record<PermissionStep, { title: string; text: string; button: string }> = {
    location: { title: '1. Localização', text: 'Para gravar o percurso com a tela apagada, o app precisa da localização "o tempo todo". Ela só é usada durante a viagem iniciada.', button: 'Permitir localização' },
    notifications: { title: '2. Avisos', text: 'O Android exige um aviso fixo enquanto a viagem está sendo gravada.', button: 'Permitir avisos' },
    battery: { title: '3. Uso contínuo', text: 'Para o Android não interromper a gravação com a tela apagada, permita o uso contínuo do app.', button: 'Permitir uso contínuo' },
};
const allSteps: PermissionStep[] = ['location', 'notifications', 'battery'];
const stepOk = (step: PermissionStep, f: PermissionFlags) => step === 'location' ? f.locationAlways : step === 'notifications' ? f.notifications : f.batteryExempt;

export function MonitorSetup({ permissions, onDone, doneLabel = 'Iniciar viagem' }: { permissions: MonitorPermissions; onDone: () => void; doneLabel?: string }) {
    const [flags, setFlags] = useState<PermissionFlags | null>(null), [skipped, setSkipped] = useState<PermissionStep[]>([]), [needsSettings, setNeedsSettings] = useState(false), [busy, setBusy] = useState(false);
    const refresh = useCallback(async () => { const next = await permissions.read(); setFlags(next); if (next.locationAlways) setNeedsSettings(false); }, [permissions]);
    useEffect(() => {
        void refresh();
        const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
        document.addEventListener('visibilitychange', visible);
        let remove: (() => Promise<void>) | undefined, disposed = false;
        if (Capacitor.isNativePlatform()) void NativeApp.addListener('appStateChange', ({ isActive }) => { if (isActive) void refresh(); }).then(h => { if (disposed) void h.remove(); else remove = () => h.remove(); }).catch(() => { });
        return () => { disposed = true; document.removeEventListener('visibilitychange', visible); void remove?.(); };
    }, [refresh]);
    if (!flags) return <p className="muted">Carregando…</p>;
    const step = allSteps.find(s => !stepOk(s, flags) && !skipped.includes(s));
    const act = async (s: PermissionStep) => { setBusy(true); try { const r = await permissions.request(s); setNeedsSettings(r.needsSettings); await refresh(); } finally { setBusy(false); } };
    if (!step) {
        const missing = allSteps.filter(s => !stepOk(s, flags));
        return <section className="card stack"><h2>Tudo pronto</h2>{missing.length ? <p className="warning" role="status">Faltou permitir: {missing.map(s => stepInfo[s].title.slice(3).toLowerCase()).join(', ')}. Na próxima viagem, o app pede de novo.</p> : <p>O aparelho está preparado para gravar viagens.</p>}<button onClick={onDone}>{doneLabel}</button></section>;
    }
    const info = stepInfo[step];
    return <section className="card stack"><h2>{info.title}</h2><p>{info.text}</p>
        {step === 'location' && needsSettings && <p className="warning" role="status">Escolha Permitir o tempo todo.</p>}
        {step === 'location' && needsSettings ? <button disabled={busy} onClick={() => void permissions.openSettings()}>Abrir permissões do app</button> : <button disabled={busy} onClick={() => void act(step)}>{info.button}</button>}
        <button className="link" onClick={() => { setNeedsSettings(false); setSkipped([...skipped, step]); }}>Agora não</button></section>;
}
