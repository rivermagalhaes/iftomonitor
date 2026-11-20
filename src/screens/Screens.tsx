import { BusLabel } from '../components/BusLabel';
import { RecordingReadiness } from '../components/RecordingReadiness';
import { StartTrip } from '../components/StartTrip';
import { TripRouteEditor } from '../components/Routes';
import { RecordingEvents } from '../components/RecordingReliability';
import { GpsDiagnostics, RecordingGpsState } from '../components/GpsDiagnostics';
import { isSupabaseConfigured } from '../services/auth';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import { t } from '../i18n/pt-BR';
import type { Monitor } from '../services/monitor';
import { TripMap } from '../components/TripMap';
import { distance, analyzeTrack, durationMMSS } from '../lib/geo';
import { dateTime, elapsed } from '../lib/time';
import type { Trip, Settings } from '../data/models';
import { TripShiftEditor } from './Punctuality';
import { ReferenceSettings } from '../components/ReferenceSettings';
import { useProfile } from '../app/ProfileContext';
import { firstName, validateProfile } from '../services/profile';
import { ScreenHeader } from '../components/ScreenHeader';
import { MyReportsScreen } from './Student';
import type { ReportQueue } from '../services/reports';
import { PunctualityScreen } from './Punctuality';
import { exportTrip, type ExportFormat } from '../services/export';
import { Speedometer, TripSpeedSummary } from '../components/Speedometer';
export function Connection({ online }: {
    online: boolean;
}) { return <span className="row muted">{online ? <Wifi size={16}/> : <WifiOff size={16}/>} {online ? t.online : t.offline}</span>; }
function Back() { const navigate = useNavigate(); return <button className="link row" onClick={() => navigate('/history')}><ArrowLeft size={18}/>{t.back}</button>; }
export function Home({ monitor: m }: {
    monitor: Monitor;
}) {
    const s = m.snapshot, navigate = useNavigate(), { profile } = useProfile();
    const configured = isSupabaseConfigured(), unsynced = s.trips.filter(t => t.status === 'finished' && !t.synced_at).length, last = s.trips.find(t => t.status === 'finished');
    return <>
        <h2>{profile ? `Olá, ${firstName(profile)}!` : t.demoGreeting}</h2>
        <button className="bigAction go" onClick={() => navigate('/trip')}>{s.active ? 'Viagem em andamento' : t.start}</button>
        <button className="bigAction report" onClick={() => navigate('/report')}>Relatar problema</button>
        <p className="muted">{last ? `Última viagem: ${last.bus_label || last.vehicle_label_snapshot} · ${dateTime(last.started_at)}` : 'Nenhuma viagem ainda.'}</p>
        <p className="muted">{configured ? (unsynced ? `${unsynced} pendente(s) de envio` : 'Tudo enviado') : t.savedLocal}</p>
        <button className="secondary full" disabled={!configured || s.mode === 'demo' || s.busy} onClick={() => void m.run(() => m.sync(true))}>{!configured && s.mode !== 'demo' ? t.cloudMissing : 'Sincronizar agora'}</button>
        {s.mode === 'demo' && <p className="muted">{t.demoNoSync}</p>}
        <p role="status">{!configured ? t.cloudMissing : !m.cloudEnabled ? 'Nuvem desligada' : !s.online ? 'Sem internet' : s.trips.some(t => t.sync_status === 'error' && !t.synced_at) ? 'Erro ao enviar (tentar de novo)' : unsynced ? `${unsynced} viagens pendentes` : `Tudo sincronizado ${m.lastCloudSync ? new Date(m.lastCloudSync).toLocaleString('pt-BR') : ''}`}</p>
    </>;
}
function Summary({ trip, monitor: m }: {
    trip: Trip;
    monitor: Monitor;
}) { const points = m.snapshot.points.filter(p => p.trip_id === trip.id), track = analyzeTrack(points, trip.gps_interval_ms || m.snapshot.settings.gpsIntervalMs), stops = m.snapshot.stops.filter(s => s.trip_id === trip.id && s.status !== 'descartada'); return <><div className="row between"><h3>{trip.bus_label || trip.vehicle_label_snapshot}{trip.route_name ? ' · ' + trip.route_name : ''}</h3>{!trip.route_name && <span className="muted">Sem rota</span>}<span className="badge">{trip.synced_at ? 'Enviada' : trip.sync_status === 'error' ? 'Erro' : 'Pendente'}</span></div><p>{dateTime(trip.started_at)} — {dateTime(trip.ended_at)}</p><p className="muted">{elapsed(trip.started_at, trip.ended_at)} · {(distance(points, trip.gps_interval_ms || m.snapshot.settings.gpsIntervalMs) / 1000).toFixed(2)} km · {points.length} {t.gpsPoints} · {stops.length} {t.stops}</p><p>Lacunas de sinal: {track.gaps.length} (total {durationMMSS(track.gapSeconds)})</p>{track.gaps.length > 0 && <span className="badge warning">Gravação incompleta</span>}</>; }
export function TripScreen({ monitor: m }: {
    monitor: Monitor;
}) {
    const s = m.snapshot, active = s.active, navigate = useNavigate();
    const points = s.points.filter(p => p.trip_id === active?.id), stops = s.stops.filter(p => p.trip_id === active?.id);
    const last = points.at(-1);
    return <><ScreenHeader onBack={() => navigate('/')}/><h2>{t.trip}</h2><p><strong>{active?.bus_label || active?.vehicle_label_snapshot || s.busLabel || "Ônibus não definido"}</strong></p><RecordingReadiness monitor={m}/>{!active ? <StartTrip monitor={m}/> : <>
        <div className="card"><h3>{active.bus_label || active.vehicle_label_snapshot}{active.route_name ? ' · ' + active.route_name : ''}</h3>{!active.route_name && <p className="muted">Sem rota</p>}<RecordingGpsState monitor={m}/>
            <div className="row between"><strong>{elapsed(active.started_at)}</strong><span className="badge">{s.gps === 'ok' ? t.signalOk : s.gps === 'low' ? t.lowAccuracy : s.gps === 'waiting' ? t.waiting : s.gps === 'denied' ? t.permissionDenied : t.noSignal}</span></div>
            <p>{points.length} {t.gpsPoints} · {stops.filter(s => s.status !== 'descartada').length} {t.stops}</p><p className="muted">{t.accuracy}: {last ? Math.round(last.accuracy_m) + ' m' : '—'}</p>
        </div><Speedometer points={points}/><TripRouteEditor monitor={m} trip={active}/><TripMap points={points} stops={stops} online={s.online} intervalMs={active.gps_interval_ms || s.settings.gpsIntervalMs}/>
        <div className="row card"><button disabled={s.busy} onClick={() => void m.run(() => active.paused ? m.resume() : m.pause())}>{active.paused ? 'Retomar gravação' : 'Pausar gravação'}</button><button disabled={s.busy} onClick={() => void m.run(() => m.manual())}>{t.manual}</button><button className="bigAction report" onClick={() => navigate('/report')}>Relatar problema</button>{s.mode === 'demo' && <button className="secondary" onClick={() => m.simulateStop()}>{t.simulatedStop}</button>}</div><Stops monitor={m} tripId={active.id}/>
    </>}</>;
}
export function Stops({ monitor: m, tripId }: {
    monitor: Monitor;
    tripId: string;
}) { return <section className="card"><h3>{t.stops}</h3>{m.snapshot.stops.filter(s => s.trip_id === tripId).map(stop => <article className="stop" key={stop.id}><strong>{stop.label}</strong>{stop.manually_confirmed && <span className="badge">confirmada manualmente</span>} <span className="badge">{t.statuses[stop.status]}</span><p className="muted">{dateTime(stop.arrived_at)} · {Math.round(stop.duration_s)} s</p><div className="row">{stop.status === 'candidata' && <><button disabled={m.snapshot.busy} onClick={() => void m.run(() => m.editStop(stop.id, { status: 'confirmada' }))}>{t.confirm}</button><button disabled={m.snapshot.busy} className="secondary" onClick={() => void m.run(() => m.editStop(stop.id, { status: 'descartada' }))}>{t.discard}</button></>}{stop.status !== 'candidata' && <button className="secondary" disabled={m.snapshot.busy} onClick={() => void m.run(() => m.editStop(stop.id, { status: 'candidata' }))}>{stop.status === 'descartada' ? t.restore : t.backCandidate}</button>}{stop.status !== 'descartada' && <button className="link" disabled={m.snapshot.busy} onClick={() => { const label = window.prompt(t.stopName, stop.label); if (label)
    void m.run(() => m.editStop(stop.id, { label: label.slice(0, 80) })); }}>{t.rename}</button>}</div></article>)}</section>; }
