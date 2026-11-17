// @vitest-environment node
import { test, expect } from 'vitest';
import { chromium } from 'playwright';
import { createServer } from 'vite';
test('contrato único no IndexedDB real e isolamento de bancos', async () => {
    const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, plugins: [{ name: 'contract-harness', configureServer(server) { server.middlewares.use('/harness', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<html></html>'); }); } }], server: { host: '127.0.0.1', port: 5188, strictPort: true } });
    await server.listen();
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.goto('http://127.0.0.1:5188/harness');
        const result = await page.evaluate(async () => {
            const load = new Function('path', 'return import(path)');
            const { IndexedDbRepository } = await load('/src/data/indexeddb/index.ts') as typeof import('../src/data/indexeddb');
            const { repositoryContract } = await load('/tests/repository-contract.ts') as typeof import('./repository-contract');
            const name = 'contract-' + crypto.randomUUID();
            const ok = await repositoryContract(async () => new IndexedDbRepository(name));
            const demo = new IndexedDbRepository(name + '-demo');
            const empty = (await demo.all('trips')).length === 0;
            await demo.close();
            const legacyName = 'legacy-' + crypto.randomUUID();
            await new Promise<void>((resolve, reject) => {
                const request = indexedDB.open(legacyName, 1);
                request.onupgradeneeded = () => {
                    for (const table of ['app_meta', 'vehicles', 'trips', 'gps_points', 'stops']) {
                        const store = request.result.createObjectStore(table, { keyPath: table === 'app_meta' ? 'key' : 'id' });
                        if (table === 'gps_points') store.createIndex('trip_seq', ['trip_id','seq'], { unique: true });
                    }
                };
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const db = request.result, tx = db.transaction(['trips','gps_points'], 'readwrite');
                    tx.objectStore('trips').put({ id: 'old-trip', marker: 'preserved', vehicle_id: 'v' });
                    tx.objectStore('gps_points').put({ id: 'old-point', trip_id: 'old-trip', seq: 1, marker: 'gps-preserved' });
                    tx.oncomplete = () => { db.close(); resolve(); };
                    tx.onerror = () => reject(tx.error);
                };
            });
            const upgraded = new IndexedDbRepository(legacyName);
            const { initialize } = await load('/src/data/repository.ts') as typeof import('../src/data/repository');
            await initialize(upgraded, 'field');
            const initialRoutes = (await upgraded.all('routes')).map(r => r.id);
            await initialize(upgraded, 'field');
            const old = await upgraded.get('trips', 'old-trip');
            const oldPoint = await upgraded.get('gps_points', 'old-point');
            const migration = old?.bus_label === '' && old.app_version === '' && old.route_id === null && old.route_name === '' && old.events?.length === 0 &&
                (old as unknown as {marker:string}).marker === 'preserved' && (oldPoint as unknown as {marker:string}).marker === 'gps-preserved' &&
                JSON.stringify(initialRoutes) === JSON.stringify((await upgraded.all('routes')).map(r => r.id));
            await upgraded.close();
            let migrationV2 = false;
            {
            const legacyV2Name = 'legacy-' + crypto.randomUUID();
            await new Promise<void>((resolve, reject) => {
                const request = indexedDB.open(legacyV2Name, 2);
                request.onupgradeneeded = () => {
                    for (const table of ['app_meta', 'vehicles', 'routes', 'trips', 'gps_points', 'stops']) {
                        const store = request.result.createObjectStore(table, { keyPath: table === 'app_meta' ? 'key' : 'id' });
                        if (table === 'gps_points') store.createIndex('trip_seq', ['trip_id','seq'], { unique: true });
                    }
                };
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const db = request.result, tx = db.transaction(['trips','gps_points'], 'readwrite');
                    tx.objectStore('trips').put({ id: 'old-trip', marker: 'preserved', vehicle_id: 'v' });
                    tx.objectStore('gps_points').put({ id: 'old-point', trip_id: 'old-trip', seq: 1, marker: 'gps-preserved' });
                    tx.oncomplete = () => { db.close(); resolve(); };
                    tx.onerror = () => reject(tx.error);
                };
            });
            const upgraded = new IndexedDbRepository(legacyV2Name);
            const { initialize } = await load('/src/data/repository.ts') as typeof import('../src/data/repository');
            await initialize(upgraded, 'field');
            const initialRoutes = (await upgraded.all('routes')).map(r => r.id);
            await initialize(upgraded, 'field');
            const old = await upgraded.get('trips', 'old-trip');
            const oldPoint = await upgraded.get('gps_points', 'old-point');
            migrationV2 = old?.bus_label === '' && old.app_version === '' && old.route_id === null && old.route_name === '' && old.events?.length === 0 &&
                (old as unknown as {marker:string}).marker === 'preserved' && (oldPoint as unknown as {marker:string}).marker === 'gps-preserved' &&
                JSON.stringify(initialRoutes) === JSON.stringify((await upgraded.all('routes')).map(r => r.id));
            await upgraded.close();
            }
            const legacyV3Name = 'legacy-v3-' + crypto.randomUUID();
            await new Promise<void>((resolve, reject) => {
                const request = indexedDB.open(legacyV3Name, 3);
                request.onupgradeneeded = () => {
                    for (const table of ['app_meta','vehicles','routes','trips','gps_points','stops'])
                        request.result.createObjectStore(table, {keyPath: table === 'app_meta' ? 'key' : 'id'});
                };
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const db = request.result, tx = db.transaction(['trips','gps_points','stops'], 'readwrite');
                    tx.objectStore('trips').put({id:'v3-trip', status:'finished', sync_status:'synced', marker:'preserved', events:[{type:'trip_finished',at:'2026-11-17T10:00:00Z',details:{reason:'user'}}]});
                    tx.objectStore('gps_points').put({id:'v3-point',trip_id:'v3-trip',seq:7,latitude:-10,longitude:-48});
                    tx.objectStore('stops').put({id:'v3-stop',trip_id:'v3-trip',label:'Preservada'});
                    tx.oncomplete = () => {db.close();resolve();};
                    tx.onerror = () => reject(tx.error);
                };
            });
            const migratedV3 = new IndexedDbRepository(legacyV3Name);
            const v3Trip = await migratedV3.get('trips','v3-trip');
            const v3Point = await migratedV3.get('gps_points','v3-point');
            const v3Stop = await migratedV3.get('stops','v3-stop');
            const migrationV3 = v3Trip?.synced_at === null && v3Trip.sync_status === 'pending' &&
                (v3Trip as unknown as {marker:string}).marker === 'preserved' &&
                v3Trip.events?.[0].synced_at === null && v3Trip.events[0].details.reason === 'user' &&
                v3Point?.synced_at === null && v3Point.seq === 7 && v3Point.latitude === -10 &&
                v3Stop?.synced_at === null && v3Stop.label === 'Preservada';
            await migratedV3.close();
            const { Monitor } = await load('/src/services/monitor.ts') as typeof import('../src/services/monitor');
            const real = new IndexedDbRepository('ifto_monitor');
            await real.put('app_meta', { key: 'preserve', value: 'real-data' });
            const monitor = new Monitor();
            await monitor.enter('demo');
            const demoId = monitor.snapshot.vehicles[0].id;
            await monitor.renameVehicle(demoId, 'Fictício');
            await monitor.clearDemo();
            const cleared = !monitor.snapshot.vehicles.some(v => v.label === 'Fictício');
            const preserved = (await real.get('app_meta', 'preserve'))?.value === 'real-data';
            await monitor.dispose();
            await real.close();
            return { ok, empty, cleared, preserved, migration, migrationV2, migrationV3 };
        });
        expect(result).toEqual({ ok: true, empty: true, cleared: true, preserved: true, migration: true, migrationV2: true, migrationV3: true });
    }
    finally {
        await browser.close();
        await server.close();
    }
}, 60000);
