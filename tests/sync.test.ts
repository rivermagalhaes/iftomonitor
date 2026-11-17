import { test, expect } from 'vitest';
import { SyncService, backoff, type SyncClient } from '../src/sync/sync';
import { memoryRepository } from './support';
import { initialize } from '../src/data/repository';
import { pending, type Trip } from '../src/data/models';
async function fixture(n = 1) { const repo = memoryRepository('ifto_monitor'); await initialize(repo); const now = new Date().toISOString(), vehicle = (await repo.all('vehicles'))[0]; const trip: Trip = { id: 't', vehicle_id: vehicle.id, vehicle_label_snapshot: vehicle.label, owner_user_id: null, operator_label: 'AB', status: 'finished', started_at: now, ended_at: now, ended_reason: 'user', device_id: 'd', created_at: now, updated_at: now, ...pending }; await repo.put('trips', trip); for (let i = 0; i < n; i++)
    await repo.put('gps_points', { id: 'p' + i, trip_id: 't', seq: i, latitude: 0, longitude: 0, accuracy_m: 5, speed_mps: 0, recorded_at: now, received_at: now, device_id: 'd', source: 'gps', accepted: true, ...pending }); return repo; }
const context = () => ({ mode: 'authenticated' as const, online: true, userId: 'u', sessionValid: true });
test('ordem, lote máximo 500 e idempotência', async () => { const repo = await fixture(1001), calls: string[] = [], sizes: number[] = [], server = new Set<string>(); const client: SyncClient = { async upsert(table, rows) { calls.push(table); sizes.push(rows.length); rows.forEach(r => server.add(r.id)); return { ids: rows.map(r => r.id) }; } }; const sync = new SyncService(repo, client, context); await sync.run(); expect(calls).toEqual(['vehicles', 'trips', 'gps_points', 'gps_points', 'gps_points']); expect(Math.max(...sizes)).toBe(500); expect(server.size).toBe(1003); await sync.run(); expect(calls).toHaveLength(5); });
test('falha, recuo e retry só confirma IDs reconhecidos', async () => { const repo = await fixture(2); let clock = 0, fail = true; const client: SyncClient = { async upsert(table, rows) { if (table === 'gps_points') {
        if (fail)
            throw new Error('offline');
        return { ids: ['p0'] };
    } return { ids: rows.map(r => r.id) }; } }; const sync = new SyncService(repo, client, context, () => clock); await sync.run(); expect((await repo.get('gps_points', 'p0'))!.sync_status).toBe('error'); expect((await repo.get('gps_points', 'p0'))!.sync_attempts).toBe(1); fail = false; clock = 4999; await sync.run(); expect((await repo.get('gps_points', 'p0'))!.sync_status).toBe('error'); clock = 5000; await sync.run(); expect((await repo.get('gps_points', 'p0'))!.sync_status).toBe('synced'); expect((await repo.get('gps_points', 'p1'))!.sync_status).toBe('error'); expect(backoff(8)).toBe(1800000); });
test('demo, offline e sessão inválida nunca enviam', async () => { const repo = await fixture(); let calls = 0; const client: SyncClient = { async upsert() { calls++; return { ids: [] }; } }; for (const patch of [{ mode: 'demo' as const }, { online: false }, { userId: null }, { sessionValid: false }])
    await new SyncService(repo, client, () => ({ ...context(), ...patch })).run(); expect(calls).toBe(0); });
test('alteração durante envio não é marcada synced', async () => { const repo = await fixture(); const client: SyncClient = { async upsert(table, rows) { if (table === 'trips') {
        const trip = await repo.get('trips', 't');
        await repo.put('trips', { ...trip!, updated_at: 'changed' });
    } return { ids: rows.map(r => r.id) }; } }; await new SyncService(repo, client, context).run(); expect((await repo.get('trips', 't'))!.sync_status).toBe('pending'); });
