import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Monitor } from '../services/monitor';
import type { GpsPoint, Stop, Trip } from '../data/models';
import { speedEpisodesCsv, speedFileName, speedSummaryCsv, speedSummaryFileName } from '../lib/speed';
import { analyze, describeTrip, excludedLabels, formatMinutes, observedCsv, observedFileName, periodLabels, periodStartMs, punctualityCsv, punctualityFileName, routeKeyOf, shiftLabels, statusLabels, statusTone, type Period, type TripBundle } from '../lib/punctualityReport';
import { formatMinutesOfDay } from '../lib/time';
import type { ShiftOverride } from '../lib/punctuality';
import { downloadFile } from '../services/export';
import { APP_VERSION } from '../config/version';

type Tab = 'resumo' | 'tabela';
const csvMime = 'text/csv;charset=utf-8';

export function buildBundles(trips: Trip[], points: GpsPoint[], stops: Stop[]): TripBundle[] {
    const pts = new Map<string, GpsPoint[]>(), sts = new Map<string, Stop[]>();
    for (const p of points) { const list = pts.get(p.trip_id); if (list) list.push(p); else pts.set(p.trip_id, [p]); }
    for (const s of stops) { const list = sts.get(s.trip_id); if (list) list.push(s); else sts.set(s.trip_id, [s]); }
    return trips.map(trip => ({ trip, points: pts.get(trip.id) ?? [], stops: sts.get(trip.id) ?? [] }));
}

