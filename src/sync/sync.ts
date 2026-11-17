import type { Repository } from '../data/repository';
import type { Mode, SyncFields, Vehicle, Trip, GpsPoint, Stop } from '../data/models';
type SyncTable = 'vehicles' | 'trips' | 'gps_points' | 'stops';
type Row = (Vehicle | Trip | GpsPoint | Stop) & {
    owner_user_id?: string | null;
};
export interface SyncClient {
    upsert(table: SyncTable, rows: Row[]): Promise<{
        ids: string[];
    }>;
}
export interface SyncContext {
    mode: Mode;
    online: boolean;
    userId: string | null;
    sessionValid: boolean;
}
export const backoff = (attempt: number) => [5000, 30000, 300000, 1800000][Math.min(3, Math.max(0, attempt - 1))];
export class SyncService {
    private running = false;
    constructor(private repo: Repository, private client: SyncClient, private context: () => SyncContext, private now: () => number = () => Date.now()) { }
    async run() {
        const c = this.context();
        if (this.running || c.mode === 'demo' || !c.online || !c.userId || !c.sessionValid)
            return;
        this.running = true;
        try {
            const trips = (await this.repo.all('trips')).filter(t => t.status === 'finished' && (!t.owner_user_id || t.owner_user_id === c.userId));
            const ids = new Set(trips.map(t => t.id));
            const vehicles = new Set(trips.map(t => t.vehicle_id));
            const rows: {
                [K in SyncTable]: Row[];
            } = { vehicles: (await this.repo.all('vehicles')).filter(v => vehicles.has(v.id)), trips, gps_points: (await this.repo.all('gps_points')).filter(p => ids.has(p.trip_id)), stops: (await this.repo.all('stops')).filter(p => ids.has(p.trip_id)) };
            for (const table of ['vehicles', 'trips', 'gps_points', 'stops'] as const) {
                const eligible = rows[table].filter(r => r.sync_status !== 'synced' && (!r.next_retry_at || Date.parse(r.next_retry_at) <= this.now()));
                let failed = false;
                for (let offset = 0; offset < eligible.length; offset += 500) {
                    const batch = eligible.slice(offset, offset + 500);
                    let acknowledged = new Set<string>(), message = '';
                    try {
                        const result = await this.client.upsert(table, batch.map(row => ({ ...row, ...(table === 'trips' || table === 'vehicles' ? { owner_user_id: c.userId } : {}), sync_status: 'synced' })));
                        acknowledged = new Set(result.ids);
                    }
                    catch (error) {
                        message = error instanceof Error ? error.message : 'Sync error';
                    }
                    for (const row of batch) {
                        const current = await this.repo.get(table, row.id);
                        if (!current || JSON.stringify(current) !== JSON.stringify(row))
                            continue;
                        let status: SyncFields;
                        if (acknowledged.has(row.id))
                            status = { sync_status: 'synced', sync_attempts: row.sync_attempts, last_error: null, next_retry_at: null };
                        else {
                            failed = true;
                            const attempts = row.sync_attempts + 1;
                            status = { sync_status: 'error', sync_attempts: attempts, last_error: message || 'Server did not acknowledge ID', next_retry_at: new Date(this.now() + backoff(attempts)).toISOString() };
                        }
                        await this.repo.put(table, { ...current, ...status });
                    }
                }
                const required = new Set(rows[table].map(r => r.id));
                if (failed || (await this.repo.all(table)).some(r => required.has(r.id) && r.sync_status !== 'synced'))
                    break;
            }
        }
        finally {
            this.running = false;
        }
    }
}
