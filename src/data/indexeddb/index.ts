import { openDB, type IDBPDatabase } from 'idb';
import { type Repository } from '../repository';
import { tableNames, type Table, type Tables } from '../models';
export class IndexedDbRepository implements Repository {
    private db: Promise<IDBPDatabase>;
    private transactions = new Set<Promise<unknown>>();
    private track(done: Promise<unknown>) { this.transactions.add(done); void done.finally(() => this.transactions.delete(done)).catch(() => {}); }
    constructor(public name: string) { this.db = openDB(name, 4, { upgrade(db, _oldVersion, _newVersion, tx) { for (const table of tableNames) {
            if (db.objectStoreNames.contains(table)) continue;
            const store = db.createObjectStore(table, { keyPath: table === 'app_meta' ? 'key' : 'id' });
            if (table === 'gps_points') {
                store.createIndex('trip_seq', ['trip_id', 'seq'], { unique: true });
                store.createIndex('trip_time', ['trip_id', 'recorded_at']);
            }
            if (table === 'stops')
                store.createIndex('trip', 'trip_id');
        }
        for (const table of ['gps_points', 'stops'] as const) {
            void tx.objectStore(table).openCursor().then(async function migrate(row): Promise<void> { if (!row) return; await row.update({ ...row.value, synced_at: row.value.synced_at ?? null }); return migrate(await row.continue()); });
        }
        const cursor = tx.objectStore('trips').openCursor();
        void cursor.then(async function migrate(row): Promise<void> {
            if (!row) return;
            await row.update({ ...row.value, synced_at: row.value.synced_at ?? null, sync_status: row.value.synced_at ? 'synced' : 'pending', events: (row.value.events || []).map((e: object) => ({ ...e, synced_at: null })), bus_label: row.value.bus_label || '', app_version: row.value.app_version || '' });
            return migrate(await row.continue());
        });
        } }); }
    async all<K extends Table>(table: K): Promise<Tables[K][]> {
        const tx = (await this.db).transaction(table, 'readonly');
        this.track(tx.done);
        const rows = await tx.store.getAll(); await tx.done; return rows;
    }
    async get<K extends Table>(table: K, key: string): Promise<Tables[K] | undefined> {
        const tx = (await this.db).transaction(table, 'readonly');
        this.track(tx.done);
        const row = await tx.store.get(key); await tx.done; return row;
    }
    async put<K extends Table>(table: K, row: Tables[K]) {
        const tx = (await this.db).transaction(table, 'readwrite');
        this.track(tx.done);
        await tx.store.put(row); await tx.done;
    }
    async close() { const db = await this.db; await Promise.allSettled([...this.transactions]); db.close(); }
}
