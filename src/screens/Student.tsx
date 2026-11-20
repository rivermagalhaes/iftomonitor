import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { setBackOverride } from '../app/backHandler';
import { getProfile } from '../services/profile';
import type { Monitor } from '../services/monitor';
import { BUS_CHIPS, categoryLabels, pickPhoto, type ReportQueue, type StoredReport } from '../services/reports';
import { QuickReport } from '../shared/QuickReport';
import { toPayloadFields, type ReportForm } from '../shared/reportForm';
import { parseStructuredLine } from '../shared/reportForm';
import { labelOf } from '../shared/reportChecklist';

const statusLabel = { pendente: 'Pendente', enviado: 'Enviado', falhou: 'Falhou' } as const;
const parsedOf = (r: StoredReport) => parseStructuredLine(r.message);
const summary = (r: StoredReport) => { const p = parsedOf(r); return p?.problems.length ? p.problems.map(labelOf).join(', ') : categoryLabels[r.category]; };
const comment = (r: StoredReport) => parsedOf(r)?.comment ?? r.message;
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR');
const LAST_KEY = 'ifto_last_report_target';
function readLast(): { bus?: string } { try { return JSON.parse(localStorage.getItem(LAST_KEY) || '{}'); } catch { return {}; } }
/** Ônibus: viagem em andamento > QR (?bus=) > último usado. */
function readBus(): string | undefined {
    const query = new URLSearchParams((location.hash.split('?')[1] || '') || location.search).get('bus');
    return query || readLast().bus;
}
/** Contexto da viagem em andamento: rota, trip= (8 caracteres) e loc= (último ponto, 5 casas). Fora de viagem, nada é coletado. */
export function tripContext(monitor?: Monitor) {
    const active = monitor?.snapshot.active;
    if (!monitor || !active) return {};
    const last = monitor.snapshot.points.filter(p => p.trip_id === active.id).at(-1);
    return { bus: active.bus_label || active.vehicle_label_snapshot, route: active.route_name || '', trip: active.id.replace(/-/g, '').slice(0, 8), loc: last ? `${last.latitude.toFixed(5)},${last.longitude.toFixed(5)}` : undefined };
}

export function ReportScreen({ queue, monitor }: { queue: ReportQueue; monitor?: Monitor }) {
    const navigate = useNavigate();
    const preset = useMemo(() => { const p = getProfile(), ctx = tripContext(monitor); return { bus: ctx.bus || readBus(), route: ctx.route, trip: ctx.trip, loc: ctx.loc, userEmail: p?.email, userName: p?.name }; }, []);
    const dirty = useRef(false), [ask, setAsk] = useState(false);
    const goBack = () => { if (dirty.current) { setAsk(true); return true; } return false; };
    useEffect(() => setBackOverride(goBack), []);
    const submit = async (form: ReportForm, photos: Blob[], honeypot: string) => {
        const saved = await queue.submit({ ...toPayloadFields(form), photos, honeypot });
        return saved?.status ?? 'enviado';
    };
    const onDirty = useCallback((value: boolean) => { dirty.current = value; }, []);
    return <>
        <ScreenHeader onBack={() => { if (!goBack()) navigate('/'); }}/>
        <QuickReport buses={[...BUS_CHIPS]} preset={preset} pickPhoto={() => pickPhoto()} submit={submit} onDirty={onDirty}
            onRemember={bus => { try { localStorage.setItem(LAST_KEY, JSON.stringify({ bus })); } catch { /* sem armazenamento */ } }}
            onHome={() => navigate('/')} onOpenMyReports={() => navigate('/history?tab=relatos')}/>
        {ask && <div className="modalBackdrop"><section role="dialog" aria-modal="true" aria-label="Descartar este relato?" className="card stack"><h2>Descartar este relato?</h2>
            <button className="danger" onClick={() => { dirty.current = false; setAsk(false); navigate('/'); }}>Descartar</button>
            <button className="secondary" onClick={() => setAsk(false)}>Continuar editando</button></section></div>}
    </>;
}

export function MyReportsScreen({ queue }: { queue: ReportQueue }) {
    const rows = useSyncExternalStore(queue.subscribe, queue.getSnapshot);
    const [openId, setOpenId] = useState<string | null>(null);
    const selected = rows.find(r => r.id === openId);
    if (selected) return <ReportDetail report={selected} queue={queue} onBack={() => setOpenId(null)}/>;
    return <><h2>Meus relatos</h2>{!rows.length && <p className="card muted">Você ainda não enviou relatos neste aparelho.</p>}
        {rows.map(r => <button key={r.id} className="card full link" onClick={() => setOpenId(r.id)}><div className="row between"><strong>{r.bus_label}</strong><span className="badge">{statusLabel[r.status]}</span></div><p>{summary(r)}</p><small className="muted">{when(r.created_at)}</small></button>)}</>;
}
function ReportDetail({ report, queue, onBack }: { report: StoredReport; queue: ReportQueue; onBack: () => void }) {
    const [busy, setBusy] = useState(false);
    return <section className="stack"><button className="link" onClick={onBack}>Voltar</button><h2>Relato</h2>
        <div className="card"><p><strong>{report.bus_label}</strong>{report.route_name ? ' · ' + report.route_name : ''}</p><p>{summary(report)}</p><p>{when(report.created_at)}</p><p>Status: <span className="badge">{statusLabel[report.status]}</span></p>{comment(report) && <p>{comment(report)}</p>}<p className="muted">Fotos: {report.photos.length}</p>{report.error && report.status !== 'enviado' && <p role="alert" className="error">{report.error}{report.http_status ? ` (HTTP ${report.http_status})` : ''}</p>}</div>
        {report.status !== 'enviado' && <button disabled={busy} onClick={() => { setBusy(true); void queue.resend(report.id).finally(() => setBusy(false)); }}>Reenviar</button>}</section>;
}
