import type { Repository } from '../repository';
import { tableNames, type Table, type Tables } from '../models';
// Connection supplied by @capacitor-community/sqlite after native setup.
export interface SqlConnection {
    execute(sql: string): Promise<unknown>;
    run(sql: string, values?: unknown[]): Promise<unknown>;
    query(sql: string, values?: unknown[]): Promise<{
        values?: Record<string, unknown>[];
    }>;
    close(): Promise<unknown>;
}
export class SqliteRepository implements Repository {
    private ready: Promise<void>;
    constructor(public name: string, private connection: SqlConnection) { this.ready = this.migrate(); }
    private async migrate() { await this.connection.execute(`CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);${tableNames.filter(n => n !== 'app_meta').map(n => `CREATE TABLE IF NOT EXISTS ${n} (id TEXT PRIMARY KEY, payload TEXT NOT NULL${n === 'gps_points' ? ', trip_id TEXT NOT NULL, seq INTEGER NOT NULL, UNIQUE(trip_id,seq)' : ''});`).join('')}PRAGMA user_version = 2;`); }
    async all<K extends Table>(table: K): Promise<Tables[K][]> { await this.ready; const rows = (await this.connection.query(`SELECT * FROM ${table}`)).values || []; return rows.map(r => (table === 'app_meta' ? r : JSON.parse(r.payload as string)) as unknown as Tables[K]); }
    async get<K extends Table>(table: K, key: string): Promise<Tables[K] | undefined> { await this.ready; const rows = (await this.connection.query(`SELECT * FROM ${table} WHERE ${table === 'app_meta' ? 'key' : 'id'} = ?`, [key])).values || []; return rows[0] ? (table === 'app_meta' ? rows[0] : JSON.parse(rows[0].payload as string)) as unknown as Tables[K] : undefined; }
    async put<K extends Table>(table: K, row: Tables[K]) { await this.ready; if (table === 'app_meta') {
        const meta = row as Tables['app_meta'];
        await this.connection.run('INSERT INTO app_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [meta.key, meta.value]);
    }
    else {
        const record = row as Exclude<Tables[Table], Tables['app_meta']>;
        if (table === 'gps_points') {
            const p = row as Tables['gps_points'];
            await this.connection.run('INSERT INTO gps_points(id,payload,trip_id,seq) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,trip_id=excluded.trip_id,seq=excluded.seq', [p.id, JSON.stringify(p), p.trip_id, p.seq]);
        }
        else
            await this.connection.run(`INSERT INTO ${table}(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload`, [record.id, JSON.stringify(row)]);
    } }
    async close() { await this.ready; await this.connection.close(); }
}
