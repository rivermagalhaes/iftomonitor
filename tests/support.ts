import type { Repository } from '../src/data/repository';
import type { Table, Tables } from '../src/data/models';
export function memoryRepository(name = 'ifto_monitor_demo'): Repository {
    const rows = new Map<Table, Map<string, Tables[Table]>>();
    return { name, async all<K extends Table>(table: K) { return [...(rows.get(table)?.values() || [])].map(r => structuredClone(r)) as Tables[K][]; }, async get<K extends Table>(table: K, id: string) { return structuredClone(rows.get(table)?.get(id)) as Tables[K] | undefined; }, async put<K extends Table>(table: K, row: Tables[K]) { let store = rows.get(table); if (!store) {
            store = new Map();
            rows.set(table, store);
        } store.set('key' in row ? row.key : row.id, structuredClone(row)); }, async close() { } };
}
