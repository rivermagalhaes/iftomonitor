// Painel (#/painel): relatos com etiquetas por urgência, filtros, aba "Resumo" e exportação CSV.
import { useMemo, useState, type ReactNode } from 'react';
import { checklistSections, labelOf, urgencyColors, urgencyLabels, urgencyOf } from '../src/shared/reportChecklist';
import { filterRecords, reportsCsv, reportsCsvName, sortRecords, summarize, toRecord, lotacaoLabels, quandoLabels, sentidoLabels, type ReportFilters, type ReportRecord, type ReportRow } from '../src/shared/reportsAnalysis';
import { download } from './lib';

type PhotosView = (props: { reportId: string; compact?: boolean }) => ReactNode;
export const periodName = (f: ReportFilters) => f.from || f.to ? `${f.from || 'inicio'}_${f.to || 'hoje'}` : 'tudo';

export function Tag({ id }: { id: string }) {
    const u = urgencyOf(id);
    return <span className="tag" title={urgencyLabels[u]} style={{ background: urgencyColors[u], color: '#fff', padding: '2px 8px', borderRadius: 12, margin: '2px 4px 2px 0', display: 'inline-block', fontSize: '.85rem' }}>{labelOf(id)}</span>;
}
export const recordsOf = (rows: Record<string, unknown>[]) => rows.map(r => toRecord(r as unknown as ReportRow));
const details = (r: ReportRecord) => [r.sentido && sentidoLabels[r.sentido], r.quando && quandoLabels[r.quando], r.lotacao && `lotação: ${lotacaoLabels[r.lotacao]}`].filter(Boolean).join(' · ');

export function ReportsList({ records, Photos }: { records: ReportRecord[]; Photos: PhotosView }) {
    const [filters, setFilters] = useState<ReportFilters>({});
    const set = (k: keyof ReportFilters, v: string) => setFilters(f => ({ ...f, [k]: v }));
    const options = (pick: (r: ReportRecord) => string) => [...new Set(records.map(pick))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const visible = useMemo(() => sortRecords(filterRecords(records, filters)), [records, filters]);
    const select = (k: keyof ReportFilters, label: string, values: [string, string][]) => <label key={k}>{label}<select value={filters[k] || ''} onChange={e => set(k, e.target.value)}><option value="">Todos</option>{values.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
    return <>
        <div className="filters">
            {select('bus', 'Ônibus', options(r => r.bus).map(v => [v, v]))}
            {select('route', 'Rota', options(r => r.route).map(v => [v, v]))}
            {select('sentido', 'Sentido', [['ida', sentidoLabels.ida], ['volta', sentidoLabels.volta]])}
            {select('section', 'Seção', checklistSections.map(s => [s.id, s.title]))}
            {select('urgency', 'Urgência', (['U', 'A', 'N'] as const).map(u => [u, urgencyLabels[u]]))}
            <label>De<input type="date" value={filters.from || ''} onChange={e => set('from', e.target.value)}/></label>
            <label>Até<input type="date" value={filters.to || ''} onChange={e => set('to', e.target.value)}/></label>
        </div>
        <button onClick={() => download(reportsCsvName(periodName(filters)), reportsCsv(visible))}>Exportar CSV</button>
        <p>{visible.length} relato(s) · {visible.filter(r => r.urgent).length} urgente(s)</p>
        {visible.map(r => <article key={String(r.row.id)} style={r.urgent ? { borderColor: urgencyColors.U, borderWidth: 2 } : undefined}>
            <a href={`#/painel/relatos/${r.row.id}`}>{r.bus} · {r.route} · {new Date(r.at).toLocaleString('pt-BR')}</a>
            {r.urgent && <strong style={{ color: urgencyColors.U }}> · URGENTE</strong>}
            <div>{r.problems.map(id => <Tag key={id} id={id}/>)}</div>
            {details(r) && <p>{details(r)}</p>}
            {r.comment && <p>{r.comment}</p>}
            {r.row.status && <p>Status: {String(r.row.status)}</p>}
            <Photos reportId={String(r.row.id)} compact/>
        </article>)}
    </>;
}

function Ranking({ title, items, total }: { title: string; items: { key: string; count: number }[]; total: number }) {
    return <section><h3>{title}</h3>{!items.length ? <p>Sem dados.</p> : <ol>{items.map(i => <li key={i.key}>{i.key}: <strong>{i.count}</strong> ({total ? Math.round(i.count / total * 100) : 0}%)</li>)}</ol>}</section>;
}
export function ReportsSummary({ records }: { records: ReportRecord[] }) {
    const [filters, setFilters] = useState<ReportFilters>({});
    const shown = useMemo(() => filterRecords(records, filters), [records, filters]);
    const s = useMemo(() => summarize(shown), [shown]);
    return <>
        <div className="filters"><label>De<input type="date" value={filters.from || ''} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}/></label><label>Até<input type="date" value={filters.to || ''} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}/></label></div>
        <p>{s.total} relato(s) · {s.urgent} urgente(s) (<strong>{String(s.urgentPct).replace('.', ',')}%</strong>) · {s.total - s.structured} antigo(s) sem etiquetas</p>
        <Ranking title="Problemas mais frequentes" items={s.byProblem.map(i => ({ ...i, key: labelOf(i.key) }))} total={s.total}/>
        <Ranking title="Por ônibus" items={s.byBus} total={s.total}/>
        <Ranking title="Por rota" items={s.byRoute} total={s.total}/>
        <Ranking title="Por semana (início na segunda-feira)" items={s.byWeek} total={s.total}/>
        <section><h3>Problemas mais frequentes por ônibus</h3>{s.topByBus.map(b => <div key={b.bus}><strong>{b.bus}</strong>{!b.top.length ? <p>Sem etiquetas.</p> : <ol>{b.top.map(i => <li key={i.key}>{labelOf(i.key)}: {i.count}</li>)}</ol>}</div>)}</section>
        <button onClick={() => download(reportsCsvName(periodName(filters)), reportsCsv(sortRecords(shown)))}>Exportar CSV</button>
    </>;
}
