// Painel (#/painel/velocidade): ranking de velocidade máxima e excessos ≥ 100 km/h, lidos dos pontos da nuvem (somente leitura).
import { useEffect, useMemo, useState } from 'react';
import type { WebClient } from './client';
import { periodLabels, periodStartMs, type Period } from '../src/lib/punctualityReport';
import { SPEED_HIGH_KMH, SPEED_WARN_KMH } from '../src/config/reference';
import { mapsLink, speedEpisodesCsv, speedFileName, speedSummaryCsv, speedSummaryFileName, tripSpeedStats, type SpeedBundle, type SpeedPoint, type SpeedTripInfo } from '../src/lib/speed';
import { localDateTimeFortaleza } from '../src/lib/time';
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
const pointCols = 'trip_id,seq,recorded_at,latitude,longitude,accuracy_m,speed_mps,accepted';
const tripCols = 'id,bus_label,route_name,started_at,app_version';
const rank = (map: Map<string, number>) => [...map].map(([key, vmax]) => ({ key, vmax })).sort((a, b) => b.vmax - a.vmax);

export function SpeedPanel({ db }: { db: WebClient | null }) {
    const [period, setPeriod] = useState<Period>('30d'), [bundles, setBundles] = useState<SpeedBundle[]>([]), [progress, setProgress] = useState(''), [error, setError] = useState(''), [revision, setRevision] = useState(0);
    useEffect(() => {
        if (!db) return;
        let live = true;
        setError(''); setBundles([]);
        void (async () => {
            const since = period === 'all' ? null : new Date(periodStartMs(period, Date.now())).toISOString();
            setProgress('Carregando viagens…');
            const trips = await paged<SpeedTripInfo>((from, to) => {
                let q = db.from('trips').select(tripCols).order('started_at', { ascending: false }).range(from, to);
                if (since) q = q.gte('started_at', since);
                return q as unknown as PromiseLike<Rows<SpeedTripInfo>>;
            });
            const out: SpeedBundle[] = [];
            for (let i = 0; i < trips.length; i++) {
                if (!live) return;
                setProgress(`Carregando pontos: viagem ${i + 1} de ${trips.length}…`);
                const points = await paged<SpeedPoint>((from, to) => db.from('trip_points').select(pointCols).eq('trip_id', trips[i].id).order('seq').range(from, to) as unknown as PromiseLike<Rows<SpeedPoint>>);
                out.push({ trip: trips[i], points });
            }
            if (live) { setBundles(out); setProgress(''); }
        })().catch(e => { if (live) { setError(e instanceof Error ? e.message : 'Não foi possível carregar os dados.'); setProgress(''); } });
        return () => { live = false; };
    }, [db, period, revision]);
    const stats = useMemo(() => bundles.map(b => ({ ...b, stats: tripSpeedStats(b.points) })), [bundles]);
    const byBus = useMemo(() => { const m = new Map<string, number>(); for (const b of stats) { const k = b.trip.bus_label || 'Sem ônibus'; m.set(k, Math.max(m.get(k) ?? 0, b.stats.vmax)); } return rank(m); }, [stats]);
    const byRoute = useMemo(() => { const m = new Map<string, number>(); for (const b of stats) { const k = b.trip.route_name || 'Sem rota'; m.set(k, Math.max(m.get(k) ?? 0, b.stats.vmax)); } return rank(m); }, [stats]);
    const episodes = useMemo(() => stats.flatMap(b => b.stats.episodes100.map(e => ({ ...e, trip: b.trip }))).sort((a, b) => b.start.localeCompare(a.start)), [stats]);
    if (!db) return <section><h2>Velocidade</h2><p role="status">Nuvem não configurada</p></section>;
    return <section><h2>Velocidade</h2>
        <p>Somente leitura. Referências do projeto: atenção a partir de {SPEED_WARN_KMH} km/h, velocidade alta a partir de {SPEED_HIGH_KMH} km/h (não é o limite legal do trecho).</p>
        <div className="filters"><label>Período<select value={period} onChange={e => setPeriod(e.target.value as Period)}>{(Object.keys(periodLabels) as Period[]).map(p => <option key={p} value={p}>{periodLabels[p]}</option>)}</select></label>
            <button type="button" disabled={!!progress} onClick={() => setRevision(n => n + 1)}>Recarregar</button></div>
        {progress && <p role="status">{progress}</p>}<p role="alert">{error}</p>
        <button type="button" disabled={!!progress || !bundles.length} onClick={() => { const label = period === 'all' ? 'tudo' : period; download(speedFileName(label), speedEpisodesCsv(bundles, APP_VERSION)); download(speedSummaryFileName(label), speedSummaryCsv(bundles, APP_VERSION)); }}>Exportar CSV</button>
        <h3>Velocidade máxima por ônibus</h3>{!byBus.length ? <p>Sem dados.</p> : <ol>{byBus.map(r => <li key={r.key}>{r.key}: <strong>{r.vmax} km/h</strong></li>)}</ol>}
        <h3>Velocidade máxima por rota</h3>{!byRoute.length ? <p>Sem dados.</p> : <ol>{byRoute.map(r => <li key={r.key}>{r.key}: <strong>{r.vmax} km/h</strong></li>)}</ol>}
        <h3>Episódios ≥ {SPEED_HIGH_KMH} km/h</h3>
        {!episodes.length ? <p>Nenhum episódio no período.</p> : <table><thead><tr><th>Data</th><th>Ônibus</th><th>Rota</th><th>Vmax</th><th>Duração</th><th>Mapa</th></tr></thead><tbody>{episodes.map(e => <tr key={e.trip.id + e.start}><td>{localDateTimeFortaleza(e.start)}</td><td>{e.trip.bus_label}</td><td>{e.trip.route_name || 'Sem rota'}</td><td>{String(e.vmax).replace('.', ',')} km/h</td><td>{e.durationS} s</td><td><a href={mapsLink(e.latitude, e.longitude)} target="_blank" rel="noreferrer">Ver no mapa</a></td></tr>)}</tbody></table>}
    </section>;
}
