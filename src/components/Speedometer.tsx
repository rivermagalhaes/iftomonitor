import { useMemo } from 'react';
import type { GpsPoint, Trip } from '../data/models';
import { SPEED_HIGH_KMH, SPEED_WARN_KMH } from '../config/reference';
import { displaySpeed, mapsLink, speedBand, speedBandLabel, tripSpeedStats } from '../lib/speed';
import { localDateTimeFortaleza } from '../lib/time';
import type { Monitor } from '../services/monitor';
import { downloadFile } from '../services/export';
import { speedEpisodesCsv, speedFileName, speedSummaryCsv, speedSummaryFileName } from '../lib/speed';
import { APP_VERSION } from '../config/version';

/** Velocímetro da viagem em andamento: número grande em km/h, faixa de cor e máxima da viagem. */
export function Speedometer({ points }: { points: GpsPoint[] }) {
    const stats = useMemo(() => tripSpeedStats(points), [points]);
    const kmh = displaySpeed(points), band = speedBand(kmh);
    return <section className={'card speedometer ' + band} aria-label="Velocímetro">
        <div className="speedValue" role="img" aria-label={kmh === null ? 'Velocidade indisponível' : `${kmh} quilômetros por hora`}>{kmh === null ? '—' : kmh}</div>
        <div className="speedUnit">km/h{speedBandLabel[band] && <strong className="speedBandLabel"> · {speedBandLabel[band]}</strong>}</div>
        <p className="muted">Máx. na viagem: {stats.vmax} km/h</p>
    </section>;
}

const csvMime = 'text/csv;charset=utf-8';
const fmt = (iso: string) => localDateTimeFortaleza(iso).slice(11);
/** Resumo de velocidade no detalhe da viagem (Histórico). */
export function TripSpeedSummary({ monitor: m, trip }: { monitor: Monitor; trip: Trip }) {
    const points = m.snapshot.points.filter(p => p.trip_id === trip.id);
    const stats = useMemo(() => tripSpeedStats(points), [points]);
    const episodes = stats.episodes100.length ? stats.episodes100 : stats.episodes80;
    const limit = stats.episodes100.length ? SPEED_HIGH_KMH : SPEED_WARN_KMH;
    const exportCsv = () => void m.run(async () => {
        const bundle = [{ trip, points }];
        await downloadFile(speedFileName(`viagem-${trip.id.slice(0, 8)}`), speedEpisodesCsv(bundle, APP_VERSION), csvMime);
        await downloadFile(speedSummaryFileName(`viagem-${trip.id.slice(0, 8)}`), speedSummaryCsv(bundle, APP_VERSION), csvMime);
        m.patch({ notice: 'Exportação pronta.' });
    });
    return <section className="card" aria-label="Velocidade">
        <h3>Velocidade</h3>
        {!stats.samples ? <p className="muted">Sem pontos com precisão suficiente (≤ 20 m) para calcular velocidade.</p> : <>
            <div className="stats"><div className="card"><strong>{stats.vmax}</strong><span>máx. km/h</span></div><div className="card"><strong>{String(stats.vavg).replace('.', ',')}</strong><span>média em movimento</span></div><div className="card"><strong>{String(stats.minAbove80).replace('.', ',')} / {String(stats.minAbove100).replace('.', ',')}</strong><span>min acima de {SPEED_WARN_KMH} / {SPEED_HIGH_KMH}</span></div></div>
            {episodes.length ? <><h4>Excessos (≥ {limit} km/h)</h4><ul className="episodes">{episodes.map(e => <li key={e.start}><span>{fmt(e.start)} · {e.durationS} s · máx. {String(e.vmax).replace('.', ',')} km/h</span> <a href={mapsLink(e.latitude, e.longitude)} target="_blank" rel="noreferrer">Abrir no mapa</a></li>)}</ul></> : <p className="muted">Nenhum excesso de velocidade registrado.</p>}
            <p className="muted">Limites de referência do projeto, não o limite legal do trecho.</p></>}
        <button className="secondary" disabled={m.snapshot.busy || !stats.samples} onClick={exportCsv}>Exportar velocidade (CSV)</button>
    </section>;
}
