import { useState } from 'react';
import type { Monitor } from '../services/monitor';
import { cloneReference, defaultReference, validateReference, type ReferenceConfig } from '../config/reference';
import { currentPosition, lastTripEnd } from '../services/campus';

type Form = Record<string, string>;
const toForm = (c: ReferenceConfig): Form => ({
    lat: String(c.campus.lat), lng: String(c.campus.lng), radiusM: String(c.campus.radiusM),
    morningArrivalDeadline: c.morningArrivalDeadline, eveningDeparture: c.eveningDeparture, eveningArrivalDeadline: c.eveningArrivalDeadline,
    toleranceMin: String(c.toleranceMin), earlyMarginMin: String(c.earlyMarginMin),
    mwStart: c.morningWindow.start, mwEnd: c.morningWindow.end, ewStart: c.eveningWindow.start, ewEnd: c.eveningWindow.end,
    minTripsForObservedTable: String(c.minTripsForObservedTable), stopClusterRadiusM: String(c.stopClusterRadiusM), lowConfidenceGapS: String(c.lowConfidenceGapS)
});
const num = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));
export const fromForm = (f: Form): ReferenceConfig => ({
    campus: { lat: num(f.lat), lng: num(f.lng), radiusM: num(f.radiusM) },
    morningArrivalDeadline: f.morningArrivalDeadline.trim(), eveningDeparture: f.eveningDeparture.trim(), eveningArrivalDeadline: f.eveningArrivalDeadline.trim(),
    toleranceMin: num(f.toleranceMin), earlyMarginMin: num(f.earlyMarginMin),
    morningWindow: { start: f.mwStart.trim(), end: f.mwEnd.trim() }, eveningWindow: { start: f.ewStart.trim(), end: f.ewEnd.trim() },
    minTripsForObservedTable: num(f.minTripsForObservedTable), stopClusterRadiusM: num(f.stopClusterRadiusM), lowConfidenceGapS: num(f.lowConfidenceGapS)
});
const fields: [string, string, 'text' | 'number'][] = [
    ['lat', 'Latitude do campus', 'text'], ['lng', 'Longitude do campus', 'text'], ['radiusM', 'Raio do campus (30–500 m)', 'number'],
    ['morningArrivalDeadline', 'Chegar ao campus até (manhã, HH:MM)', 'text'], ['eveningDeparture', 'Saída do campus (tarde, HH:MM)', 'text'], ['eveningArrivalDeadline', 'Voltar ao campus até (noite, HH:MM)', 'text'],
    ['toleranceMin', 'Tolerância da saída (min)', 'number'], ['earlyMarginMin', 'Chegada adiantada se folga maior que (min)', 'number'],
    ['mwStart', 'Turno da manhã: início (HH:MM)', 'text'], ['mwEnd', 'Turno da manhã: fim (HH:MM)', 'text'], ['ewStart', 'Turno da tarde/noite: início (HH:MM)', 'text'], ['ewEnd', 'Turno da tarde/noite: fim (HH:MM)', 'text'],
    ['minTripsForObservedTable', 'Mínimo de viagens por ponto na tabela observada', 'number'], ['stopClusterRadiusM', 'Raio para juntar paradas (m)', 'number'], ['lowConfidenceGapS', 'Lacuna que reduz a confiança (s)', 'number']
];

export function ReferenceSettings({ monitor: m }: { monitor: Monitor }) {
    const [form, setForm] = useState<Form>(() => toForm(m.snapshot.reference));
    const [message, setMessage] = useState('');
    const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));
    const setCampus = (lat: number, lng: number) => setForm(f => ({ ...f, lat: lat.toFixed(5), lng: lng.toFixed(5) }));
    const save = () => {
        const errors = validateReference(fromForm(form));
        if (errors.length) { setMessage(errors.join(' ')); return; }
        void m.run(async () => { await m.saveReference(fromForm(form)); setMessage('Referências salvas.'); });
    };
    return <section className="card" aria-label="Referências de horário"><h3>Referências de horário</h3>
        <p className="muted">Horários em Fortaleza (UTC−3). O campus é o ponto usado para saber quando o ônibus chegou, saiu ou voltou.</p>
        {fields.map(([key, label, type]) => <label key={key}>{label}<input type={type} inputMode={type === 'number' || key === 'lat' || key === 'lng' ? 'decimal' : 'text'} value={form[key]} onChange={e => set(key, e.target.value)}/></label>)}
        <div className="stack">
            <button className="secondary" type="button" disabled={m.snapshot.busy} onClick={() => void m.run(async () => { const p = await currentPosition(); setCampus(p.latitude, p.longitude); setMessage('Posição atual preenchida. Confira e salve.'); })}>Usar minha posição atual como campus</button>
            <button className="secondary" type="button" disabled={m.snapshot.busy} onClick={() => { const p = lastTripEnd(m.snapshot.trips, m.snapshot.points); if (!p) { setMessage('Nenhuma viagem finalizada com pontos aceitos.'); return; } setCampus(p.latitude, p.longitude); setMessage('Ponto final da última viagem preenchido. Confira e salve.'); }}>Usar o ponto final da última viagem como campus</button>
            <button type="button" disabled={m.snapshot.busy} onClick={save}>Salvar referências</button>
            <button className="link" type="button" disabled={m.snapshot.busy} onClick={() => void m.run(async () => { const d = cloneReference(defaultReference); await m.saveReference(d); setForm(toForm(d)); setMessage('Padrões restaurados.'); })}>Restaurar padrões</button>
        </div>
        {message && <p role="status">{message}</p>}
    </section>;
}