export function HistoryScreen({ monitor: m }: {
    monitor: Monitor;
}) {
    const navigate = useNavigate(); const [vehicle, setVehicle] = useState('all'), [route, setRoute] = useState('all');
    const trips = m.snapshot.trips;
    const vehicles = [...new Map(trips.map(t => [t.vehicle_id, t.vehicle_label_snapshot])).entries()];
    const routeIds = [...new Set(trips.map(t => t.route_id || 'none'))];
    const visible = trips.filter(t => (vehicle === 'all' || t.vehicle_id === vehicle) && (route === 'all' || (t.route_id || 'none') === route));
    return <><h2>{t.history}</h2>
        <fieldset className="card"><legend>Filtrar por veículo</legend><div className="row"><button className={vehicle === 'all' ? 'selected' : 'secondary'} onClick={() => setVehicle('all')}>Todas ({trips.length})</button>{vehicles.map(([id, label]) => <button key={id} className={vehicle === id ? 'selected' : 'secondary'} onClick={() => setVehicle(id)}>{label} ({trips.filter(t => t.vehicle_id === id).length})</button>)}</div></fieldset>
        <fieldset className="card"><legend>Filtrar por rota</legend><div className="row"><button className={route === 'all' ? 'selected' : 'secondary'} onClick={() => setRoute('all')}>Todas ({trips.length})</button>{routeIds.map(id => <button key={id} className={route === id ? 'selected' : 'secondary'} onClick={() => setRoute(id)}>{id === 'none' ? 'Sem rota' : m.snapshot.routes.find(r => r.id === id)?.name || trips.find(t => t.route_id === id)?.route_name || 'Sem rota'} ({trips.filter(t => (t.route_id || 'none') === id).length})</button>)}</div></fieldset>
        {!visible.length && <p className="card muted">{trips.length ? 'Nenhuma viagem corresponde aos filtros.' : t.emptyHistory}</p>}
        {visible.map(trip => <button key={trip.id} className="card full link" onClick={() => navigate('/history/' + trip.id)}><Summary trip={trip} monitor={m}/></button>)}
    </>;
}
export function Detail({ monitor: m }: {
    monitor: Monitor;
}) { const [formats, setFormats] = useState<ExportFormat[]>(['csv', 'events']); const { id } = useParams(); const trip = m.snapshot.trips.find(t => t.id === id); return <><Back /><h2>{t.detail}</h2>{trip && <><section className="card"><Summary trip={trip} monitor={m}/></section><TripRouteEditor monitor={m} trip={trip}/><TripShiftEditor monitor={m} trip={trip}/><TripMap points={m.snapshot.points.filter(p => p.trip_id === id)} stops={m.snapshot.stops.filter(s => s.trip_id === id)} online={m.snapshot.online} intervalMs={trip.gps_interval_ms || m.snapshot.settings.gpsIntervalMs}/><TripSpeedSummary monitor={m} trip={trip}/><RecordingEvents trip={trip}/><Stops monitor={m} tripId={trip.id}/><div className="row card">{(['csv', 'geojson', 'events'] as const).map(format => <label key={format}><input type="checkbox" checked={formats.includes(format)} onChange={e => setFormats(e.target.checked ? [...formats, format] : formats.filter(f => f !== format))}/>{format === 'csv' ? 'CSV de pontos' : format === 'events' ? 'CSV de eventos' : t.geojson}</label>)}<button disabled={m.snapshot.busy || !formats.length} onClick={() => void m.run(async () => { await exportTrip(trip, m.snapshot.points.filter(p => p.trip_id === trip.id), m.snapshot.stops.filter(s => s.trip_id === trip.id), m.snapshot.mode!, formats, undefined, trip.gps_interval_ms || m.snapshot.settings.gpsIntervalMs); m.patch({ notice: t.exportReady }); })}>Exportar selecionados</button></div></>}</>; }
export function SettingsScreen({ monitor: m }: {
    monitor: Monitor;
}) { const navigate = useNavigate(); const [values, setValues] = useState<Settings>({ ...m.snapshot.settings }); const fields: {
    key: keyof Settings;
    label: string;
    factor: number;
}[] = [{ key: 'gpsIntervalMs', label: t.gpsInterval, factor: 1000 }, { key: 'maxAccuracyM', label: t.maxAccuracy, factor: 1 }, { key: 'stopSpeedKmh', label: t.stopSpeed, factor: 1 }, { key: 'stopMinDurationS', label: t.stopDuration, factor: 1 }, { key: 'stopRadiusM', label: t.stopRadius, factor: 1 }, { key: 'maxGapS', label: t.maxGap, factor: 1 }]; return <><button className="link" onClick={() => navigate('/')}>{t.back}</button><h2>{t.settings}</h2><section className="card stack" aria-label="Usuário e nuvem"><p className="muted">{t.version}</p><ProfileEditor/><label><input type="checkbox" checked={m.cloudEnabled} onChange={e=>void m.setCloudEnabled(e.target.checked)}/>Nuvem ligada</label><p>Última sincronização: {m.lastCloudSync ? new Date(m.lastCloudSync).toLocaleString("pt-BR") : "Nunca"}</p></section><div className="row"><button className="secondary" onClick={() => navigate('/settings/routes')}>Rotas</button></div><section aria-label="Ônibus"><h3>Ônibus</h3><BusLabel monitor={m} settings/></section><GpsDiagnostics monitor={m}/><ReferenceSettings monitor={m}/><section className="card">{fields.map(f => <label key={f.key}>{f.label}{f.key === 'stopMinDurationS' ? <select value={values.stopMinDurationS} onChange={e => setValues({ ...values, stopMinDurationS: Number(e.target.value) })}>{[10,15,20,30].map(n => <option key={n} value={n}>{n} s</option>)}</select> : <input type="number" min="1" value={values[f.key] / f.factor} onChange={e => setValues({ ...values, [f.key]: Number(e.target.value) * f.factor })}/>}</label>)}<button disabled={m.snapshot.busy || !!m.snapshot.active} onClick={() => void m.run(() => m.saveSettings(values))}>{t.save}</button>{m.snapshot.mode === 'demo' && <button className="danger full" disabled={m.snapshot.busy || !!m.snapshot.active} onClick={() => { if (window.confirm(t.clearDemoConfirm)) void m.run(() => m.clearDemo()); }}>{t.clearDemo}</button>}<button className="link" onClick={() => navigate('/consent')}>{t.seeConsent}</button></section></>; }

