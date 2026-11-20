import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_VERSION } from '../config/version';
import { useModeApi } from '../app/ModeContext';
import { BUS_CHIPS, categoryLabels, pickPhoto, type ReportQueue, type StoredReport } from '../services/reports';
import { QuickReport } from '../shared/QuickReport';
import { toPayloadFields, type ReportForm } from '../shared/reportForm';
import { parseStructuredLine } from '../shared/reportForm';
import { labelOf } from '../shared/reportChecklist';
import { MonitorCodeForm, TermsText } from './Onboarding';

const statusLabel = { pendente: 'Pendente', enviado: 'Enviado', falhou: 'Falhou' } as const;
const parsedOf = (r: StoredReport) => parseStructuredLine(r.message);
const summary = (r: StoredReport) => { const p = parsedOf(r); return p?.problems.length ? p.problems.map(labelOf).join(', ') : categoryLabels[r.category]; };
const comment = (r: StoredReport) => parsedOf(r)?.comment ?? r.message;
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR');
const LAST_KEY = 'ifto_last_report_target';
function readLast(): { bus?: string } { try { return JSON.parse(localStorage.getItem(LAST_KEY) || '{}'); } catch { return {}; } }
function readPreset(): { bus?: string } {
    const last = readLast();
    // QR do ônibus: #/relatar?bus=... ou ?bus=...
    const query = new URLSearchParams((location.hash.split('?')[1] || '') || location.search).get('bus');
    return { bus: query || last.bus };
}

export function ReportScreen({ queue }: { queue: ReportQueue }) {
    const navigate = useNavigate();
    const preset = useMemo(readPreset, []);
    const submit = async (form: ReportForm, photos: Blob[], honeypot: string) => {
        const fields = toPayloadFields(form);
        const saved = await queue.submit({ ...fields, photos, honeypot });
        return saved?.status ?? 'enviado';
    };
    return <QuickReport buses={[...BUS_CHIPS]} preset={preset} pickPhoto={() => pickPhoto()} submit={submit}
        onRemember={bus => { try { localStorage.setItem(LAST_KEY, JSON.stringify({ bus })); } catch { /* sem armazenamento */ } }}
        onOpenMyReports={() => navigate('/meus')}/>;
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
        <div className="card"><p><strong>{report.bus_label}</strong>{report.route_name ? ' · ' + report.route_name : ''}</p><p>{summary(report)}</p><p>{when(report.created_at)}</p><p>Status: <span className="badge">{statusLabel[report.status]}</span></p>{comment(report) && <p>{comment(report)}</p>}<p className="muted">Fotos: {report.photos.length}</p>{report.error && report.status !== 'enviado' && <p role="alert" className="error">{report.error}</p>}</div>
        {report.status !== 'enviado' && <button disabled={busy} onClick={() => { setBusy(true); void queue.resend(report.id).finally(() => setBusy(false)); }}>Reenviar</button>}</section>;
}

export function StudentSettings() {
    const api = useModeApi(), navigate = useNavigate();
    const [stage, setStage] = useState<'idle' | 'terms' | 'code'>('idle'), [wrong, setWrong] = useState(false);
    const ref = useRef<HTMLButtonElement>(null);
    if (stage === 'terms') return <section className="card stack"><button className="link" onClick={() => setStage('idle')}>Voltar</button><h2>Termos de uso e privacidade</h2><TermsText/></section>;
    if (stage === 'code') return <MonitorCodeForm onOk={() => api?.switchTo('monitor')} onWrong={() => { setWrong(true); setStage('idle'); }} onCancel={() => setStage('idle')}/>;
    return <><h2>Configurações</h2><section className="card stack"><p className="muted">Versão do app: {APP_VERSION}</p><button className="secondary" onClick={() => setStage('terms')}>Ver termos de uso</button>{wrong && <p role="alert" className="error">Código incorreto. Você continua no modo Aluno.</p>}<button ref={ref} className="secondary" onClick={() => { setWrong(false); setStage('code'); }}>Entrar como monitor</button><button className="link" onClick={() => navigate('/')}>Voltar</button></section></>;
}
