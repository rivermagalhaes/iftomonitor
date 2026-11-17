// @vitest-environment node
import { initialize } from '../src/data/repository';
import { test, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { unlink } from 'node:fs/promises';
import { SqliteRepository } from '../src/data/sqlite';
import { repositoryContract } from './repository-contract';
test('contrato SQLite: integridade, persistência física após reabrir, contagem e sync', async () => { const file = 'tests/' + crypto.randomUUID() + '.sqlite'; try {
    await repositoryContract(async () => { const db = new DatabaseSync(file); return new SqliteRepository('contract', { execute: async (sql) => db.exec(sql), run: async (sql, values = []) => db.prepare(sql).run(...values as (string | number | null)[]), query: async (sql, values = []) => ({ values: db.prepare(sql).all(...values as (string | number | null)[]) as Record<string, unknown>[] }), close: async () => db.close() }); });
}
finally {
    await unlink(file);
} });

test('SQLite migra payload antigo e cria routes sem perder dados', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE trips(id TEXT PRIMARY KEY,payload TEXT NOT NULL); PRAGMA user_version=1;');
    db.prepare('INSERT INTO trips(id,payload) VALUES (?,?)').run('old',JSON.stringify({id:'old',marker:'preserved'}));
    const repo = new SqliteRepository('legacy', { execute:async sql=>db.exec(sql), run:async(sql,values=[])=>db.prepare(sql).run(...values as (string|number|null)[]), query:async(sql,values=[])=>({values:db.prepare(sql).all(...values as (string|number|null)[]) as Record<string,unknown>[]}), close:async()=>db.close() });
    try { await initialize(repo,'field'); await initialize(repo,'field'); expect(await repo.get('trips','old')).toMatchObject({id:'old',marker:'preserved',route_id:null,route_name:'',events:[]}); expect(await repo.all('routes')).toHaveLength(3); expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(2); }
    finally { await repo.close(); }
});
