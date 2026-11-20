import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { App } from '../src/app/App';
import { Monitor } from '../src/services/monitor';
import { cloudPayload, liveStateKey, syncLive, type CloudRow, type CloudWriter } from '../src/services/cloudSync';
import { LIVE_BATCH, LIVE_INTERVAL_MS, LIVE_MAX_BATCHES, liveTripId } from '../src/shared/liveTrip';
import { STALE_MS, activeLiveTrips, lastPointByTrip, liveState, pickLastPoint, trailSince } from '../src/lib/live';
import { pending, type GpsPoint, type Trip } from '../src/data/models';
import type { LocationProvider } from '../src/services/location';
import { memoryRepository } from './support';

const gps = (): LocationProvider => ({ onFix: () => { }, onError: () => { }, onStatus: () => { }, preserveAll: true, requestPermission: vi.fn(async () => { }), start: vi.fn(async () => { }), stop: vi.fn(async () => { }) });
const T0 = Date.parse('2026-11-20T12:00:00Z');
const trip = (over: Partial<Trip> = {}): Trip => ({ id: '11111111-2222-4333-8444-555555555555', vehicle_id: 'v', vehicle_label_snapshot: 'Ônibus 02', bus_label: 'Ônibus 02', route_name: 'Serrano', route_id: null, owner_user_id: null, operator_label: 'x', status: 'recording', started_at: new Date(T0).toISOString(), ended_at: null, ended_reason: null, device_id: 'd', gps_interval_ms: 10000, events: [], created_at: '', updated_at: '', ...pending, ...over });
const point = (seq: number, over: Partial<GpsPoint> = {}, tripId = trip().id): GpsPoint => ({ id: `p${seq}`, trip_id: tripId, seq, latitude: -10.2 + seq * 1e-4, longitude: -48.9, accuracy_m: 5, speed_mps: 10, recorded_at: new Date(T0 + seq * 10000).toISOString(), received_at: '', device_id: 'd', source: 'gps', accepted: true, ...pending, ...over });
const writer = (failOn?: () => boolean) => { const calls: { table: string; rows: CloudRow[] }[] = []; const w: CloudWriter = { async insert(table, rows) { if (failOn?.()) return { error: { message: 'rede' }, status: 500 }; calls.push({ table, rows }); return { error: null, status: 201 }; } }; return { w, calls }; };
const seed = async (n: number) => { const repo = memoryRepository('ifto_monitor'); await repo.put('trips', trip()); for (let i = 1; i <= n; i++) await repo.put('gps_points', point(i)); return repo; };

beforeEach(() => { localStorage.clear(); window.location.hash = '#/'; });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

