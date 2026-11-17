import { useState } from 'react';
import type { Monitor } from '../services/monitor';
export const busLabels = ['Ônibus 01', 'Ônibus 02', 'Ônibus 03'];
export function BusLabel({ monitor: m, settings = false }: { monitor: Monitor; settings?: boolean }) {
    const current = m.snapshot.busLabel;
    const [other, setOther] = useState(!!current && !busLabels.includes(current));
    const [text, setText] = useState(current);
    return <fieldset className="card"><legend>Ônibus</legend><div className="row">{busLabels.map(label => <button type="button" aria-label={`Definir ${label}`} key={label} className={current === label ? 'selected' : 'secondary'} disabled={m.snapshot.busy} onClick={() => { setOther(false); void m.run(() => m.saveBusLabel(label)); }}>{label}</button>)}<button type="button" className={other ? 'selected' : 'secondary'} onClick={() => setOther(true)}>Outro</button></div>{settings && other && <button className="link" aria-label="Renomear Outro" onClick={() => { const value = window.prompt("Renomear Outro", current); if (value) { setText(value); void m.run(() => m.saveBusLabel(value)); } }}>✎ Renomear Outro</button>}{other && <><label>Nome personalizado<input maxLength={60} value={text} onChange={e => setText(e.target.value)}/></label><button disabled={m.snapshot.busy || !text.trim()} onClick={() => void m.run(() => m.saveBusLabel(text))}>Salvar nome</button></>}</fieldset>;
}
