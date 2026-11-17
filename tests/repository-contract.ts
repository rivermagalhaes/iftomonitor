import { initialize, counts, type Repository } from '../src/data/repository';
import { pending, type Trip, type GpsPoint } from '../src/data/models';
function equal(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`Contrato: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`); }
export async function repositoryContract(open: () => Promise<Repository>) {
    let repo = await open();
    await initialize(repo);
    equal((await repo.all('vehicles')).length, 3);
    const device = (await repo.get('app_meta', 'device_id'))!.value;
    const v = (await repo.all('vehicles'))[0];
    const now = new Date().toISOString();
    const trip: Trip = { id: crypto.randomUUID(), vehicle_id: v.id, vehicle_label_snapshot: v.label, owner_user_id: null, operator_label: 'AB', status: 'recording', started_at: now, ended_at: null, ended_reason: null, device_id: device, created_at: now, updated_at: now, ...pending };
    await repo.put('trips', trip);
    const point: GpsPoint = { id: crypto.randomUUID(), trip_id: trip.id, seq: 1, latitude: -10, longitude: -48, accuracy_m: 5, speed_mps: 0, recorded_at: now, received_at: now, device_id: device, source: 'gps', accepted: true, ...pending };
    await repo.put('gps_points', point);
    let rejected = false;
    try {
        await repo.put('gps_points', { ...point, id: crypto.randomUUID() });
    }
    catch {
        rejected = true;
    }
    equal(rejected, true);
    await repo.put('trips', { ...trip, status: 'finished', ended_at: now, ended_reason: 'user' });
    await repo.close();
    repo = await open();
    equal((await repo.get('trips', trip.id))!.status, 'finished');
    equal((await repo.all('gps_points')).length, 1);
    equal(await counts(repo), { points: 1, stops: 0, pending: 5 });
    await repo.put('gps_points', { ...point, sync_status: 'synced' });
    equal((await counts(repo)).pending, 4);
    equal((await repo.get('app_meta', 'device_id'))!.value, device);
    await repo.close();
    return true;
}