test('envio ao vivo: viagem sombra + pontos novos, sem duplicar nem reenviar o que já foi', async () => {
    const repo = await seed(3), { w, calls } = writer();
    expect(await syncLive(repo, w, () => true)).toBe(3);
    const live = liveTripId(trip().id);
    expect(calls.map(c => c.table)).toEqual(['trips', 'trip_points']);
    expect(calls[0].rows[0]).toMatchObject({ id: live, status: 'live', ended_at: null, bus_label: 'Ônibus 02', route_name: 'Serrano', extra: { live_of: trip().id } });
    expect(calls[1].rows.map(r => [r.trip_id, r.seq])).toEqual([[live, 1], [live, 2], [live, 3]]);
    expect(await syncLive(repo, w, () => true)).toBe(0); expect(calls).toHaveLength(2); // nada novo → nada enviado
    await repo.put('gps_points', point(4)); await repo.put('gps_points', point(5));
    expect(await syncLive(repo, w, () => true)).toBe(2);
    expect(calls.at(-1)!.rows.map(r => r.seq)).toEqual([4, 5]); expect(calls.filter(c => c.table === 'trips')).toHaveLength(1);
    expect(JSON.parse((await repo.get('app_meta', liveStateKey(trip().id)))!.value)).toEqual({ row: true, seq: 5 });
});
test('envio ao vivo: sem internet nada sai e tudo vai depois; falha no meio retoma sem duplicar; lotes pequenos', async () => {
    const repo = await seed(LIVE_BATCH * 2 + 30);
    let online = false, fail = false;
    const { w, calls } = writer(() => fail);
    expect(await syncLive(repo, w, () => online)).toBe(0); expect(calls).toHaveLength(0);
    online = true; expect(await syncLive(repo, w, () => online)).toBe(LIVE_BATCH * 2 + 30);
    expect(calls.filter(c => c.table === 'trip_points').map(c => c.rows.length)).toEqual([LIVE_BATCH, LIVE_BATCH, 30]);
    // muitos pontos acumulados: no máximo LIVE_MAX_BATCHES lotes por rodada (não trava a interface)
    const big = await seed(LIVE_BATCH * (LIVE_MAX_BATCHES + 2)), b = writer();
    expect(await syncLive(big, b.w, () => true)).toBe(LIVE_BATCH * LIVE_MAX_BATCHES);
    expect(await syncLive(big, b.w, () => true)).toBe(LIVE_BATCH * 2);
    const seqs = b.calls.filter(c => c.table === 'trip_points').flatMap(c => c.rows.map(r => r.seq as number));
    expect(new Set(seqs).size).toBe(seqs.length); expect(seqs).toHaveLength(LIVE_BATCH * (LIVE_MAX_BATCHES + 2));
    // falha de rede: a última seq enviada não avança e o retry reenvia só o que faltou
    const flaky = await seed(5); const f = writer(() => fail);
    await syncLive(flaky, f.w, () => true); await flaky.put('gps_points', point(6)); fail = true;
    await expect(syncLive(flaky, f.w, () => true)).rejects.toThrow();
    fail = false; expect(await syncLive(flaky, f.w, () => true)).toBe(1);
    expect(f.calls.at(-1)!.rows.map(r => r.seq)).toEqual([6]);
});
test('sem viagem em andamento ou em modo demonstração nada é enviado', async () => {
    const repo = memoryRepository('ifto_monitor'); await repo.put('trips', trip({ status: 'finished', ended_at: new Date(T0 + 60000).toISOString() })); const { w, calls } = writer();
    expect(await syncLive(repo, w, () => true)).toBe(0); expect(await syncLive(memoryRepository('ifto_monitor_demo'), w, () => true)).toBe(0); expect(await syncLive(repo, null, () => true)).toBe(0); expect(calls).toHaveLength(0);
});
test('timer: a cada ~15 s durante a viagem; para ao descartar o monitor', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const m = new Monitor(async name => memoryRepository(name), () => gps());
    const spy = vi.spyOn(m, 'syncLiveNow').mockResolvedValue(0);
    await m.enter('field', 'Maria', true);
    expect(LIVE_INTERVAL_MS).toBe(15000);
    vi.advanceTimersByTime(LIVE_INTERVAL_MS * 3); expect(spy).toHaveBeenCalledTimes(3);
    await m.dispose(); vi.advanceTimersByTime(LIVE_INTERVAL_MS * 3); expect(spy).toHaveBeenCalledTimes(3);
});
test('syncLiveNow só envia com viagem ativa, internet e nuvem ligada', async () => {
    const m = new Monitor(async name => memoryRepository(name), () => gps());
    await m.enter('field', 'Maria', true); expect(await m.syncLiveNow()).toBe(0); // sem viagem
    await m.dispose();
});
test('a viagem final leva o id da sombra em extra.live_id e a sombra nunca coincide com um id real', () => {
    const t = trip({ status: 'finished', ended_at: new Date(T0 + 60000).toISOString() });
    expect((cloudPayload(t, [], []).trips[0].extra as { live_id: string }).live_id).toBe(liveTripId(t.id));
    for (let i = 0; i < 50; i++) { const id = crypto.randomUUID(); expect(liveTripId(id)).not.toBe(id); expect(liveTripId(id)).toMatch(/^[0-9a-f-]{36}$/); expect(liveTripId(id)[14]).toBe('8'); expect(id[14]).toBe('4'); }
});

