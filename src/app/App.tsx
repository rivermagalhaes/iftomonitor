import { RoutesSettings } from '../components/Routes';
import { ReliableRecordingGuide, InterruptionBanner } from '../components/RecordingReliability';
import { LogoIF } from '../components/LogoIF';
import { PageLayout } from '../components/PageLayout';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { bindNativeApp } from '../config/native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { HashRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { House, Route as RouteIcon, History, Settings as SettingsIcon } from 'lucide-react';
import { t } from '../i18n/pt-BR';
import { isSupabaseConfigured } from '../services/auth';
import { Monitor } from '../services/monitor';
import { observeNetwork } from '../services/network';
import { allowLocalFieldMode } from '../services/modes';
import { elapsed } from '../lib/time';
import { Home, TripScreen, HistoryScreen, Detail, SettingsScreen, Connection } from '../screens/Screens';
const tabs = [{ label: t.home, path: '/', Icon: House }, { label: t.trip, path: '/trip', Icon: RouteIcon }, { label: t.history, path: '/history', Icon: History }];
export function App({ monitor: provided }: {
    monitor?: Monitor;
}) { const [monitor] = useState(() => provided || new Monitor()); useEffect(() => { void monitor.run(() => monitor.restore()); let cleanup: undefined | (() => void); void observeNetwork(online => monitor.setOnline(online)).then(fn => { cleanup = fn; }); return () => { cleanup?.(); void monitor.dispose(); }; }, [monitor]); return <HashRouter><Shell monitor={monitor}/></HashRouter>; }
function Shell({ monitor: m }: {
    monitor: Monitor;
}) {
    const s = useSyncExternalStore(m.subscribe, m.getSnapshot);
    const navigate = useNavigate();
    const [field, setField] = useState(false), [nickname, setNickname] = useState(''), [consent, setConsent] = useState(false), [email, setEmail] = useState('');
    const [awake, setAwake] = useState(false);
    useEffect(() => { if (!Capacitor.isNativePlatform()) return; let disposed = false; let cleanup: (() => Promise<void>) | undefined; void bindNativeApp(NativeApp, () => !!m.snapshot.active, () => m.restore()).then(fn => { if (disposed) void fn(); else cleanup = fn; }).catch(error => m.patch({ error: String(error) })); return () => { disposed = true; void cleanup?.(); }; }, [m]);
    useEffect(() => { if (!s.notice) return; const timer = setTimeout(() => m.patch({ notice: '' }), 8000); return () => clearTimeout(timer); }, [s.notice, m]);
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        let disposed = false;
        let remove: (() => Promise<void>) | undefined;
        void NativeApp.addListener('appStateChange', ({ isActive }) => { if (isActive) void m.reconnectNative().catch(error => m.patch({ error: String(error) })); })
            .then(handle => { if (disposed) void handle.remove(); else remove = () => handle.remove(); })
            .catch(error => m.patch({ error: String(error) }));
        return () => { disposed = true; void remove?.(); };
    }, [m]);
    useEffect(() => {
        const resume = () => { if (document.visibilityState === 'visible') void m.reconnectNative().catch(error => m.patch({ error: String(error) })); };
        document.addEventListener('visibilitychange', resume);
        return () => document.removeEventListener('visibilitychange', resume);
    }, [m]);
    const [, tick] = useState(0);
    useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(timer); }, []);
    useEffect(() => { if (!s.active || !m.service?.capturing)
        return; let lock: WakeLockSentinel | undefined; let disposed = false; const request = async () => { try {
        const next = await navigator.wakeLock?.request('screen');
        if (disposed) await next?.release();
        else { if (lock && lock !== next) await lock.release(); lock = next; setAwake(!!next); next?.addEventListener('release', () => setAwake(false)); }
    }
    catch { setAwake(false); } }; const visibility = () => { if (document.visibilityState === 'visible')
        void request(); }; void request(); document.addEventListener('visibilitychange', visibility); return () => { disposed = true; void lock?.release(); document.removeEventListener('visibilitychange', visibility); }; }, [s.active?.id, s.recovery, m.service?.capturing, m]);
    const run = (action: () => Promise<unknown>) => { void m.run(action); };
    const finish = async (recovered = false) => { const trip = await m.finish(recovered); if (trip)
        navigate('/history/' + trip.id); };
    return <PageLayout>{s.mode === 'demo' && <div className="banner">{t.demoBanner}</div>}<header className="brandHeader"><LogoIF className="logo"/><div><h1>{t.appName}</h1><small>{t.subtitle}</small></div><span className="dot"/>{s.mode && <button className="link" aria-label={t.settings} onClick={() => navigate('/settings')}><SettingsIcon size={20}/></button>}</header><main>{s.mode && <InterruptionBanner monitor={m}/ >}{s.notice && <div className="notice" role="status">{s.notice}<button className="link" aria-label="Fechar aviso" onClick={() => m.patch({ notice: '' })}>X</button></div>}{s.active && !s.gpsDiagnostics.backgroundActive && <p className="muted" role="status">{awake ? t.awakeActive : t.awakeUnavailable}</p>}{s.error && <div className="error" role="alert">{s.error}<button className="link" onClick={() => m.patch({ error: '' })}>{t.retry}</button></div>}{!s.mode ? <><section className="card stack"><h2>{field ? t.consentTitle : t.login}</h2>{field ? <><p>{t.consent}</p><label>{t.nickname}<input value={nickname} maxLength={40} onChange={e => setNickname(e.target.value)}/></label><label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>{t.accept}</label><button disabled={s.busy || !consent || !nickname.trim()} onClick={() => run(() => m.enter('field', nickname, consent))}>{t.enter}</button><button className="link" onClick={() => setField(false)}>{t.back}</button></> : <><label>{t.email}<input type="email" value={email} onChange={e => setEmail(e.target.value)}/></label><button onClick={() => run(() => m.loginEmail(email))}>{t.login}</button><button className="secondary" onClick={() => run(() => m.loginGoogle())}>{t.google}</button><p className="muted">{isSupabaseConfigured() ? t.loginHint : t.cloudMissing}</p><Connection online={s.online}/></>}</section><div className="row"><button className="link" disabled={s.busy} onClick={() => run(async () => { await m.enter('demo'); navigate('/'); })}>{t.demo}</button>{allowLocalFieldMode() && <button className="link" onClick={() => setField(true)}>{t.field}</button>}</div></> : <><div className="row between"><Connection online={s.online}/><span className="badge">{s.mode === 'demo' ? t.demo : s.mode === 'authenticated' ? t.authenticated : t.field}</span></div>{s.active && <div className="card row between recordingCard"><span className="recording"><i className="pulse"/>{t.recording} · {elapsed(s.active.started_at)}</span><button className="danger" disabled={s.busy} onClick={() => { if (window.confirm(t.confirmFinish))
        run(() => finish()); }}>{t.finish}</button></div>}<Routes><Route path="/settings/reliable" element={<ReliableRecordingGuide monitor={m}/>}/><Route path="/settings/routes" element={<RoutesSettings monitor={m}/>}/><Route path="/" element={<Home monitor={m}/>}/><Route path="/trip" element={<TripScreen monitor={m}/>}/><Route path="/history" element={<HistoryScreen monitor={m}/>}/><Route path="/history/:id" element={<Detail monitor={m}/>}/><Route path="/settings" element={<SettingsScreen monitor={m}/>}/><Route path="/consent" element={<><button className="link" onClick={() => navigate('/settings')}>{t.back}</button><h2>{t.consentTitle}</h2><p className="card">{t.consent}</p></>}/></Routes></>}{s.recovery && <div className="modalBackdrop"><section role="dialog" aria-modal="true" aria-label={t.recovery} className="card stack"><h2>{t.recovery}</h2><button disabled={s.busy} onClick={() => run(() => m.resume())}>{t.resume}</button><button disabled={s.busy} className="danger" onClick={() => run(() => finish(true))}>{t.recoverFinish}</button></section></div>}</main>{s.mode && <nav>{tabs.map(({ label, path, Icon }) => <NavLink end={path === '/'} key={path} to={path}><Icon size={22}/>{label}</NavLink>)}</nav>}</PageLayout>;
}
