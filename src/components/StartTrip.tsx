import { BusLabel } from './BusLabel';
import { useEffect, useState } from 'react';
import type { Monitor } from '../services/monitor';
import { t } from '../i18n/pt-BR';
import { RoutePicker } from './Routes';
export function StartTrip({ monitor: m }: { monitor: Monitor }) {
    const s = m.snapshot;
    const vehicleId = s.vehicles.find(v => v.label === s.busLabel)?.id || '';
    const [routeId, setRouteId] = useState<string | null>(null);
    const [stage, setStage] = useState<'idle' | 'education'>('idle');
    useEffect(() => { setRouteId(m.lastRouteForVehicle(vehicleId)); }, [vehicleId, m]);
    const start = (choice?: boolean) => {
        if (!s.busLabel) return;
        void m.run(() => m.start(vehicleId, choice, routeId));
    };
    return <><BusLabel monitor={m}/>{!s.busLabel && <p>Escolha o ônibus antes de iniciar</p>}
        <RoutePicker monitor={m} value={routeId} onChange={setRouteId}/>
        <button className="full" disabled={s.busy || !s.busLabel || stage !== 'idle'} onClick={() => { if (m.needsBackgroundEducation) setStage('education'); else start(); }}>{t.start}</button>
        {stage === 'education' && <section className="card stack" role="dialog" aria-modal="true" aria-label="Gravar com a tela bloqueada"><h3>Gravar com a tela bloqueada</h3><p>Para gravar com a tela bloqueada, permita a localização 'o tempo todo' e as notificações.</p><button onClick={() => { setStage('idle'); start(true); }}>Continuar</button><button className="secondary" onClick={() => { setStage('idle'); start(false); }}>Agora não</button></section>}
    </>;
}
