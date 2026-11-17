import { mergeStops } from '../services/stops';
import { t } from '../i18n/pt-BR';
import { pending, type Table, type Tables, type Mode } from './models';
export interface Repository {
    name: string;
    all<K extends Table>(table: K): Promise<Tables[K][]>;
    put<K extends Table>(table: K, row: Tables[K]): Promise<void>;
    get<K extends Table>(table: K, key: string): Promise<Tables[K] | undefined>;
    close(): Promise<void>;
}
export const databaseName = (mode: Mode) => mode === 'demo' ? 'ifto_monitor_demo' : 'ifto_monitor';
export async function initialize(repo: Repository, mode: Mode = repo.name.includes('demo') ? 'demo' : 'field') {
    if (!await repo.get('app_meta', 'device_id'))
        await repo.put('app_meta', { key: 'device_id', value: crypto.randomUUID() });
    await repo.put('app_meta', { key: 'schema_version', value: '4' });
    for (const trip of await repo.all('trips')) {
        if (trip.route_id === undefined || trip.route_name === undefined || trip.events === undefined || trip.bus_label === undefined || trip.app_version === undefined) {
            await repo.put('trips', { ...trip, route_id: trip.route_id ?? null, route_name: trip.route_name || '', events: trip.events || [], bus_label: trip.bus_label || '', app_version: trip.app_version || '' });
        }
    }
    if (mode !== 'authenticated' && !(await repo.all('routes')).length) {
        const now = new Date().toISOString();
        for (const name of mode === 'demo' ? ['Exemplo Centro', 'Exemplo Campus', 'Exemplo Bairro'] : ['Jardim Paulista', 'Pouso Alegre', 'Serrano']) {
            await repo.put('routes', { id: crypto.randomUUID(), name, active: true, created_at: now, updated_at: now, ...pending });
        }
    }
    if (!(await repo.all('vehicles')).length) {
        const now = new Date().toISOString();
        for (let n = 1; n <= 3; n++)
            await repo.put('vehicles', { id: crypto.randomUUID(), label: t.vehicle(n), active: true, created_at: now, updated_at: now, ...pending });
    }
}
export async function counts(repo: Repository) { const [points, stops, vehicles, trips] = await Promise.all([repo.all('gps_points'), repo.all('stops'), repo.all('vehicles'), repo.all('trips')]); return { points: points.length, stops: mergeStops(stops).filter(s => s.status !== 'descartada').length, pending: repo.name === 'ifto_monitor_demo' ? 0 : [...points, ...stops, ...vehicles, ...trips].filter(r => r.sync_status === 'pending').length }; }
export async function tripData(repo: Repository, id: string) { return { trip: await repo.get('trips', id), points: (await repo.all('gps_points')).filter(p => p.trip_id === id).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at) || a.seq - b.seq), stops: (await repo.all('stops')).filter(s => s.trip_id === id).sort((a, b) => a.arrived_at.localeCompare(b.arrived_at)) }; }

export async function vehicleForBus(repo: Repository, label: string) {
    const name = label.trim();
    if (!name) throw new Error('Escolha o ônibus antes de iniciar');
    const existing = (await repo.all('vehicles')).find(v => v.label === name && v.active);
    if (existing) return existing;
    const now = new Date().toISOString();
    const vehicle = { id: crypto.randomUUID(), label: name, active: true, created_at: now, updated_at: now, ...pending };
    await repo.put('vehicles', vehicle);
    return vehicle;
}
