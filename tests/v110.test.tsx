import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { memoryRepository } from './support';
import { Monitor } from '../src/services/monitor';
import { StartTrip } from '../src/components/StartTrip';
import type { LocationProvider } from '../src/services/location';
import { pending, type Stop } from '../src/data/models';
import { mergeStops } from '../src/services/stops';
import { stopsCsv, exportName, exportTrip } from '../src/services/export';
import { localTimestamp } from '../src/lib/time';
import { APP_VERSION } from '../src/config/version';

async function setup(bus = 'Ônibus 02') {
    const repo = memoryRepository();
    if (bus) await repo.put('app_meta', { key: 'bus_label', value: bus });
    const gps: LocationProvider = { onFix: () => {}, onStatus: () => {}, onError: () => {}, requestPermission: async () => {}, start: async () => {}, stop: async () => {} };
    const m = new Monitor(async () => repo, () => gps);
    await m.enter('demo');
    return { repo, gps, m };
}
test('saved bus wins over conflicting vehicle, persists and keeps old trips intact', async () => {
    const { repo, gps, m } = await setup('Outro especial');
    const conflicting = m.snapshot.vehicles.find(v => v.label === 'Ônibus 01')!;
    await m.start(conflicting.id);
    const trip = m.snapshot.active!;
    expect(trip.bus_label).toBe('Outro especial');
    expect((await repo.get('vehicles', trip.vehicle_id))?.label).toBe(trip.bus_label);
    expect(trip.vehicle_id).not.toBe(conflicting.id);
    await m.finish(); await m.dispose();
    const next = new Monitor(async () => repo, () => gps); await next.enter('demo');
    expect(next.snapshot.busLabel).toBe('Outro especial');
    await next.saveBusLabel('Ônibus 03');
    expect((await repo.get('trips', trip.id))?.bus_label).toBe('Outro especial');
    await next.dispose();
});
test('one bus choice and disabled start without bus, including service guard', async () => {
    const { m } = await setup(''); render(<StartTrip monitor={m}/>);
    expect(screen.getAllByRole('group', { name: 'Ônibus' })).toHaveLength(1);
    expect(screen.queryByText('Selecione o veículo')).toBeNull();
    expect((screen.getByRole('button', { name: 'Iniciar viagem' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Escolha o ônibus antes de iniciar')).toBeTruthy();
    await expect(m.start(m.snapshot.vehicles[0].id)).rejects.toThrow('Escolha o ônibus');
    await m.dispose();
});
test('manual inside auto preserves interval, status, id and stays merged on next fix', async () => {
    const { repo, gps, m } = await setup(); await m.start('ignored');
    const base = Date.now() - 30000;
    for (let i = 0; i < 4; i++) gps.onFix({ latitude: 0, longitude: 0, accuracy: 5, speed: 0, timestamp: base + i * 10000 });
    await m.service!.flush(); const auto = (await repo.all('stops'))[0];
    await Promise.all([m.service!.manualStop(), m.service!.manualStop()]);
    expect(await repo.all('stops')).toEqual([expect.objectContaining({ id: auto.id, arrived_at: auto.arrived_at, duration_s: auto.duration_s, status: auto.status, detected_by: 'auto+manual', manually_confirmed: true })]);
    gps.onFix({ latitude: 0, longitude: 0, accuracy: 5, speed: 0, timestamp: base + 40000 }); await m.service!.flush();
    expect(await repo.all('stops')).toHaveLength(1); expect((await repo.all('stops'))[0].detected_by).toBe('auto+manual');
    await m.dispose();
});
test('isolated manual uses tap time and closes only after two moving fixes', async () => {
    const { repo, gps, m } = await setup(); await m.start('ignored');
    const base = Date.now(); gps.onFix({ latitude: 0, longitude: 0, accuracy: 5, speed: 5, timestamp: base - 10000 }); await m.service!.flush();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(base);
    try { await m.manual(); } finally { clock.mockRestore(); }
    expect((await repo.all('stops'))[0]).toMatchObject({ arrived_at: new Date(base).toISOString(), departed_at: null, duration_s: 1 });
    gps.onFix({ latitude: 0, longitude: 0.0001, accuracy: 5, speed: 5, timestamp: base + 10000 }); await m.service!.flush();
    expect((await repo.all('stops'))[0].departed_at).toBeNull();
    gps.onFix({ latitude: 0, longitude: 0.0002, accuracy: 5, speed: 5, timestamp: base + 20000 }); await m.service!.flush();
    expect((await repo.all('stops'))[0]).toMatchObject({ departed_at: new Date(base + 20000).toISOString(), duration_s: 20 }); await m.dispose();
});
test('manual before automatic detection becomes one persisted stop', async () => {
    const { repo, gps, m } = await setup(); await m.start('ignored'); const base = Date.now();
    gps.onFix({ latitude: 0, longitude: 0, accuracy: 5, speed: 0, timestamp: base }); await m.service!.flush(); await m.manual();
    for (let i = 1; i <= 3; i++) gps.onFix({ latitude: 0, longitude: 0, accuracy: 5, speed: 0, timestamp: base + i * 10000 });
    await m.service!.flush(); expect(await repo.all('stops')).toHaveLength(1); expect((await repo.all('stops'))[0].detected_by).toBe('auto+manual'); await m.dispose();
});
test('finish completes isolated manual duration', async () => {
    const { repo, gps, m } = await setup(); await m.start('ignored');
    gps.onFix({ latitude: 0, longitude: 0, accuracy: 5, speed: 5, timestamp: Date.now() }); await m.service!.flush(); await m.manual(); await m.finish();
    const stop = (await repo.all('stops'))[0]; expect(stop.departed_at).not.toBeNull(); expect(stop.duration_s).toBeGreaterThan(0); await m.dispose();
});
const at = '2026-11-17T10:00:00.000Z';
const auto: Stop = { id: 'a', trip_id: 't', arrived_at: at, departed_at: '2026-11-17T10:00:20.000Z', duration_s: 20, latitude: 0, longitude: 0, avg_accuracy_m: 5, status: 'candidata', label: 'Auto', detected_by: 'auto', created_at: at, updated_at: at, ...pending };
test('legacy grouping is immutable and respects trip, time and distance boundaries', () => {
    const manual = { ...auto, id: 'm', detected_by: 'manual' as const, duration_s: 0 };
    const input = [auto, manual]; const original = structuredClone(input);
    expect(mergeStops(input)).toEqual([expect.objectContaining({ id: 'a', duration_s: 20, detected_by: 'auto+manual' })]); expect(input).toEqual(original);
    for (const change of [{ trip_id: 'other' }, { longitude: 1 }, { arrived_at: '2026-11-17T10:01:20.000Z', departed_at: '2026-11-17T10:01:20.000Z' }]) expect(mergeStops([auto, { ...manual, ...change }])).toHaveLength(2);
});
test('stop CSV exact complete header, trip metadata, local times, merged rows and filename', async () => {
    const { m } = await setup(); await m.start('ignored'); const trip = { ...m.snapshot.active!, route_name: '', started_at: at };
    const header = 'stop_id,trip_id,bus_label,route,arrived_at,arrived_at_local,departed_at,departed_at_local,duration_s,latitude,longitude,status,label,detected_by,app_version';
    expect(stopsCsv([])).toBe('\uFEFF' + header + '\r\n');
    const csv = stopsCsv([auto, { ...auto, id: 'm', detected_by: 'manual' }], trip);
    expect(csv.split('\r\n')).toHaveLength(3); const row = csv.split('\r\n')[1].split(',');
    expect(row).toHaveLength(15); expect(row[2]).toBe(trip.bus_label); expect(row[3]).toBe(''); expect(row[5]).toBe(localTimestamp(at)); expect(row[7]).toBe(localTimestamp(auto.departed_at)); expect(row[14]).toBe(APP_VERSION);
    const writeFile = vi.fn(async ({path}: {path: string}) => ({ uri: path }));
    await exportTrip(trip, [], [auto], 'field', 'csv', { writeFile, share: async () => {} });
    expect(writeFile.mock.calls[1][0].path).toBe(exportName(trip, 'field') + '_stops.csv'); expect(writeFile.mock.calls[1][0].path).toContain('_sem-rota_'); await m.dispose();
});
