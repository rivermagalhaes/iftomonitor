import { useEffect, useMemo, useState } from 'react';
import type { WebClient } from './client';
import { referenceFromEnv } from '../src/config/reference';
import { analyze, describeTrip, excludedLabels, formatMinutes, observedCsv, observedFileName, periodLabels, periodStartMs, punctualityCsv, punctualityFileName, routeKeyOf, shiftLabels, statusLabels, statusTone, type Period, type TripBundle } from '../src/lib/punctualityReport';
import { formatMinutesOfDay } from '../src/lib/time';
import type { PunctPoint, PunctStop, PunctTrip } from '../src/lib/punctuality';
import { APP_VERSION } from '../src/config/version';
import { download } from './lib';

const PAGE = 1000;
type Rows<T> = { data: T[] | null; error: unknown };
async function paged<T>(page: (from: number, to: number) => PromiseLike<Rows<T>>): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await page(from, from + PAGE - 1);
        if (error) throw error;
        out.push(...(data ?? []));
        if ((data ?? []).length < PAGE) return out;
    }
}
const tripCols = 'id,bus_label,route_id,route_name,started_at,ended_at,status,app_version';

export function PunctualityPanel({ db }: { db: WebClient | null }) {
    const reference = useMemo(() => referenceFromEnv(import.meta.env as Record<string, unknown>), []);
    const [period, setPeriod] = useState<Period>('30d'), [routeKey, setRouteKey] = useState('todas'), [shift, setShift] = useState<'todos' | 'manha' | 'noite'>('todos'), [tab, setTab] = useState<'resumo' | 'tabela'>('resumo');
    const [bundles, setBundles] = useState<TripBundle[]>([]), [progress, setProgress] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(false), [revision, setRevision] = useState(0);
    useEffect(() => {
        if (!db) return;
        let live = true;
        setLoading(true); setError(''); setBundles([]);
        void (async () => {
            const since = period === 'all' ? null : new Date(periodStartMs(period, Date.now())).toISOString();
            setProgress('Carregando viagens…');
            const trips = await paged<PunctTrip>((from, to) => {
                let q = db.from('trips').select(tripCols).order('started_at', { ascending: false }).range(from, to);
                if (since) q = q.gte('started_at', since);
                return q as unknown as PromiseLike<Rows<PunctTrip>>;
            });
            const out: TripBundle[] = [];
            for (let i = 0; i < trips.length; i++) {
                if (!live) return;
                const trip = trips[i];
                setProgress(`Carregando pontos e paradas: viagem ${i + 1} de ${trips.length}…`);
                const [points, stops] = await Promise.all([
                    paged<PunctPoint>((from, to) => db.from('trip_points').select('recorded_at,latitude,longitude,accepted').eq('trip_id', trip.id).order('seq').range(from, to) as unknown as PromiseLike<Rows<PunctPoint>>),
                    paged<PunctStop>((from, to) => db.from('trip_stops').select('id,arrived_at,duration_s,latitude,longitude,status,label').eq('trip_id', trip.id).order('arrived_at').range(from, to) as unknown as PromiseLike<Rows<PunctStop>>)
                ]);
                out.push({ trip, points, stops });
            }
            if (live) { setBundles(out); setProgress(''); }
        })().catch(e => { if (live) { setError(e instanceof Error ? e.message : 'Não foi possível carregar os dados.'); setProgress(''); } }).finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [db, period, revision]);
    const routes = useMemo(() => [...new Map(bundles.map(b => [routeKeyOf(b.trip), b.trip.route_name || 'Sem rota'])).entries()], [bundles]);
    const analysis = useMemo(() => analyze(bundles, reference, { period, routeKey, shift, nowMs: Date.now() }), [bundles, reference, period, routeKey, shift]);
    if (!db) return <section><h2>Pontualidade</h2><p role="status">Nuvem não configurada</p></section>;
    const byId = new Map(analysis.trips.map(t => [t.id, t]));
    const days = analysis.daily.slice(-14), maxAbs = Math.max(10, ...days.map(d => Math.abs(d.folga)));
    const ordered = [...analysis.results].sort((a, b) => (byId.get(b.tripId)?.started_at ?? '').localeCompare(byId.get(a.tripId)?.started_at ?? ''));
    return <section><h2>Pontualidade</h2>
        <p>Somente leitura. O turno é inferido pelo horário de início (ajustes manuais feitos no app não vão para a nuvem).</p>
        <div className="filters">
            <label>Período<select value={period} onChange={e => setPeriod(e.target.value as Period)}>{(Object.keys(periodLabels) as Period[]).map(p => <option key={p} value={p}>{periodLabels[p]}</option>)}</select></label>
            <label>Rota<select value={routeKey} onChange={e => setRouteKey(e.target.value)}><option value="todas">Todas</option>{routes.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
            <label>Turno<select value={shift} onChange={e => setShift(e.target.value as 'todos' | 'manha' | 'noite')}><option value="todos">Todos</option><option value="manha">Manhã</option><option value="noite">Tarde/noite</option></select></label>
            <button type="button" disabled={loading} onClick={() => setRevision(n => n + 1)}>Recarregar</button>
        </div>
        {progress && <p role="status">{progress}</p>}<p role="alert">{error}</p>
        <div><button type="button" disabled={tab === 'resumo'} onClick={() => setTab('resumo')}>Resumo</button> <button type="button" disabled={tab === 'tabela'} onClick={() => setTab('tabela')}>Tabela observada</button></div>
        {!loading && !analysis.aggregate.groups.length && <p>Nenhuma viagem válida no período. Escolha a rota e finalize viagens no horário de turno.</p>}
        {tab === 'resumo' ? <>
            {analysis.aggregate.groups.map(g => <article key={g.key}><h3>{g.routeName} · {shiftLabels[g.shift]}</h3><p>{g.onTimePct === null ? '—' : g.onTimePct + '%'} {g.shift === 'manha' ? 'chegou no horário' : 'voltou no horário'} · folga mediana {formatMinutes(g.medianFolga)} · pior folga {formatMinutes(g.worstFolga)} · melhor {formatMinutes(g.bestFolga)} · {g.trips} viagem(ns){g.departureOnTimePct !== null ? ` · saída pontual ${g.departureOnTimePct}%` : ''}</p></article>)}
            {days.length > 0 && <><h3>Folga por dia</h3>{days.map(d => <div key={d.day} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 80px', gap: 8, alignItems: 'center' }}><span>{d.day.slice(8)}/{d.day.slice(5, 7)}</span><div style={{ background: '#E6F4E8', height: 12, borderRadius: 6 }}><div style={{ width: Math.max(2, Math.abs(d.folga) / maxAbs * 100) + '%', height: 12, borderRadius: 6, background: d.folga >= 0 ? '#2F9E41' : '#D83232' }}/></div><span>{d.folga > 0 ? '+' : ''}{d.folga} min</span></div>)}</>}
            <h3>Viagens</h3>
            {ordered.map(r => { const t = byId.get(r.tripId)!; const main = r.events.find(e => e.kind === (r.shift === 'manha' ? 'chegada' : 'retorno')) ?? r.events[0];
                return <article key={r.tripId}><strong>{t.bus_label || 'Ônibus'} · {t.route_name || 'Sem rota'}</strong> · {new Date(t.started_at).toLocaleString('pt-BR')} · {shiftLabels[r.shift]}<br/>
                    <span data-tone={r.excluded ? 'muted' : main ? statusTone(main.status) : 'muted'}>[{r.excluded ? excludedLabels[r.excluded] : main ? statusLabels[main.status] : '—'}]</span> {describeTrip(r)}{r.confidence === 'baixa' ? ' ⚠ confiança baixa' : ''}</article>; })}
            <button type="button" disabled={!analysis.results.length} onClick={() => download(punctualityFileName(period), punctualityCsv(analysis.trips, analysis.results, APP_VERSION))}>Exportar CSV de pontualidade</button>
        </> : <>
            <p>Horários que o ônibus de fato cumpre (mediana dos dias). Serve de base para a secretaria oficializar.</p>
            {analysis.aggregate.groups.map(g => { const rows = analysis.timetables.get(g.key) ?? []; return <article key={g.key}><h3>{g.routeName} · {shiftLabels[g.shift]}</h3>
                {!rows.length ? <p>Ainda não há pontos com {reference.minTripsForObservedTable} ou mais viagens.</p> : <table><thead><tr><th>#</th><th>Ponto</th><th>Mediana</th><th>Faixa</th><th>Viagens</th></tr></thead><tbody>{rows.map(r => <tr key={r.order}><td>{r.order}</td><td>{r.label}</td><td>{formatMinutesOfDay(r.medianMin)}</td><td>{formatMinutesOfDay(r.earliestMin)}–{formatMinutesOfDay(r.latestMin)}</td><td>{r.tripsCount}</td></tr>)}</tbody></table>}
                <button type="button" disabled={!rows.length} onClick={() => download(observedFileName(g.routeName, g.shift), observedCsv(g.routeName, g.shift, rows))}>Exportar CSV da tabela</button></article>; })}
        </>}
        {analysis.aggregate.excluded.length > 0 && <><h3>Fora do cálculo</h3>{analysis.aggregate.excluded.map(x => { const t = byId.get(x.tripId); return <p key={x.tripId}>{t ? new Date(t.started_at).toLocaleString('pt-BR') + ' · ' + (t.bus_label || 'Ônibus') + ' · ' : ''}{excludedLabels[x.reason]}</p>; })}</>}
    </section>;
}
