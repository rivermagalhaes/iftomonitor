import type { LocationProvider } from '../src/services/location';
import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { pointsCsv, eventsCsv, exportName, geoJson, exportTrip } from '../src/services/export';
import { localTimestamp } from '../src/lib/time';
import { defaults, pending, type Trip, type GpsPoint, type TripEvent } from '../src/data/models';
import { APP_VERSION } from '../src/config/version';
import { memoryRepository } from './support';
import { Monitor } from '../src/services/monitor';
import { TripScreen, SettingsScreen, Home } from '../src/screens/Screens';
import { detectStops } from '../src/services/stops';
import { RecordingEvents } from '../src/components/RecordingReliability';
const now = '2026-11-16T10:35:32.689Z';
const trip: Trip = { id: '73ac0f2b-rest', vehicle_id: 'v', vehicle_label_snapshot: 'Legacy', bus_label: 'Ônibus 01', route_name: 'Serrano', app_version: '1.8.0', owner_user_id: null, operator_label: 'PRIVATE', status: 'finished', started_at: now, ended_at: now, ended_reason: 'user', device_id: 'device-original', created_at: now, updated_at: now, ...pending };
const point: GpsPoint = { id: 'p', trip_id: trip.id, seq: 1, latitude: -10, longitude: -48, accuracy_m: 5, speed_mps: null, accepted: true, source: 'gps', device_id: trip.device_id, recorded_at: now, received_at: now, ...pending };
const header = 'trip_id,bus_label,route,seq,recorded_at,recorded_at_local,latitude,longitude,accuracy_m,speed_mps,accepted,source,device_id,gap_before_s,suspect,app_version';
function localDevice() {
    const Original = Intl.DateTimeFormat;
    return vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function(locale, options) { return new Original(locale, { ...options, timeZone: 'America/Fortaleza' }); });
}
test('cabecalho exato e sempre completo, inclusive sem pontos', () => {
    expect(pointsCsv([])).toBe('\uFEFF' + header + '\r\n');
    const empty = pointsCsv([point]).split('\r\n')[1].split(',');
    expect(empty).toHaveLength(16); expect(empty[1]).toBe(''); expect(empty[2]).toBe(''); expect(empty[15]).toBe('');
});
test('hora UTC preservada e hora local UTC-3 sem milissegundos', () => {
    expect(localTimestamp(now, 'America/Fortaleza')).toBe('2026-11-16 07:35:32');
    expect(localTimestamp('2026-11-16T01:00:00Z', 'America/Fortaleza')).toBe('2026-11-15 22:00:00');
    const mock = localDevice(); try { const csv = pointsCsv([point], 10000, trip); expect(csv).toContain(now + ',2026-11-16 07:35:32,'); expect(csv).toContain('device-original'); expect(csv).toContain(',1.8.0\r\n'); } finally { mock.mockRestore(); }
});
test('nome local inclui onibus e slug da rota; GeoJSON inclui metadados locais', () => {
    const mock = localDevice(); try {
        expect(exportName(trip, 'field')).toBe('ifto-monitor_Onibus-01_Serrano_20261116-0735_73ac0f2b');
        expect(geoJson(trip, [], []).features[0].properties).toMatchObject({ bus_label: trip.bus_label, app_version: '1.8.0', started_at_local: '2026-11-16 07:35:32', ended_at_local: '2026-11-16 07:35:32' });
    } finally { mock.mockRestore(); }
});
test('escape de virgulas, aspas e novas linhas no onibus, rota e eventos', () => {
    const data = { ...trip, bus_label: 'Bus, "A"', route_name: 'Rota\nB' };
    expect(pointsCsv([point], 10000, data)).toContain('"Bus, ""A""","Rota\nB"');
    expect(eventsCsv({ ...data, events: [{ type: 'paused', at: now, details: { reason: 'a,"b"' } }] })).toContain('"Bus, ""A""","Rota\nB",paused,');
});
const types: TripEvent['type'][] = ['trip_started', 'trip_finished', 'paused', 'resumed', 'recording_interrupted', 'recording_resumed', 'app_restarted', 'route_changed', 'route_edited', 'gps_lost', 'gps_restored', 'permission_changed', 'watchdog_restarted'];
test('eventos exporta todos os tipos, detalhes e versao, inclusive cabecalho vazio', () => {
    const csv = eventsCsv({ ...trip, events: types.map(type => ({ type, at: now, details: { seconds_without_points: 60 } })) });
    expect(csv.split('\r\n')[0]).toBe('\uFEFFtrip_id,bus_label,route,event_type,occurred_at,occurred_at_local,detail,app_version');
    types.forEach(type => expect(csv).toContain(',' + type + ',')); expect(csv).toContain('seconds_without_points');
    expect(eventsCsv(trip).split('\r\n')).toHaveLength(2);
});
test.each([10, 15, 20, 30])('paradas respeitam minimo configurado %s segundos', seconds => {
    const points = [0, 10, 20, 30].map(s => ({ ...point, id: String(s), speed_mps: 0, seq: s, recorded_at: new Date(Date.parse(now) + s * 1000).toISOString() }));
    expect(detectStops(points.filter(p => Date.parse(p.recorded_at) - Date.parse(now) < seconds * 1000), { ...defaults, stopMinDurationS: seconds })).toHaveLength(0);
    expect(detectStops(points, { ...defaults, stopMinDurationS: seconds })[0].duration_s).toBe(30);
});
async function setup() {
    const repo = memoryRepository();
    const provider: LocationProvider = { onFix: () => {}, onError: () => {}, onStatus: () => {}, requestPermission: async () => {}, start: vi.fn(async () => {}), stop: vi.fn(async () => {}) };
    const m = new Monitor(async () => repo, () => provider); await m.enter('demo');
    return { repo, provider, m };
}
test('nome persistente obrigatorio na UI, Outro e snapshot preservado ao reiniciar', async () => {
    const { repo, m } = await setup();
    const view = render(<MemoryRouter><TripScreen monitor={m}/></MemoryRouter>);
    expect((screen.getByRole('button', { name: 'Iniciar viagem' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Outro' })); fireEvent.change(screen.getByLabelText('Nome personalizado'), { target: { value: 'Bus especial' } }); fireEvent.click(screen.getByRole('button', { name: 'Salvar nome' }));
    await waitFor(() => expect(m.snapshot.busLabel).toBe('Bus especial'));
    view.unmount(); await m.start(m.snapshot.vehicles[0].id); const original = m.snapshot.active!;
    expect(original).toMatchObject({ bus_label: 'Bus especial', app_version: APP_VERSION });
    await m.dispose(); const next = new Monitor(async () => repo, () => ({ onFix: () => {}, onError: () => {}, onStatus: () => {}, requestPermission: async () => {}, start: async () => {}, stop: async () => {} }));
    await next.enter('demo'); expect(next.snapshot.busLabel).toBe('Bus especial'); expect(next.snapshot.active).toMatchObject({ id: original.id, device_id: original.device_id, app_version: APP_VERSION, bus_label: original.bus_label });
    await next.saveBusLabel('Changed'); expect(next.snapshot.active?.bus_label).toBe('Bus especial'); await next.dispose();
});
test('pausa nao aciona vigia; retomada e fim persistem eventos', async () => {
    const {m, provider} = await setup(); await m.saveBusLabel('Ônibus 01'); await m.start(m.snapshot.vehicles[0].id); await m.pause();
    expect(await m.checkRecording('watchdog', Date.now() + 600000)).toBe(false); expect(provider.start).toHaveBeenCalledTimes(1);
    await m.resume(); expect(await m.service!.watchdog(Date.now() + 1000)).toBe(false); await m.finish(); expect(m.snapshot.trips[0].events?.map(e => e.type)).toEqual(['trip_started','paused','resumed','trip_finished']); await m.dispose();
});
test('perda e recuperacao GPS e permissao sao persistidas no CSV', async () => {
    const {m, provider} = await setup(); await m.saveBusLabel('Ônibus 01'); await m.start(m.snapshot.vehicles[0].id);
    provider.onStatus('unavailable'); provider.onStatus('ok'); provider.onStatus('denied');
    await m.service!.flush(); const csv = eventsCsv(m.service!.active!); ['gps_lost','gps_restored','permission_changed'].forEach(type => expect(csv).toContain(type)); await m.dispose();
});
test('configuracao 10s persiste e indicador depende da bateria e permissoes', async () => {
    const {m} = await setup(); await m.saveSettings({ ...defaults, stopMinDurationS: 10 }); expect(m.snapshot.settings.stopMinDurationS).toBe(10);
    const view = render(<MemoryRouter><SettingsScreen monitor={m}/></MemoryRouter>); expect(screen.getByRole('combobox')).toBeTruthy(); view.unmount();
    m.patch({ batteryConfirmed: true, gpsDiagnostics: { provider: 'background', foreground: 'granted', background: 'granted', notification: 'granted', backgroundActive: true } });
    render(<MemoryRouter><Home monitor={m}/></MemoryRouter>); expect(m.reliableRecording).toBe(true); expect(screen.queryByText(/Gravação confiável/)).toBeNull(); m.patch({batteryConfirmed:false}); expect(m.reliableRecording).toBe(false); await m.dispose();
});
test('eventos ficam recolhidos por padrao', () => { const view = render(<RecordingEvents trip={trip}/>); expect(view.container.querySelector('details')?.open).toBe(false); });
test('compartilha juntos e fallback individual apenas se multiplos nao suportados', async () => {
    const writeFile = vi.fn(async ({path}: {path:string}) => ({uri:path})); const share = vi.fn().mockRejectedValueOnce(new Error('Multiple files not supported')).mockResolvedValue({});
    await exportTrip(trip, [point], [], 'field', ['csv','events'], {writeFile,share}); expect(writeFile).toHaveBeenCalledTimes(3); expect(share.mock.calls[0][0].files).toHaveLength(3); expect(share).toHaveBeenCalledTimes(4); expect(writeFile.mock.calls[2][0].path).toMatch(/_eventos.csv$/);
    const cancelled = vi.fn().mockRejectedValue(new Error('Share canceled')); await expect(exportTrip(trip, [], [], 'field', ['csv','events'], {writeFile,share:cancelled})).rejects.toThrow('Share canceled'); expect(cancelled).toHaveBeenCalledTimes(1);
});
