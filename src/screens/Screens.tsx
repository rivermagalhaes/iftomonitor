import { BusLabel } from '../components/BusLabel';
import { RecordingReadiness } from '../components/RecordingReadiness';
import { StartTrip } from '../components/StartTrip';
import { TripRouteEditor } from '../components/Routes';
import { RecordingEvents } from '../components/RecordingReliability';
import { GpsDiagnostics, RecordingGpsState } from '../components/GpsDiagnostics';
import { isSupabaseConfigured } from '../services/auth';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import { t } from '../i18n/pt-BR';
import type { Monitor } from '../services/monitor';
import { TripMap } from '../components/TripMap';
import { distance, analyzeTrack, durationMMSS } from '../lib/geo';
import { dateTime, elapsed } from '../lib/time';
import type { Trip, Settings } from '../data/models';
import { TripShiftEditor } from './Punctuality';
import { ReferenceSettings } from '../components/ReferenceSettings';
import { useModeApi } from '../app/ModeContext';
import { exportTrip, type ExportFormat } from '../services/export';
import { Speedometer, TripSpeedSummary } from '../components/Speedometer';
export function Connection({ online }: {
    online: boolean;
}) { return <span className="row muted">{online ? <Wifi size={16}/> : <WifiOff size={16}/>} {online ? t.online : t.offline}</span>; }
function Back() { const navigate = useNavigate(); return <button className="link row" onClick={() => navigate('/history')}><ArrowLeft size={18}/>{t.back}</button>; }
export function Home({ monitor: m }: {
    monitor: Monitor;
}) { const s = m.snapshot, navigate = useNavigate(); return <><h2>{s.mode === 'demo' ? t.demoGreeting : `${t.welcome}, ${s.operator}`}</h2><p><strong>{s.busLabel || 'Nome do ônibus não definido'}</strong></p><section className="card hero"><h3>{t.monitor}</h3><p>{t.monitorText}</p><button onClick={() => navigate('/trip')}>{t.newTrip}</button></section>{s.active && <section className="card"><h3>{t.active}</h3><p>{elapsed(s.active.started_at)} · {s.points.filter(p => p.trip_id === s.active!.id).length} {t.gpsPoints} · {s.stops.filter(p => p.trip_id === s.active!.id && p.status !== 'descartada').length} {t.stops}</p></section>}<div className="stats">{[[s.points.length, t.gpsPoints], [s.stops.filter(p => p.status !== 'descartada').length, t.stops], [s.mode === 'demo' ? 0 : [...s.vehicles, ...s.trips, ...s.points, ...s.stops].filter(r => (!isSupabaseConfigured() || r.sync_status === 'pending')).length, isSupabaseConfigured() ? t.pending : t.savedLocal]].map(([n, label]) => <div className="card" key={String(label)}><strong>{n}</strong><span>{label}</span></div>)}</div><button className="secondary full" disabled={!isSupabaseConfigured() || s.mode === 'demo' || s.busy} onClick={() => void m.run(() => m.sync(true))}>{!isSupabaseConfigured() && s.mode !== 'demo' ? t.cloudMissing : 'Sincronizar agora'}</button>{s.mode === 'demo' && <p className="muted">{t.demoNoSync}</p>}<p role="status">{!isSupabaseConfigured() ? t.cloudMissing : !m.cloudEnabled ? 'Nuvem desligada' : !s.online ? 'Sem internet' : s.trips.some(t=>t.sync_status==='error' && !t.synced_at) ? 'Erro ao enviar (tentar de novo)' : s.trips.some(t=>t.status==='finished' && !t.synced_at) ? `${s.trips.filter(t=>t.status==='finished' && !t.synced_at).length} viagens pendentes` : `Tudo sincronizado ${m.lastCloudSync ? new Date(m.lastCloudSync).toLocaleString('pt-BR') : ''}`}</p><button className="secondary full" onClick={() => navigate('/punctuality')}>{t.punctuality}</button><button className="link full" onClick={() => navigate('/history')}>{t.history}</button></>; }
function Summary({ trip, monitor: m }: {
    trip: Trip;
    monitor: Monitor;
}) { const points = m.snapshot.points.filter(p => p.trip_id === trip.id), track = analyzeTrack(points, trip.gps_interval_ms || m.snapshot.settings.gpsIntervalMs), stops = m.snapshot.stops.filter(s => s.trip_id === trip.id && s.status !== 'descartada'); return <><div className="row between"><h3>{trip.bus_label || trip.vehicle_label_snapshot}{trip.route_name ? ' · ' + trip.route_name : ''}</h3>{!trip.route_name && <span className="muted">Sem rota</span>}<span className="badge">{trip.synced_at ? 'Enviada' : trip.sync_status === 'error' ? 'Erro' : 'Pendente'}</span></div><p>{dateTime(trip.started_at)} — {dateTime(trip.ended_at)}</p><p className="muted">{elapsed(trip.started_at, trip.ended_at)} · {(distance(points, trip.gps_interval_ms || m.snapshot.settings.gpsIntervalMs) / 1000).toFixed(2)} km · {points.length} {t.gpsPoints} · {stops.length} {t.stops}</p><p>Lacunas de sinal: {track.gaps.length} (total {durationMMSS(track.gapSeconds)})</p>{track.gaps.length > 0 && <span className="badge warning">Gravação incompleta</span>}</>; }
export function TripScreen({ monitor: m }: {
    monitor: Monitor;
}) {
    const s = m.snapshot, active = s.active;
    const points = s.points.filter(p => p.trip_id === active?.id), stops = s.stops.filter(p => p.trip_id === active?.id);
    const last = points.at(-1);
    return <><h2>{t.trip}</h2><p><strong>{active?.bus_label || active?.vehicle_label_snapshot || s.busLabel || "Ônibus não definido"}</strong></p><RecordingReadiness monitor={m}/>{!active ? <StartTrip monitor={m}/> : <>
        <div className="card"><h3>{active.bus_label || active.vehicle_label_snapshot}{active.route_name ? ' · ' + active.route_name : ''}</h3>{!active.route_name && <p className="muted">Sem rota</p>}<RecordingGpsState monitor={m}/>
            <div className="row between"><strong>{elapsed(active.started_at)}</strong><span className="badge">{s.gps === 'ok' ? t.signalOk : s.gps === 'low' ? t.lowAccuracy : s.gps === 'waiting' ? t.waiting : s.gps === 'denied' ? t.permissionDenied : t.noSignal}</span></div>
            <p>{points.length} {t.gpsPoints} · {stops.filter(s => s.status !== 'descartada').length} {t.stops}</p><p className="muted">{t.accuracy}: {last ? Math.round(last.accuracy_m) + ' m' : '—'}</p>
        </div><Speedometer points={points}/><TripRouteEditor monitor={m} trip={active}/><TripMap points={points} stops={stops} online={s.online} intervalMs={active.gps_interval_ms || s.settings.gpsIntervalMs}/>
        <div className="row card"><button disabled={s.busy} onClick={() => void m.run(() => active.paused ? m.resume() : m.pause())}>{active.paused ? 'Retomar gravação' : 'Pausar gravação'}</button><button disabled={s.busy} onClick={() => void m.run(() => m.manual())}>{t.manual}</button>{s.mode === 'demo' && <button className="secondary" onClick={() => m.simulateStop()}>{t.simulatedStop}</button>}</div><Stops monitor={m} tripId={active.id}/>
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
}) { const navigate = useNavigate(); const api = useModeApi(); const [values, setValues] = useState<Settings>({ ...m.snapshot.settings }); const fields: {
    key: keyof Settings;
    label: string;
    factor: number;
}[] = [{ key: 'gpsIntervalMs', label: t.gpsInterval, factor: 1000 }, { key: 'maxAccuracyM', label: t.maxAccuracy, factor: 1 }, { key: 'stopSpeedKmh', label: t.stopSpeed, factor: 1 }, { key: 'stopMinDurationS', label: t.stopDuration, factor: 1 }, { key: 'stopRadiusM', label: t.stopRadius, factor: 1 }, { key: 'maxGapS', label: t.maxGap, factor: 1 }]; return <><button className="link" onClick={() => navigate('/')}>{t.back}</button><h2>{t.settings}</h2><section className="card stack" aria-label="Modo do app"><p className="muted">{t.version}</p><label><input type="checkbox" checked={m.cloudEnabled} onChange={e=>void m.setCloudEnabled(e.target.checked)}/>Nuvem ligada</label><p>Última sincronização: {m.lastCloudSync ? new Date(m.lastCloudSync).toLocaleString("pt-BR") : "Nunca"}</p><button className="full" onClick={() => { if (m.snapshot.active) { m.patch({ error: 'Finalize a viagem antes de mudar de modo.' }); return; } if (window.confirm('Mudar para modo Aluno? Você poderá voltar com o código do monitor.')) api?.switchTo('aluno'); }}>Mudar para modo Aluno</button></section><div className="row"><button className="secondary" onClick={() => navigate('/settings/routes')}>Rotas</button></div><section aria-label="Ônibus"><h3>Ônibus</h3><BusLabel monitor={m} settings/></section><GpsDiagnostics monitor={m}/><ReferenceSettings monitor={m}/><section className="card">{fields.map(f => <label key={f.key}>{f.label}{f.key === 'stopMinDurationS' ? <select value={values.stopMinDurationS} onChange={e => setValues({ ...values, stopMinDurationS: Number(e.target.value) })}>{[10,15,20,30].map(n => <option key={n} value={n}>{n} s</option>)}</select> : <input type="number" min="1" value={values[f.key] / f.factor} onChange={e => setValues({ ...values, [f.key]: Number(e.target.value) * f.factor })}/>}</label>)}<button disabled={m.snapshot.busy || !!m.snapshot.active} onClick={() => void m.run(() => m.saveSettings(values))}>{t.save}</button>{m.snapshot.mode === 'demo' && <button className="danger full" disabled={m.snapshot.busy || !!m.snapshot.active} onClick={() => { if (window.confirm(t.clearDemoConfirm)) void m.run(() => m.clearDemo()); }}>{t.clearDemo}</button>}<button className="link" onClick={() => navigate('/consent')}>{t.seeConsent}</button></section></>; }
