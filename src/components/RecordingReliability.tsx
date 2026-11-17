import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Monitor } from '../services/monitor';
import type { Trip } from '../data/models';
const time = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export function InterruptionBanner({ monitor: m }: { monitor: Monitor }) {
    const navigate = useNavigate(); const notice = m.snapshot.interruption;
    if (!notice) return null;
    return <aside className="warning" role="status"><p>A gravação ficou parada das {time(notice.from)} às {time(notice.to)}. O Android pode estar limitando o app. Veja o guia de bateria.</p><div className="row"><button className="secondary" onClick={() => navigate('/settings/reliable')}>Ver guia</button><button className="link" aria-label="Fechar aviso de interrupção" onClick={() => m.patch({ interruption: null })}>X</button></div></aside>;
}
export function RecordingChecklist({ busy, onStart, onCancel, busLabel }: { busLabel?: string; busy: boolean; onStart: (skip: boolean, battery: boolean) => void; onCancel: () => void }) {
    const [checks, setChecks] = useState([false, false, false, false]), [skip, setSkip] = useState(false);
    const items = ['Localização o tempo todo e precisa', 'Notificações permitidas', 'Bateria sem restrições', 'App fixado nos recentes'];
    return <section className="card stack" role="dialog" aria-label="Antes de iniciar a gravação" aria-modal="true"><h3>Antes de iniciar</h3><p>{busLabel}</p><p>Confira a configuração de gravação. Você pode iniciar sem marcar os itens.</p>
        {items.map((item, i) => <label key={item}><input type="checkbox" checked={checks[i]} onChange={e => setChecks(checks.map((value, index) => i === index ? e.target.checked : value))}/>{item}</label>)}
        <label><input type="checkbox" checked={skip} onChange={e => setSkip(e.target.checked)}/>Não mostrar de novo por 24 h</label>
        <button disabled={busy} onClick={() => onStart(skip, checks[2])}>Já configurei, iniciar</button><button className="link" onClick={onCancel}>Cancelar</button>
    </section>;
}
export function ReliableRecordingGuide({ monitor: m }: { monitor: Monitor }) {
    const navigate = useNavigate(); return <><button className="link" onClick={() => navigate('/settings')}>Voltar</button><h2>Gravação confiável</h2><section className="card"><h3>Motorola / Android 14+</h3><label><input type="checkbox" checked={m.snapshot.batteryConfirmed} onChange={e => void m.run(() => m.confirmBattery(e.target.checked))}/>Confirmei bateria sem restrições neste aparelho</label><ol className="batterySteps">
        <li>Configurações &gt; Apps &gt; IFTO Monitor &gt; Bateria &gt; “Sem restrições”.</li>
        <li>Configurações &gt; Apps &gt; IFTO Monitor &gt; Permissões &gt; Localização &gt; “Permitir o tempo todo”, com localização precisa.</li>
        <li>Permita as notificações do app. Mantenha visível a notificação fixa “Gravando percurso” durante a coleta.</li>
        <li>Abra os apps recentes e fixe/tranque o IFTO Monitor: ícone do app no topo do cartão &gt; “Manter aberto”, se disponível no aparelho.</li>
        <li>Desative a economia de bateria do sistema durante a coleta.</li>
    </ol>{m.provider?.openSettings && <button onClick={() => void m.run(() => m.provider!.openSettings!())}>Abrir configurações do app</button>}</section></>;
}
export function RecordingEvents({ trip }: { trip: Trip }) {
    const labels: Record<string, string> = { trip_started: 'Viagem iniciada', trip_finished: 'Viagem encerrada', paused: 'Pausa', resumed: 'Retomada', gps_lost: 'Sinal GPS perdido', gps_restored: 'Sinal GPS recuperado', permission_changed: 'Permissão alterada', watchdog_restarted: 'Serviço reiniciado pelo vigia', recording_interrupted: 'Gravação interrompida', recording_resumed: 'Gravação retomada', app_restarted: 'Aplicativo reaberto', route_changed: 'Rota alterada durante a viagem', route_edited: 'Rota corrigida no histórico' };
    return <details className="card"><summary>Eventos</summary>{!trip.events?.length && <p className="muted">Nenhum evento registrado.</p>}<ol>{(trip.events || []).map((event, i) => <li key={i}><p>{labels[event.type]} às {time(event.type === 'recording_interrupted' && typeof event.details.last_point_at === 'string' ? event.details.last_point_at : event.at)}</p>{(event.type === 'route_changed' || event.type === 'route_edited') && <small>{String(event.details.previous_route || 'Sem rota')} → {String(event.details.route || 'Sem rota')}</small>}</li>)}</ol></details>;
}