export function PunctualityScreen({ monitor: m }: { monitor: Monitor }) {
    const navigate = useNavigate();
    const s = m.snapshot;
    const [period, setPeriod] = useState<Period>('30d'), [routeKey, setRouteKey] = useState('todas'), [shift, setShift] = useState<'todos' | 'manha' | 'noite'>('todos'), [tab, setTab] = useState<Tab>('resumo');
    const bundles = useMemo(() => buildBundles(s.trips, s.points, s.stops), [s.trips, s.points, s.stops]);
    const routes = useMemo(() => [...new Map(s.trips.map(t => [routeKeyOf(t), t.route_name || 'Sem rota'])).entries()], [s.trips]);
    const nowMs = Date.now();
    const analysis = useMemo(() => analyze(bundles, s.reference, { period, routeKey, shift, nowMs: Math.floor(nowMs / 60000) * 60000 }), [bundles, s.reference, period, routeKey, shift, nowMs]);
    const byId = new Map(analysis.trips.map(t => [t.id, t]));
    const days = analysis.daily.slice(-14), maxAbs = Math.max(10, ...days.map(d => Math.abs(d.folga)));
    const ordered = [...analysis.results].sort((a, b) => (byId.get(b.tripId)?.started_at ?? '').localeCompare(byId.get(a.tripId)?.started_at ?? ''));
    const exportAll = () => void m.run(async () => { await downloadFile(punctualityFileName(period), punctualityCsv(analysis.trips, analysis.results, APP_VERSION), csvMime); m.patch({ notice: 'Exportação pronta.' }); });
    const exportSpeed = () => void m.run(async () => {
        const since = periodStartMs(period, Date.now());
        const group = s.trips.filter(t => Date.parse(t.started_at) >= since && (routeKey === 'todas' || routeKeyOf(t) === routeKey)).map(trip => ({ trip, points: s.points.filter(p => p.trip_id === trip.id) }));
        const label = period === 'all' ? 'tudo' : period;
        await downloadFile(speedFileName(label), speedEpisodesCsv(group, APP_VERSION), csvMime);
        await downloadFile(speedSummaryFileName(label), speedSummaryCsv(group, APP_VERSION), csvMime);
        m.patch({ notice: 'Exportação de velocidade pronta.' });
    });
    return <><h2>Pontualidade</h2>
        <fieldset className="card"><legend>Período</legend><div className="row">{(Object.keys(periodLabels) as Period[]).map(p => <button key={p} className={period === p ? 'selected' : 'secondary'} onClick={() => setPeriod(p)}>{periodLabels[p]}</button>)}</div></fieldset>
        <fieldset className="card"><legend>Rota</legend><div className="row wrap"><button className={routeKey === 'todas' ? 'selected' : 'secondary'} onClick={() => setRouteKey('todas')}>Todas</button>{routes.map(([key, name]) => <button key={key} className={routeKey === key ? 'selected' : 'secondary'} onClick={() => setRouteKey(key)}>{name}</button>)}</div></fieldset>
        <fieldset className="card"><legend>Turno</legend><div className="row">{(['todos', 'manha', 'noite'] as const).map(v => <button key={v} className={shift === v ? 'selected' : 'secondary'} onClick={() => setShift(v)}>{v === 'todos' ? 'Todos' : shiftLabels[v]}</button>)}</div></fieldset>
        <div className="row"><button className={tab === 'resumo' ? 'selected' : 'secondary'} onClick={() => setTab('resumo')}>Resumo</button><button className={tab === 'tabela' ? 'selected' : 'secondary'} onClick={() => setTab('tabela')}>Tabela observada</button></div>
        {tab === 'resumo' ? <>
            {!analysis.aggregate.groups.length && <p className="card muted">Nenhuma viagem válida no período. Escolha a rota e finalize viagens no horário de turno.</p>}
            {analysis.aggregate.groups.map(g => <section className="card" key={g.key}><h3>{g.routeName} · {shiftLabels[g.shift]}</h3>
                <div className="stats"><div className="card"><strong>{g.onTimePct === null ? '—' : g.onTimePct + '%'}</strong><span>{g.shift === 'manha' ? 'chegou no horário' : 'voltou no horário'}</span></div><div className="card"><strong>{formatMinutes(g.medianFolga)}</strong><span>folga mediana</span></div><div className="card"><strong>{formatMinutes(g.worstFolga)}</strong><span>pior folga</span></div></div>
                <p className="muted">{g.trips} viagem(ns) válida(s){g.departureOnTimePct !== null ? ` · saída pontual em ${g.departureOnTimePct}%` : ''}</p></section>)}
            {days.length > 0 && <section className="card"><h3>Folga por dia</h3><p className="muted">Verde = antes do prazo · vermelho = depois.</p>{days.map(d => <div className="barRow" key={d.day}><span className="barDay">{d.day.slice(8)}/{d.day.slice(5, 7)}</span><div className="barTrack"><i className={'bar ' + (d.folga >= 0 ? 'ok' : 'bad')} style={{ width: Math.max(2, Math.abs(d.folga) / maxAbs * 100) + '%' }}/></div><span className="barVal">{d.folga > 0 ? '+' : ''}{d.folga} min</span></div>)}</section>}
            <h3>Viagens</h3>
            {!ordered.length && <p className="card muted">Nenhuma viagem no período.</p>}
            {ordered.map(r => { const trip = byId.get(r.tripId)!; const main = r.events.find(e => e.kind === (r.shift === 'manha' ? 'chegada' : 'retorno')) ?? r.events[0];
                return <button key={r.tripId} className="card full link tripItem" onClick={() => navigate('/history/' + r.tripId)}>
                    <div className="row between"><strong>{trip.bus_label || 'Ônibus'} · {trip.route_name || 'Sem rota'}</strong><span className={'chip ' + (r.excluded ? 'muted' : main ? statusTone(main.status) : 'muted')}>{r.excluded ? excludedLabels[r.excluded] : main ? statusLabels[main.status] : '—'}</span></div>
                    <p className="muted">{new Date(trip.started_at).toLocaleString('pt-BR')} · {shiftLabels[r.override === 'ignorar' ? 'ignorar' : r.shift]}{r.override !== 'auto' && r.override !== 'ignorar' ? ' (manual)' : ''}</p>
                    {r.events.length > 0 && <p>{describeTrip(r)}</p>}
                    {r.confidence === 'baixa' && <p className="muted">⚠ Confiança baixa: há lacunas de sinal perto do evento.</p>}
                </button>; })}
            <div className="row card"><button disabled={s.busy || !analysis.results.length} onClick={exportAll}>Exportar CSV de pontualidade</button><button className="secondary" disabled={s.busy || !s.trips.length} onClick={exportSpeed}>Exportar CSV de velocidade</button></div>
        </> : <>
            <p className="card muted">Horários que o ônibus de fato cumpre (mediana dos dias). Serve de base para a secretaria oficializar.</p>
            {!analysis.aggregate.groups.length && <p className="card muted">Nenhuma viagem válida no período. Escolha a rota e finalize viagens no horário de turno.</p>}
            {analysis.aggregate.groups.map(g => { const rows = analysis.timetables.get(g.key) ?? []; return <section className="card" key={g.key}><h3>{g.routeName} · {shiftLabels[g.shift]}</h3>
                {!rows.length ? <p className="muted">Ainda não há pontos com {s.reference.minTripsForObservedTable} ou mais viagens.</p> : <table className="obsTable"><thead><tr><th>#</th><th>Ponto</th><th>Mediana</th><th>Faixa</th><th>Viagens</th></tr></thead><tbody>{rows.map(r => <tr key={r.order}><td>{r.order}</td><td>{r.label}</td><td>{formatMinutesOfDay(r.medianMin)}</td><td>{formatMinutesOfDay(r.earliestMin)}–{formatMinutesOfDay(r.latestMin)}</td><td>{r.tripsCount}</td></tr>)}</tbody></table>}
                <button className="secondary" disabled={!rows.length || s.busy} onClick={() => void m.run(() => downloadFile(observedFileName(g.routeName, g.shift), observedCsv(g.routeName, g.shift, rows), csvMime))}>Exportar CSV da tabela</button></section>; })}
        </>}
        {analysis.aggregate.excluded.length > 0 && <section className="card"><h3>Fora do cálculo</h3>{analysis.aggregate.excluded.map(x => { const t = byId.get(x.tripId); return <p key={x.tripId} className="muted">{t ? new Date(t.started_at).toLocaleString('pt-BR') + ' · ' + (t.bus_label || 'Ônibus') + ' · ' : ''}{excludedLabels[x.reason]}</p>; })}</section>}
    </>;
}

const overrideLabels: Record<ShiftOverride, string> = { auto: 'Automático', manha: 'Manhã', noite: 'Tarde/noite', ignorar: 'Ignorar' };
export function TripShiftEditor({ monitor: m, trip }: { monitor: Monitor; trip: Trip }) {
    const current = trip.shift_override ?? 'auto';
    return <fieldset className="card"><legend>Turno (pontualidade)</legend><div className="row wrap">{(Object.keys(overrideLabels) as ShiftOverride[]).map(v => <button key={v} className={current === v ? 'selected' : 'secondary'} aria-pressed={current === v} disabled={m.snapshot.busy} onClick={() => void m.run(() => m.setTripShift(trip.id, v))}>{overrideLabels[v]}</button>)}</div>
        <p className="muted">Automático usa a hora de início da viagem. “Ignorar” tira a viagem de todos os cálculos.</p></fieldset>;
}
