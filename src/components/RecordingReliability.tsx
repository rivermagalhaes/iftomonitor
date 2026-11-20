import type { Monitor } from '../services/monitor';
import type { Trip } from '../data/models';
const time = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export function InterruptionBanner({ monitor: m }: { monitor: Monitor }) {
    const notice = m.snapshot.interruption;
    if (!notice) return null;
    return <aside className="warning" role="status"><p>A gravação ficou parada das {time(notice.from)} às {time(notice.to)}. O Android pode estar limitando o app.</p><div className="row"><button className="link" aria-label="Fechar aviso de interrupção" onClick={() => m.patch({ interruption: null })}>X</button></div></aside>;
}
export function RecordingEvents({ trip }: { trip: Trip }) {
    const labels: Record<string, string> = { trip_started: 'Viagem iniciada', trip_finished: 'Viagem encerrada', paused: 'Pausa', resumed: 'Retomada', gps_lost: 'Sinal GPS perdido', gps_restored: 'Sinal GPS recuperado', permission_changed: 'Permissão alterada', watchdog_restarted: 'Serviço reiniciado pelo vigia', recording_interrupted: 'Gravação interrompida', recording_resumed: 'Gravação retomada', app_restarted: 'Aplicativo reaberto', route_changed: 'Rota alterada durante a viagem', route_edited: 'Rota corrigida no histórico' };
    return <details className="card"><summary>Eventos</summary>{!trip.events?.length && <p className="muted">Nenhum evento registrado.</p>}<ol>{(trip.events || []).map((event, i) => <li key={i}><p>{labels[event.type]} às {time(event.type === 'recording_interrupted' && typeof event.details.last_point_at === 'string' ? event.details.last_point_at : event.at)}</p>{(event.type === 'route_changed' || event.type === 'route_edited') && <small>{String(event.details.previous_route || 'Sem rota')} → {String(event.details.route || 'Sem rota')}</small>}</li>)}</ol></details>;
}
