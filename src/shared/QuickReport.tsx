// Formulário rápido de relato: o MESMO componente é usado no app (modo Aluno) e na página web (#/relatar).
import { useEffect, useMemo, useState } from 'react';
import { checklistSections } from './reportChecklist';
import {
    MAX_TEXT, NAO_SEI, canAddProblem, canAdvance, commentRoom, emptyForm, lotacaoLabels, quandoLabels, sentidoLabels, skipBusScreen, validateForm,
    type Lotacao, type Quando, type ReportForm, type Sentido,
} from './reportForm';
import './quickReport.css';

export type SendResult = 'enviado' | 'pendente' | 'falhou' | void;
export interface QuickReportProps {
    buses: string[];
    routes: string[];
    preset?: { bus?: string; route?: string };
    /** Abre câmera/galeria e devolve a foto já reduzida (JPEG, 1280 px, ≤ 1 MB). null = cancelou. */
    pickPhoto: () => Promise<Blob | null>;
    /** Envia o relato. Lança Error com mensagem curta em português se for recusado. */
    submit: (form: ReportForm, photos: Blob[], honeypot: string) => Promise<SendResult>;
    onRemember?: (bus: string, route: string) => void;
    onOpenMyReports?: () => void;
}
const MAX_PHOTOS = 2;
type Step = 'bus' | 'what' | 'almost' | 'done';

