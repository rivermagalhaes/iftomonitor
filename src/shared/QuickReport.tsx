// Formulário de relato em UMA tela: o MESMO componente é usado no app (modo Aluno) e na página web (#/relatar).
import { useEffect, useRef, useState } from 'react';
import { checklistSections, commonItems } from './reportChecklist';
import { NAO_SEI, canAddProblem, commentRoom, emptyForm, validateForm, type ReportForm } from './reportForm';
import './quickReport.css';

export type SendResult = 'enviado' | 'pendente' | 'falhou' | void;
export interface QuickReportProps {
    buses: string[];
    /** Ônibus pré-marcado (QR `?bus=` ou o último usado). */
    preset?: { bus?: string };
    /** Abre câmera/galeria e devolve a foto já reduzida (JPEG, 1280 px, ≤ 1 MB). null = cancelou. */
    pickPhoto: () => Promise<Blob | null>;
    /** Envia o relato. Lança Error com mensagem curta em português se for recusado. */
    submit: (form: ReportForm, photos: Blob[], honeypot: string) => Promise<SendResult>;
    onRemember?: (bus: string) => void;
    onOpenMyReports?: () => void;
}
const MAX_PHOTOS = 2;

function Thumb({ blob, onRemove }: { blob: Blob; onRemove: () => void }) {
    const [url, setUrl] = useState('');
    useEffect(() => { const u = URL.createObjectURL(blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [blob]);
    return <div className="qrThumb">{url && <img src={url} alt="Foto do relato"/>}<button type="button" className="qrX" aria-label="Remover foto" onClick={onRemove}>X</button></div>;
}

export function QuickReport({ buses, preset, pickPhoto, submit, onRemember, onOpenMyReports }: QuickReportProps) {
    const [form, setForm] = useState<ReportForm>(() => ({ ...emptyForm(), bus: preset?.bus ?? '' }));
    const [photos, setPhotos] = useState<Blob[]>([]), [honey, setHoney] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [result, setResult] = useState<SendResult>(), [done, setDone] = useState(false), [describing, setDescribing] = useState(false), [open, setOpen] = useState<string | null>(null);
    const busRef = useRef<HTMLFieldSetElement>(null), commonRef = useRef<HTMLFieldSetElement>(null);
    const patch = (p: Partial<ReportForm>) => setForm(f => ({ ...f, ...p }));
    const busOptions = [...new Set([...buses, ...(form.bus && form.bus !== NAO_SEI ? [form.bus] : [])])];
    const toggle = (id: string) => {
        setError('');
        if (form.problems.includes(id)) return patch({ problems: form.problems.filter(x => x !== id) });
        if (!canAddProblem(form, id)) return setError('Você marcou muitos itens. Desmarque algum para continuar.');
        patch({ problems: [...form.problems, id] });
    };
    const addPhoto = async () => {
        if (photos.length >= MAX_PHOTOS) return;
        setBusy(true); setError('');
        try { const photo = await pickPhoto(); if (photo) setPhotos(old => [...old, photo].slice(0, MAX_PHOTOS)); }
        catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível obter a foto.'); }
        finally { setBusy(false); }
    };
    const send = async () => {
        const problem = validateForm(form);
        if (problem) { setError(problem); (form.bus ? commonRef : busRef).current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); return; }
        setBusy(true); setError('');
        try { const r = await submit(form, photos, honey); onRemember?.(form.bus); setResult(r); setDone(true); }
        catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar. Tente de novo.'); }
        finally { setBusy(false); }
    };
    const again = () => { setForm({ ...emptyForm(), bus: form.bus }); setPhotos([]); setHoney(''); setError(''); setResult(undefined); setDescribing(false); setOpen(null); setDone(false); };

    if (done) {
        const queued = result === 'pendente', failed = result === 'falhou';
        return <section className="qr" role="status"><h2>{failed ? 'Não foi possível enviar' : queued ? 'Relato guardado, obrigado!' : 'Relato enviado, obrigado!'}</h2>
            {queued && <p>Sem internet agora. O relato será enviado quando a conexão voltar.</p>}
            {failed && <p>Veja o motivo em “Meus relatos” e toque em Reenviar.</p>}
            <button type="button" className="qrPrimary" onClick={again}>Fazer outro relato</button>
            {onOpenMyReports && <button type="button" className="qrSecondary" onClick={onOpenMyReports}>Meus relatos</button>}</section>;
    }
    const room = commentRoom(form);
    return <section className="qr">
        <div className="qrTitleRow"><h2>Relatar problema</h2><span className="qrCount" aria-live="polite">{form.problems.length} marcados</span></div>
        <p className="qrEmergency" role="note">Emergência agora? Ligue 190, 193 ou 192.</p>
        {error && <p role="alert" className="qrError">{error}</p>}

        <fieldset className="qrFieldset" ref={busRef}><legend>Ônibus</legend>
            <div className="qrGroup" role="group" aria-label="Ônibus">{[...busOptions, NAO_SEI].map(b => <button type="button" key={b} className={'qrBtn' + (form.bus === b ? ' on' : '')} aria-pressed={form.bus === b} onClick={() => patch({ bus: b })}>{b}</button>)}</div></fieldset>

        <fieldset className="qrFieldset" ref={commonRef}><legend>Mais comuns, toque para marcar</legend>
            <div className="qrPills">{commonItems.map(item => { const on = form.problems.includes(item.id); return <button type="button" key={item.id} aria-pressed={on} className={'qrPill' + (on ? ' on' : '') + (on && item.urgency === 'U' ? ' urgent' : '')} onClick={() => toggle(item.id)}>{item.common!.short}</button>; })}</div></fieldset>

        <h3 className="qrAll">Ver todos os problemas</h3>
        {checklistSections.map(section => { const marked = section.items.filter(i => form.problems.includes(i.id)).length, isOpen = open === section.id; return <div className="qrSection" key={section.id}>
            <button type="button" className="qrAcc" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : section.id)}><span aria-hidden="true">{section.icon}</span><span className="qrAccTitle">{section.title}</span><span className="qrAccInfo">{marked ? `${marked} marcados` : `${section.items.length} itens`}</span></button>
            {isOpen && section.items.map(item => { const on = form.problems.includes(item.id); return <label key={item.id} className={'qrCheck' + (on ? ' on' : '') + (on && item.urgency === 'U' ? ' urgent' : '')}><input type="checkbox" checked={on} onChange={() => toggle(item.id)}/><span>{item.label}</span></label>; })}
        </div>; })}
        <label className="qrTrap" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={honey} onChange={e => setHoney(e.target.value)}/></label>

        <div className="qrBottom">
            {photos.length > 0 && <div className="qrThumbs">{photos.map((p, i) => <Thumb key={i} blob={p} onRemove={() => setPhotos(photos.filter((_, n) => n !== i))}/>)}</div>}
            {describing && <div className="qrDescribe"><textarea aria-label="Descreva o problema" autoFocus maxLength={room} placeholder="Descreva o problema (opcional)" value={form.comment} onChange={e => patch({ comment: e.target.value.replace(/[<>]/g, '') })}/><span className="qrHint">{form.comment.length}/{room}</span></div>}
            <div className="qrBar2">
                <button type="button" className="qrSecondary" disabled={busy || photos.length >= MAX_PHOTOS} onClick={() => void addPhoto()}>{photos.length ? `Foto (${photos.length})` : 'Tirar foto'}</button>
                <button type="button" className="qrSecondary" aria-expanded={describing} onClick={() => setDescribing(d => !d)}>{form.comment.trim() ? 'Descrever ✓' : 'Descrever'}</button>
            </div>
            <button type="button" className="qrPrimary qrSend" disabled={busy} onClick={() => void send()}>{busy ? 'Aguarde…' : 'Enviar relato'}</button>
        </div>
    </section>;
}
