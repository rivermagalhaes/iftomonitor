import { BusLabel } from './BusLabel';
import { useEffect, useState } from 'react';
import type { Monitor } from '../services/monitor';
import { t } from '../i18n/pt-BR';
import { RoutePicker } from './Routes';
import { MonitorSetup } from '../screens/Onboarding';
import { markTripSetupDone, tripSetupDone } from '../services/profile';
export function StartTrip({ monitor: m }: { monitor: Monitor }) {
    const s = m.snapshot;
    const vehicleId = s.vehicles.find(v => v.label === s.busLabel)?.id || '';
    const [routeId, setRouteId] = useState<string | null>(null);
    const [wizard, setWizard] = useState(false);
    useEffect(() => { setRouteId(m.lastRouteForVehicle(vehicleId)); }, [vehicleId, m]);
    const startNow = () => { if (s.busLabel) void m.run(() => m.start(vehicleId, m.needsBackgroundEducation ? true : undefined, routeId)); };
    // Permissões só aqui: no primeiro "Iniciar viagem" um assistente curto (um botão por etapa). Depois, só a etapa pendente (em m.start).
    const begin = () => {
        if (!s.busLabel) return;
        void (async () => {
            if (!tripSetupDone() && s.mode !== 'demo' && m.permissions.pending(await m.permissions.read())) { setWizard(true); return; }
            markTripSetupDone(); startNow();
        })();
    };
    if (wizard) return <><MonitorSetup permissions={m.permissions} doneLabel={t.start} onDone={() => { markTripSetupDone(); setWizard(false); startNow(); }}/></>;
    return <><BusLabel monitor={m}/>{!s.busLabel && <p>Escolha o ônibus antes de iniciar</p>}
        <RoutePicker monitor={m} value={routeId} onChange={setRouteId}/>
        <button className="bigAction go" disabled={s.busy || !s.busLabel} onClick={begin}>{t.start}</button>
    </>;
}