function Choice<T extends string>({ value, options, onChange, label }: { value: T | ''; options: { value: T; label: string }[]; onChange: (v: T | '') => void; label: string }) {
    return <div className="qrGroup" role="group" aria-label={label}>{options.map(o => <button type="button" key={o.value} className={'qrBtn' + (value === o.value ? ' on' : '')} aria-pressed={value === o.value} onClick={() => onChange(value === o.value ? '' : o.value)}>{o.label}</button>)}</div>;
}
function PreOrChoice({ title, current, options, onSet }: { title: string; current: string; options: string[]; onSet: (v: string) => void }) {
    const [change, setChange] = useState(false);
    const all = [...options, NAO_SEI];
    return <fieldset className="qrFieldset"><legend>{title}</legend>
        {current && !change ? <p className="qrPre"><strong>{current}</strong> <button type="button" className="qrLink" onClick={() => setChange(true)}>Trocar</button></p>
            : <div className="qrGroup" role="group" aria-label={title}>{all.map(o => <button type="button" key={o} className={'qrBtn' + (current === o ? ' on' : '')} aria-pressed={current === o} onClick={() => onSet(o)}>{o}</button>)}</div>}
    </fieldset>;
}
function Thumb({ blob, onRemove }: { blob: Blob; onRemove: () => void }) {
    const [url, setUrl] = useState('');
    useEffect(() => { const u = URL.createObjectURL(blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [blob]);
    return <div className="qrThumb">{url && <img src={url} alt="Foto do relato"/>}<button type="button" className="qrX" aria-label="Remover foto" onClick={onRemove}>X</button></div>;
}

export function QuickReport(props: QuickReportProps) {
    const { buses, routes, preset, pickPhoto, submit, onRemember, onOpenMyReports } = props;
    const initial = useMemo(() => ({ ...emptyForm(), bus: preset?.bus ?? '', route: preset?.route ?? '' }), [preset?.bus, preset?.route]);
    const [form, setForm] = useState<ReportForm>(initial), [step, setStep] = useState<Step>(() => skipBusScreen(initial) ? 'what' : 'bus');
    const [photos, setPhotos] = useState<Blob[]>([]), [honey, setHoney] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState<SendResult>();
    const skipped = skipBusScreen(initial), total = skipped ? 2 : 3, position = step === 'bus' ? 1 : step === 'what' ? (skipped ? 1 : 2) : (skipped ? 2 : 3);
    const patch = (p: Partial<ReportForm>) => setForm(f => ({ ...f, ...p }));
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
        if (problem) return setError(problem);
        setBusy(true); setError('');
        try { const r = await submit(form, photos, honey); onRemember?.(form.bus, form.route); setResult(r); setStep('done'); }
        catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar. Tente de novo.'); }
        finally { setBusy(false); }
    };
    const again = () => { setForm({ ...emptyForm(), bus: form.bus, route: form.route }); setPhotos([]); setHoney(''); setError(''); setResult(undefined); setStep(form.bus && form.route ? 'what' : 'bus'); };

    if (step === 'done') {
        const queued = result === 'pendente', failed = result === 'falhou';
        return <section className="qr" role="status"><h2>{failed ? 'Não foi possível enviar' : queued ? 'Relato guardado, obrigado!' : 'Relato enviado, obrigado!'}</h2>
            {queued && <p>Sem internet agora. O relato será enviado quando a conexão voltar.</p>}
            {failed && <p>Veja o motivo em “Meus relatos” e toque em Reenviar.</p>}
            <button type="button" className="qrPrimary" onClick={again}>Fazer outro relato</button>
            {onOpenMyReports && <button type="button" className="qrSecondary" onClick={onOpenMyReports}>Meus relatos</button>}</section>;
    }
    return <section className="qr">
        <div className="qrProgress"><div className="qrBar" aria-hidden="true"><i style={{ width: `${position / total * 100}%` }}/></div><span>{position} de {total}</span></div>
        {error && <p role="alert" className="qrError">{error}</p>}

        {step === 'bus' && <>
            <h2>Ônibus e rota</h2>
            <PreOrChoice title="Ônibus" current={form.bus} options={buses} onSet={bus => patch({ bus })}/>
            <PreOrChoice title="Rota" current={form.route} options={routes} onSet={route => patch({ route })}/>
            <div className="qrFooter"><button type="button" className="qrPrimary" disabled={!form.bus || !form.route} onClick={() => { setError(''); setStep('what'); }}>Próximo</button></div>
        </>}

        {step === 'what' && <>
            <p className="qrEmergency" role="note">Emergência agora? Ligue 190 (Polícia), 193 (Bombeiros) ou 192 (SAMU). Este relato não é atendido na hora.</p>
            <h2>O que aconteceu?</h2>
            <p className="qrHint">Marque tudo o que se aplica.</p>
            {checklistSections.map(section => <fieldset className="qrFieldset" key={section.id}><legend><span aria-hidden="true">{section.icon}</span> {section.title}</legend>
                {section.items.map(item => <label key={item.id} className={'qrCheck' + (form.problems.includes(item.id) ? ' on' : '')}><input type="checkbox" checked={form.problems.includes(item.id)} onChange={() => toggle(item.id)}/><span>{item.label}</span></label>)}
            </fieldset>)}
            <div className="qrFooter"><span className="qrCount" aria-live="polite">{form.problems.length} marcados</span>
                <button type="button" className="qrSecondary" onClick={() => setStep('bus')}>Voltar</button>
                <button type="button" className="qrPrimary" disabled={!canAdvance(form)} onClick={() => setStep('almost')}>Próximo</button></div>
        </>}

        {step === 'almost' && <>
            <h2>Quase pronto</h2><p className="qrHint">Tudo aqui é opcional.</p>
            <fieldset className="qrFieldset"><legend>Foi na ida ou na volta?</legend><Choice<Exclude<Sentido, ''>> label="Sentido" value={form.sentido as Exclude<Sentido, ''> | ''} options={(Object.keys(sentidoLabels) as Exclude<Sentido, ''>[]).map(v => ({ value: v, label: sentidoLabels[v] }))} onChange={sentido => patch({ sentido })}/></fieldset>
            <fieldset className="qrFieldset"><legend>Quando foi?</legend><Choice<Quando> label="Quando" value={form.quando} options={(Object.keys(quandoLabels) as Quando[]).map(v => ({ value: v, label: quandoLabels[v] }))} onChange={v => patch({ quando: v || 'agora' })}/></fieldset>
            <fieldset className="qrFieldset"><legend>Quantos alunos, aproximadamente, no ônibus?</legend><Choice<Exclude<Lotacao, ''>> label="Lotação" value={form.lotacao as Exclude<Lotacao, ''> | ''} options={(Object.keys(lotacaoLabels) as Exclude<Lotacao, ''>[]).map(v => ({ value: v, label: lotacaoLabels[v] }))} onChange={lotacao => patch({ lotacao })}/></fieldset>
            <fieldset className="qrFieldset"><legend>Fotos ({photos.length}/{MAX_PHOTOS})</legend>
                <p className="qrHint">Fotografe só o ônibus. Não fotografe pessoas.</p>
                <div className="qrThumbs">{photos.map((p, i) => <Thumb key={i} blob={p} onRemove={() => setPhotos(photos.filter((_, n) => n !== i))}/>)}</div>
                <button type="button" className="qrSecondary" disabled={busy || photos.length >= MAX_PHOTOS} onClick={() => void addPhoto()}>Adicionar foto</button></fieldset>
            <details className="qrDetails"><summary>Quer explicar melhor?</summary>
                <label>Explique (opcional)<textarea maxLength={Math.min(MAX_TEXT, commentRoom(form))} value={form.comment} onChange={e => patch({ comment: e.target.value.replace(/[<>]/g, '') })}/></label>
                <span className="qrHint">{form.comment.length}/{commentRoom(form)}</span></details>
            <label className="qrTrap" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={honey} onChange={e => setHoney(e.target.value)}/></label>
            <div className="qrFooter"><button type="button" className="qrSecondary" disabled={busy} onClick={() => setStep('what')}>Voltar</button>
                <button type="button" className="qrPrimary" disabled={busy} onClick={() => void send()}>{busy ? 'Aguarde…' : 'Enviar relato'}</button></div>
        </>}
    </section>;
}
