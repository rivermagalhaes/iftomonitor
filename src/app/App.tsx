import { RoutesSettings } from '../components/Routes';
import { InterruptionBanner } from '../components/RecordingReliability';
import { LogoIF } from '../components/LogoIF';
import { PageLayout } from '../components/PageLayout';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { bindNativeApp } from '../config/native';
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { HashRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { House, Route as RouteIcon, History, Clock, Settings as SettingsIcon, FilePenLine, ListChecks } from 'lucide-react';
import { t } from '../i18n/pt-BR';
import { isSupabaseConfigured } from '../services/auth';
import { Monitor } from '../services/monitor';
import { observeNetwork } from '../services/network';
import { allowLocalFieldMode } from '../services/modes';
import { elapsed } from '../lib/time';
import { PunctualityScreen } from '../screens/Punctuality';
import { StatusDot } from '../components/StatusDot';
import { statusKind } from '../lib/status';
import { AUTH_LOGIN_ENABLED } from '../config/auth';
import { ModeContext, type ModeApi } from './ModeContext';
import { acceptTerms, markMonitorSetupDone, monitorSetupDone, resolveInitialMode, setAppMode, termsAccepted, type AppMode } from '../services/appMode';
import { MonitorPermissions } from '../services/monitorPermissions';
import { ReportQueue, IdbReportStore, MemoryReportStore } from '../services/reports';
import { ModeChoice, MonitorSetup, TermsScreen } from '../screens/Onboarding';
import { MyReportsScreen, ReportScreen, StudentSettings } from '../screens/Student';
import { Home, TripScreen, HistoryScreen, Detail, SettingsScreen, Connection } from '../screens/Screens';
const studentTabs = [{ label: 'Relatar', path: '/', Icon: FilePenLine }, { label: 'Meus relatos', path: '/meus', Icon: ListChecks }];
const tabs = [{ label: t.home, path: '/', Icon: House }, { label: t.trip, path: '/trip', Icon: RouteIcon }, { label: t.history, path: '/history', Icon: History }, { label: t.punctuality, path: '/punctuality', Icon: Clock }];
export function App({ monitor: provided }: {
    monitor?: Monitor;
}) { return provided ? <MonitorApp monitor={provided}/> : <Root/>; }
type Phase = AppMode | null | undefined;
const frame = (children: ReactNode) => <PageLayout><header className="brandHeader"><LogoIF className="logo"/><div><h1>{t.appName}</h1><small>{t.subtitle}</small></div></header><main>{children}</main></PageLayout>;
/** Primeiro uso: termos -> escolha de modo -> (monitor) permissões. Depois, o app do modo escolhido. */
export function Root({ makeMonitor }: { makeMonitor?: () => Monitor } = {}) {
    const [mode, setMode] = useState<Phase>(undefined), [terms, setTerms] = useState(() => termsAccepted()), [setup, setSetup] = useState(false);
    const permissions = useMemo(() => new MonitorPermissions(), []);
    useEffect(() => { let live = true; void resolveInitialMode().then(m => { if (!live) return; setMode(m); if (m === 'monitor' && !monitorSetupDone()) setSetup(true); }); return () => { live = false; }; }, []);
    const api = useMemo<ModeApi | null>(() => mode ? { mode, switchTo: next => { window.location.hash = '#/'; setAppMode(next); setMode(next); if (next === 'monitor' && !monitorSetupDone()) setSetup(true); } } : null, [mode]);
    if (mode === undefined) return frame(<p className="muted">Carregando…</p>);
    if (!terms) return frame(<TermsScreen onAccept={() => { acceptTerms(); setTerms(true); }}/>);
    if (!mode) return frame(<ModeChoice onStudent={() => { setAppMode('aluno'); setMode('aluno'); }} onMonitor={() => { setAppMode('monitor'); setMode('monitor'); setSetup(true); }}/>);
    return <ModeContext.Provider value={api}>{mode === 'aluno' ? <StudentApp/> : setup ? frame(<MonitorSetup permissions={permissions} onDone={() => { markMonitorSetupDone(); setSetup(false); }}/>) : <MonitorApp monitor={makeMonitor?.()}/>}</ModeContext.Provider>;
}
/** Modo aluno: não cria o Monitor, não inicia GPS nem serviço em segundo plano. */
function StudentApp() {
    const [queue] = useState(() => new ReportQueue(typeof indexedDB === 'undefined' ? new MemoryReportStore() : new IdbReportStore()));
    useEffect(() => {
        void queue.load().then(() => queue.flush()).catch(() => { });
        let cleanup: undefined | (() => void);
        void observeNetwork(online => { if (online) void queue.flush().catch(() => { }); }).then(fn => { cleanup = fn; });
        return () => cleanup?.();
    }, [queue]);
    return <HashRouter><PageLayout><header className="brandHeader"><LogoIF className="logo"/><div><h1>{t.appName}</h1><small>{t.subtitle}</small></div><NavLink className="link" aria-label={t.settings} to="/settings"><SettingsIcon size={20}/></NavLink></header><main><Routes>
        <Route path="/" element={<ReportScreen queue={queue}/>}/><Route path="/relatar" element={<ReportScreen queue={queue}/>}/><Route path="/meus" element={<MyReportsScreen queue={queue}/>}/><Route path="/settings" element={<StudentSettings/>}/><Route path="*" element={<ReportScreen queue={queue}/>}/>
    </Routes></main><nav>{studentTabs.map(({ label, path, Icon }) => <NavLink end key={path} to={path}><Icon size={22}/>{label}</NavLink>)}</nav></PageLayout></HashRouter>;
}
function MonitorApp({ monitor: provided }: {
    monitor?: Monitor;
}) { const [monitor] = useState(() => provided || new Monitor()); useEffect(() => { void monitor.run(async () => { await monitor.restore(); if (!AUTH_LOGIN_ENABLED && !monitor.snapshot.mode) await monitor.enter('field', 'Monitor', true); }); let cleanup: undefined | (() => void); void observeNetwork(online => monitor.setOnline(online)).then(fn => { cleanup = fn; }); return () => { cleanup?.(); void monitor.dispose(); }; }, [monitor]); return <HashRouter><Shell monitor={monitor}/></HashRouter>; }
function Shell({ monitor: m }: {
    monitor: Monitor;
}) {
    const s = useSyncExternalStore(m.subscribe, m.getSnapshot);
    const navigate = useNavigate();
    const [field, setField] = useState(false), [nickname, setNickname] = useState(''), [consent, setConsent] = useState(false), [email, setEmail] = useState('');
    const [awake, setAwake] = useState(false);
    useEffect(() => { if (!Capacitor.isNativePlatform()) return; let disposed = false; let cleanup: (() => Promise<void>) | undefined; void bindNativeApp(NativeApp, () => !!m.snapshot.active, () => m.restore()).then(fn => { if (disposed) void fn(); else cleanup = fn; }).catch(error => m.patch({ error: String(error) })); return () => { disposed = true; void cleanup?.(); }; }, [m]);
    useEffect(() => { if (!s.notice) return; const timer = setTimeout(() => m.patch({ notice: '', noticeLink: undefined }), s.noticeLink ? 15000 : 8000); return () => clearTimeout(timer); }, [s.notice, m]);
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
    const finish = async (recovered = false) => { const trip = await m.finish(recovered); if (trip) {
        if (!trip.route_id) m.patch({ notice: t.noRouteWarning, noticeLink: '/history/' + trip.id });
        navigate('/history/' + trip.id);
    } };
    return <PageLayout>{s.mode === 'demo' && <div className="banner">{t.demoBanner}</div>}<header className="brandHeader"><LogoIF className="logo"/><div><h1>{t.appName}</h1><small>{t.subtitle}</small></div>{s.mode && <StatusDot kind={statusKind({ recording: !!s.active, locationDenied: s.gps === 'denied' || s.gpsDiagnostics.foreground === 'denied' || s.gpsDiagnostics.foreground === 'denied_permanently', syncError: s.trips.some(x => x.sync_status === 'error' && !x.synced_at), syncPending: isSupabaseConfigured() && m.cloudEnabled && s.mode !== 'demo' && s.trips.some(x => x.status === 'finished' && !x.synced_at) })}/>}{s.mode && <button className="link" aria-label={t.settings} onClick={() => navigate('/settings')}><SettingsIcon size={20}/></button>}</header><main>{s.mode && <InterruptionBanner monitor={m}/ >}{s.notice && <div className="notice" role="status"><span>{s.notice}{s.noticeLink && <> <button className="link" onClick={() => { navigate(s.noticeLink!); m.patch({ notice: '', noticeLink: undefined }); }}>Ir para a viagem</button></>}</span><button className="link" aria-label="Fechar aviso" onClick={() => m.patch({ notice: '', noticeLink: undefined })}>X</button></div>}{s.active && !s.gpsDiagnostics.backgroundActive && <p className="muted" role="status">{awake ? t.awakeActive : t.awakeUnavailable}</p>}{s.error && <div className="error" role="alert">{s.error}<button className="link" onClick={() => m.patch({ error: '' })}>{t.retry}</button></div>}{!s.mode ? !AUTH_LOGIN_ENABLED ? <p className="muted" role="status">{t.loading}</p> : <><section className="card stack"><h2>{field ? t.consentTitle : t.login}</h2>{field ? <><p>{t.consent}</p><label>{t.nickname}<input value={nickname} maxLength={40} onChange={e => setNickname(e.target.value)}/></label><label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>{t.accept}</label><button disabled={s.busy || !consent || !nickname.trim()} onClick={() => run(() => m.enter('field', nickname, consent))}>{t.enter}</button><button className="link" onClick={() => setField(false)}>{t.back}</button></> : <><label>{t.email}<input type="email" value={email} onChange={e => setEmail(e.target.value)}/></label><button onClick={() => run(() => m.loginEmail(email))}>{t.login}</button><button className="secondary" onClick={() => run(() => m.loginGoogle())}>{t.google}</button><p className="muted">{isSupabaseConfigured() ? t.loginHint : t.cloudMissing}</p><Connection online={s.online}/></>}</section><div className="row"><button className="link" disabled={s.busy} onClick={() => run(async () => { await m.enter('demo'); navigate('/'); })}>{t.demo}</button>{allowLocalFieldMode() && <button className="link" onClick={() => setField(true)}>{t.field}</button>}</div></> : <><div className="row between"><Connection online={s.online}/><span className="badge">{s.mode === 'demo' ? t.demo : s.mode === 'authenticated' ? t.authenticated : t.field}</span></div>{s.active && <div className="card row between recordingCard"><span className="recording"><i className="pulse"/>{t.recording} · {elapsed(s.active.started_at)}</span><button className="danger" disabled={s.busy} onClick={() => { if (window.confirm(t.confirmFinish))
        run(() => finish()); }}>{t.finish}</button></div>}<Routes><Route path="/settings/routes" element={<RoutesSettings monitor={m}/>}/><Route path="/" element={<Home monitor={m}/>}/><Route path="/trip" element={<TripScreen monitor={m}/>}/><Route path="/history" element={<HistoryScreen monitor={m}/>}/><Route path="/history/:id" element={<Detail monitor={m}/>}/><Route path="/punctuality" element={<PunctualityScreen monitor={m}/>}/><Route path="/settings" element={<SettingsScreen monitor={m}/>}/><Route path="/consent" element={<><button className="link" onClick={() => navigate('/settings')}>{t.back}</button><h2>{t.consentTitle}</h2><p className="card">{t.consent}</p></>}/></Routes></>}{s.recovery && <div className="modalBackdrop"><section role="dialog" aria-modal="true" aria-label={t.recovery} className="card stack"><h2>{t.recovery}</h2><button disabled={s.busy} onClick={() => run(() => m.resume())}>{t.resume}</button><button disabled={s.busy} className="danger" onClick={() => run(() => finish(true))}>{t.recoverFinish}</button></section></div>}</main>{s.mode && <nav>{tabs.map(({ label, path, Icon }) => <NavLink end={path === '/'} key={path} to={path}><Icon size={22}/>{label}</NavLink>)}</nav>}</PageLayout>;
}
