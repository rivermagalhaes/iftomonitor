import { useEffect } from 'react';
import type { Monitor } from '../services/monitor';
import { chronological } from '../lib/geo';
import { dateTime } from '../lib/time';

const permission = (value: string) => value === 'granted' || value === 'always' ? 'Permitida' : value === 'denied' ? 'Negada' : value === 'not_supported' || value === 'not_applicable' ? 'Não se aplica' : value === 'unknown' ? 'Não verificada' : 'Ainda não permitida';
export function RecordingGpsState({ monitor: m }: { monitor: Monitor }) {
    const s = m.snapshot;
    const last = s.lastPointAt || s.points.filter(p => p.trip_id === s.active?.id).at(-1)?.recorded_at;
    const age = last ? Math.max(0, Math.floor((Date.now() - Date.parse(last)) / 1000)) : null;
    const lastPoint = <p className="muted">{age === null ? 'Aguardando primeiro ponto' : `Último ponto há ${age} s`}</p>;
    if (s.mode === 'demo') return <><p className="gpsActive">Gravando (simulado)</p>{lastPoint}</>;
    const active = s.gpsDiagnostics.backgroundActive;
    const state = s.recordingState === 'stopped' ? 'Parada' : s.recordingState === 'restarting' ? 'Interrompida — reiniciando…' : active ? 'Gravando (segundo plano ativo)' : 'Gravando (somente com o app aberto)';
    return <><p className={s.recordingState === 'stopped' ? 'error' : active && s.recordingState === 'recording' ? 'gpsActive' : 'gpsWarning'} role="status">{state}</p>{lastPoint}{!active && <p className="warning" role="status">Gravação em segundo plano desativada. Mantenha o app aberto ou permita 'o tempo todo' nos Ajustes do Android.</p>}</>;
}
export function GpsDiagnostics({ monitor: m }: { monitor: Monitor }) {
    useEffect(() => { void m.refreshGpsDiagnostics(); }, [m]);
    const s = m.snapshot, state = s.gpsDiagnostics;
    const ordered = chronological(s.points);
    const tripId = s.active?.id || ordered.at(-1)?.trip_id;
    const points = ordered.filter(p => p.trip_id === tripId).slice(-10);
    const last = points.at(-1);
    const mean = points.length > 1 ? (Date.parse(last!.recorded_at) - Date.parse(points[0].recorded_at)) / 1000 / (points.length - 1) : null;
    const provider = state.provider === 'background' ? 'nativo em segundo plano' : state.provider === 'simulated' ? 'simulado' : 'navegador / primeiro plano';
    return <section className="card"><h3>Diagnóstico de GPS</h3>
        <dl><dt>Provider em uso</dt><dd>{provider}</dd>
        <dt>Localização em primeiro plano</dt><dd>{permission(state.foreground)}</dd>
        <dt>Localização em segundo plano</dt><dd>{permission(state.background)}</dd>
        <dt>Notificações</dt><dd>{permission(state.notification)}</dd>
        <dt>Hora do último ponto recebido</dt><dd>{last ? dateTime(last.received_at) : 'Nenhum ponto recebido'}</dd>
        <dt>Intervalo médio dos últimos 10 pontos</dt><dd>{mean === null ? 'Aguardando dois pontos' : `${mean.toFixed(1)} s`}</dd></dl>
        <p>Em Configurações do Android &gt; Apps &gt; IFTO Monitor &gt; Bateria, escolha 'Sem restrições'</p>
        <button className="secondary" disabled={s.busy} onClick={() => void m.run(() => m.refreshGpsDiagnostics())}>Atualizar diagnóstico</button>
        {m.provider?.openSettings && <button className="link" onClick={() => void m.run(() => m.provider!.openSettings!())}>Abrir Ajustes do Android</button>}
    </section>;
}