type HubTab = 'viagens' | 'relatos' | 'relatorios';
/** Histórico: Viagens, Meus relatos e Relatórios (Pontualidade e Velocidade). */
export function HistoryHub({ monitor: m, queue }: { monitor: Monitor; queue: ReportQueue }) {
    const [params, setParams] = useSearchParams(), raw = params.get('tab');
    const tab: HubTab = raw === 'relatos' || raw === 'relatorios' ? raw : 'viagens';
    const labels: Record<HubTab, string> = { viagens: 'Viagens', relatos: 'Meus relatos', relatorios: 'Relatórios' };
    return <><div className="tabsInner" role="tablist">{(Object.keys(labels) as HubTab[]).map(k => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'selected' : 'secondary'} onClick={() => setParams(k === 'viagens' ? {} : { tab: k })}>{labels[k]}</button>)}</div>
        {tab === 'viagens' ? <HistoryScreen monitor={m}/> : tab === 'relatos' ? <MyReportsScreen queue={queue}/> : <PunctualityScreen monitor={m}/>}</>;
}

function ProfileEditor() {
    const { profile, save, reset } = useProfile();
    const [name, setName] = useState(profile?.name ?? ''), [email, setEmail] = useState(profile?.email ?? ''), [msg, setMsg] = useState('');
    const submit = () => { const r = validateProfile(name, email); if ('error' in r) setMsg(r.error); else { save(r.profile); setMsg('Salvo.'); } };
    return <form className="stack" aria-label="Meu cadastro" onSubmit={e => { e.preventDefault(); submit(); }}><label>Nome<input value={name} maxLength={60} onChange={e => { setName(e.target.value); setMsg(''); }}/></label>
        <label>E-mail<input type="email" value={email} onChange={e => { setEmail(e.target.value); setMsg(''); }}/></label>{msg && <p role="status">{msg}</p>}
        <button className="secondary">Salvar cadastro</button><button type="button" className="secondary" onClick={() => { if (window.confirm('Trocar usuário? Suas viagens e relatos continuam no aparelho.')) reset(); }}>Trocar usuário</button></form>;
}
