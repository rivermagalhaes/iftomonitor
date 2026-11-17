import { useEffect, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, TriangleAlert, MapPinOff } from 'lucide-react';
import type { Monitor } from '../services/monitor';
import { t } from '../i18n/pt-BR';

export function RecordingReadiness({ monitor: m }: { monitor: Monitor }) {
    const s = useSyncExternalStore(m.subscribe, m.getSnapshot);
    const navigate = useNavigate();
    // Resume already refreshes diagnostics through Shell -> reconnectNative.
    useEffect(() => { void m.refreshGpsDiagnostics(); }, [m]);
    const state = m.recordingReadiness;
    const Icon = state === 'ready' ? CircleCheck : state === 'denied' ? MapPinOff : TriangleAlert;
    const message = state === 'ready' ? t.recordingReady : state === 'foreground' ? t.recordingForeground
        : state === 'denied' ? t.recordingDenied : state === 'demo' ? t.recordingDemo
        : !['granted', 'always', 'not_supported'].includes(s.gpsDiagnostics.notification) ? t.recordingNotifications
        : !s.batteryConfirmed ? t.recordingBattery : t.recordingUnavailable;
    return <aside className={`recordingReadiness ${state === 'ready' ? 'gpsActive' : state === 'denied' ? 'error' : 'gpsWarning'}`} role={state === 'denied' ? 'alert' : 'status'}>
        <div className="row"><Icon aria-hidden="true" size={24}/><strong>{message}</strong></div>
        <p>{t.recordingPrivacy}</p>
        {state === 'denied' ? <button disabled={s.busy} onClick={() => void m.run(async () => { await m.provider?.requestPermission(); await m.refreshGpsDiagnostics(); })}>{t.recordingAllow}</button>
            : state === 'foreground' && m.provider?.openSettings ? <button className="secondary" onClick={() => void m.run(() => m.provider!.openSettings!())}>{t.recordingSettings}</button>
            : state !== 'ready' && state !== 'demo' && <button className="secondary" onClick={() => navigate('/settings/reliable')}>{t.recordingGuide}</button>}
    </aside>;
}