test('mapa ao vivo: viagens ativas (12 h, sem fim, não finalizadas de verdade)', () => {
    const now = T0 + 3600000, mk = (id: string, over: object = {}) => ({ id, bus_label: id, started_at: new Date(T0).toISOString(), ended_at: null, status: 'live', ...over });
    const list = [mk('Ônibus 03'), mk('Ônibus 01'), mk('velha', { started_at: new Date(now - 13 * 3600000).toISOString() }), mk('fim', { ended_at: new Date(now).toISOString() }), mk('real-finalizada')];
    expect(activeLiveTrips(list, new Set(['real-finalizada']), now).map(t => t.id)).toEqual(['Ônibus 01', 'Ônibus 03']);
});
test('última posição por viagem e rastro de 30 minutos', () => {
    const pts = [point(1, {}, 'a'), point(3, {}, 'a'), point(2, {}, 'a'), point(9, { accepted: false }, 'a'), point(5, {}, 'b')];
    expect(pickLastPoint(pts.filter(p => p.trip_id === 'a'))!.seq).toBe(3);
    const last = lastPointByTrip(pts); expect(last.get('a')!.seq).toBe(3); expect(last.get('b')!.seq).toBe(5); expect(last.size).toBe(2);
    expect(pickLastPoint([])).toBeNull();
    const old = point(1, { recorded_at: new Date(T0).toISOString() }), recent = point(2, { recorded_at: new Date(T0 + 40 * 60000).toISOString() });
    expect(trailSince([recent, old], T0 + 45 * 60000).map(p => p.seq)).toEqual([2]);
});
test('"sem sinal" após 2 min e cor da velocidade (verde < 80, amarelo 80–99, vermelho ≥ 100)', () => {
    const at = (kmh: number | null, ageMs: number, extra: Partial<GpsPoint> = {}) => [point(1, { speed_mps: kmh === null ? null : kmh / 3.6, recorded_at: new Date(T0 - ageMs).toISOString(), ...extra })];
    const color = (kmh: number) => liveState(at(kmh, 5000), T0)!;
    expect([79, 80, 99, 100].map(k => color(k).band)).toEqual(['ok', 'warn', 'warn', 'high']);
    expect(color(60)).toMatchObject({ stale: false, color: '#2e7d32', speedKmh: 60, text: 'atualizado há 5 s' }); expect(color(90).color).toBe('#f9a825'); expect(color(110).color).toBe('#c62828');
    expect(liveState(at(70, 90000), T0)!).toMatchObject({ stale: false, text: 'atualizado há 1 min' }); // 90 s ainda conta como sinal (≤ 2 min)
    const stale = liveState(at(70, STALE_MS + 1000), T0)!;
    expect(stale).toMatchObject({ stale: true, color: '#6b7280', speedKmh: null, band: 'none' }); expect(stale.text).toBe('sem sinal desde 08:57'); // 11:57:59Z = 08:57 em Fortaleza
    expect(liveState([], T0)).toBeNull();
});

test('limpezas: sem chip de modo, uma única mensagem de sincronização, sem "Tudo enviado"', async () => {
    const m = new Monitor(async name => memoryRepository(name), () => gps()); await m.enter('field', 'Maria', true);
    render(<App monitor={m}/>);
    await screen.findByRole('button', { name: 'Relatar problema' });
    expect(screen.queryByText('Modo campo local')).toBeNull(); expect(screen.queryByText(/Tudo enviado/)).toBeNull();
    expect(screen.getAllByRole('status').filter(s => /sincroniz|Nuvem|pendente/i.test(s.textContent || '')).length).toBeLessThanOrEqual(1);
    await m.dispose();
});
test('Viagem em andamento: velocímetro, Relatar problema e Finalizar viagem antes do mapa (sem rolar)', async () => {
    const provider = gps();
    const m = new Monitor(async name => memoryRepository(name), () => provider); await m.enter('field', 'Maria', true); await m.saveBusLabel('Ônibus 02');
    await m.start(m.snapshot.vehicles.find(v => v.label === 'Ônibus 02')!.id);
    provider.onFix({ latitude: -10, longitude: -48, accuracy: 5, speed: 20, timestamp: Date.now() }); await m.service!.flush();
    window.location.hash = '#/trip';
    const view = render(<App monitor={m}/>);
    const gauge = await screen.findByLabelText('Velocímetro');
    const report = screen.getByRole('button', { name: 'Relatar problema' }), finish = screen.getByRole('button', { name: 'Finalizar viagem' });
    expect(within(gauge).getByText('km/h')).toBeTruthy();
    const mapEl = view.container.querySelector('.map');
    expect(mapEl).toBeTruthy();
    const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(before(finish, gauge)).toBe(true); expect(before(gauge, report)).toBe(true); expect(before(report, mapEl!)).toBe(true);
    await m.finish(); await m.dispose();
});
