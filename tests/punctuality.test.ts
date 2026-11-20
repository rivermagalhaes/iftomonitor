import { describe, expect, test } from 'vitest';
import { defaultReference, mergeReference, referenceFromEnv, validateReference, cloneReference } from '../src/config/reference';
import { aggregatePunctuality, computeTripPunctuality, inferShift, median, type PunctPoint, type PunctStop, type PunctTrip } from '../src/lib/punctuality';
import { observedTimetable } from '../src/lib/observedTimetable';
import { analyze, describeTrip, observedCsv, punctualityCsv, periodStartMs } from '../src/lib/punctualityReport';
import { localDayKey, localHM, localMinutesOfDay, parseHM } from '../src/lib/time';
import { csvText } from '../src/lib/csv';
import { initialize } from '../src/data/repository';
import { memoryRepository } from './support';

const cfg = defaultReference;
const DAY = '2026-11-16';
const OUT = cfg.campus.lat + 0.01; // ~1,1 km ao norte do campus
/** "HH:MM" local (UTC-3) do DAY para ISO em UTC. */
const utc = (hm: string, day = DAY) => new Date(Date.parse(`${day}T${hm}:00Z`) + 3 * 3600000).toISOString();
/** Pontos a cada 10 s entre dois horários locais (fim exclusivo). */
function phase(from: string, to: string, inside: boolean, day = DAY): PunctPoint[] {
    const out: PunctPoint[] = [];
    for (let t = Date.parse(utc(from, day)); t < Date.parse(utc(to, day)); t += 10000) out.push({ recorded_at: new Date(t).toISOString(), latitude: inside ? cfg.campus.lat : OUT, longitude: cfg.campus.lng, accepted: true });
    return out;
}
const trip = (over: Partial<PunctTrip> = {}): PunctTrip => ({ id: 't1', bus_label: 'Ônibus 1', route_id: 'r1', route_name: 'Jardim Paulista', started_at: utc('07:00'), ended_at: utc('08:30'), status: 'finished', ...over });
const compute = (t: PunctTrip, points: PunctPoint[], stops: PunctStop[] = []) => computeTripPunctuality(t, points, stops, cfg);
const ev = (r: ReturnType<typeof compute>, kind: string) => r.events.find(e => e.kind === kind)!;

describe('manhã', () => {
    test('chegada 07:43 → folga 17, adiantado', () => {
        const r = compute(trip(), [...phase('07:00', '07:43', false), ...phase('07:43', '08:10', true)]);
        expect(r.shift).toBe('manha');
        expect(ev(r, 'chegada')).toMatchObject({ status: 'adiantado', deltaMin: 17, target: '08:00' });
        expect(localHM(ev(r, 'chegada').at!)).toBe('07:43');
        expect(describeTrip(r)).toBe('Chegou 07:43 (17 min antes das 08:00)');
    });
    test('07:55 → no_limite; 08:04 → atrasado', () => {
        expect(ev(compute(trip(), [...phase('07:00', '07:55', false), ...phase('07:55', '08:10', true)]), 'chegada')).toMatchObject({ status: 'no_limite', deltaMin: 5 });
        const late = compute(trip(), [...phase('07:00', '08:04', false), ...phase('08:04', '08:20', true)]);
        expect(ev(late, 'chegada')).toMatchObject({ status: 'atrasado', deltaMin: -4 });
        expect(describeTrip(late)).toBe('Chegou 08:04 (4 min após as 08:00)');
    });
    test('nunca chega → nao_chegou; nunca sai de dentro → sem_deslocamento', () => {
        const never = compute(trip(), phase('07:00', '08:30', false));
        expect(ev(never, 'chegada').status).toBe('nao_chegou'); expect(never.excluded).toBe('sem_evento');
        expect(ev(compute(trip(), phase('07:00', '08:30', true)), 'chegada').status).toBe('sem_deslocamento');
    });
    test('só conta chegada depois de ter estado fora e ignora pontos não aceitos', () => {
        const bad = phase('07:00', '07:30', false).map(p => ({ ...p, latitude: cfg.campus.lat, accepted: false }));
        const r = compute(trip(), [...bad, ...phase('07:00', '07:50', false), ...phase('07:50', '08:05', true)]);
        expect(ev(r, 'chegada')).toMatchObject({ status: 'no_limite', deltaMin: 10 });
    });
});

describe('tarde/noite', () => {
    const base = { started_at: utc('16:50'), ended_at: utc('19:10') };
    test('sai 17:00 e volta 18:48 → pontual + adiantado (folga de exatamente 10 min é no_limite)', () => {
        const r = compute(trip(base), [...phase('16:50', '17:00', true), ...phase('17:00', '18:48', false), ...phase('18:48', '19:10', true)]);
        expect(r.shift).toBe('noite');
        expect(ev(r, 'saida')).toMatchObject({ status: 'pontual' });
        expect(ev(r, 'retorno')).toMatchObject({ status: 'adiantado', deltaMin: 12 });
        const edge = compute(trip(base), [...phase('16:50', '17:00', true), ...phase('17:00', '18:50', false), ...phase('18:50', '19:10', true)]);
        expect(ev(edge, 'retorno')).toMatchObject({ status: 'no_limite', deltaMin: 10 });
    });
    test('saída 17:12 atrasada; 16:50 antecipada', () => {
        const late = compute(trip({ started_at: utc('16:58') }), [...phase('16:58', '17:12', true), ...phase('17:12', '18:50', false), ...phase('18:50', '19:00', true)]);
        expect(ev(late, 'saida').status).toBe('atrasada'); expect(ev(late, 'saida').deltaMin).toBe(12);
        const early = compute(trip({ started_at: utc('16:40') }), [...phase('16:40', '16:50', true), ...phase('16:50', '18:50', false), ...phase('18:50', '19:00', true)]);
        expect(ev(early, 'saida').status).toBe('antecipada'); expect(ev(early, 'saida').deltaMin).toBe(-10);
        expect(describeTrip(late)).toContain('Saiu 17:11 (11 min após as 17:00)'.replace('17:11', localHM(ev(late, 'saida').at!)).replace('11 min', '12 min'));
    });
    test('retorno 19:06 → atrasado', () => {
        const r = compute(trip(base), [...phase('16:50', '17:00', true), ...phase('17:00', '19:06', false), ...phase('19:06', '19:20', true)]);
        expect(ev(r, 'retorno')).toMatchObject({ status: 'atrasado', deltaMin: -6 });
    });
    test('vários cruzamentos → retorno é a ÚLTIMA entrada', () => {
        const r = compute(trip(base), [...phase('16:50', '17:00', true), ...phase('17:00', '17:40', false), ...phase('17:40', '17:50', true), ...phase('17:50', '18:30', false), ...phase('18:30', '19:00', true)]);
        expect(localHM(ev(r, 'retorno').at!)).toBe('18:30');
    });
    test('não volta → nao_retornou; começa fora → sem_saida_do_campus', () => {
        const r = compute(trip(base), [...phase('16:50', '17:00', true), ...phase('17:00', '19:10', false)]);
        expect(ev(r, 'retorno').status).toBe('nao_retornou'); expect(ev(r, 'saida').status).toBe('pontual'); expect(r.excluded).toBeNull();
        const out = compute(trip(base), [...phase('16:50', '18:00', false), ...phase('18:00', '19:00', true)]);
        expect(ev(out, 'saida').status).toBe('sem_saida_do_campus');
        expect(ev(out, 'retorno').status).toBe('adiantado');
    });
});

describe('turno e fuso', () => {
    const at = (hm: string) => inferShift(utc(hm), cfg);
    test('janelas', () => {
        expect(at('05:30')).toBe('manha'); expect(at('11:59')).toBe('manha'); expect(at('12:00')).toBe('noite');
        expect(at('16:58')).toBe('noite'); expect(at('20:59')).toBe('noite'); expect(at('21:00')).toBe('fora_de_turno'); expect(at('22:28')).toBe('fora_de_turno'); expect(at('03:59')).toBe('fora_de_turno');
    });
    test('UTC−3 inclusive virada de dia', () => {
        const iso = '2026-11-17T02:50:00Z';
        expect(localHM(iso)).toBe('23:50'); expect(localDayKey(iso)).toBe('2026-11-16'); expect(localMinutesOfDay(iso)).toBe(23 * 60 + 50);
        expect(inferShift(iso, cfg)).toBe('fora_de_turno');
        expect(localHM('2026-11-16T10:43:00Z')).toBe('07:43');
        expect(parseHM('24:00')).toBeNull(); expect(parseHM('7:5')).toBeNull(); expect(parseHM('08:00')).toBe(480);
    });
    test('override muda o turno; ignorar exclui do agregado', () => {
        const pts = [...phase('22:00', '22:30', false), ...phase('22:30', '23:00', true)];
        const t = trip({ started_at: utc('22:00'), ended_at: utc('23:00') });
        expect(compute(t, pts).excluded).toBe('fora_de_turno');
        expect(compute({ ...t, shift_override: 'noite' }, pts).shift).toBe('noite');
        const morning = [...phase('07:00', '07:43', false), ...phase('07:43', '08:10', true)];
        const ig = compute(trip({ shift_override: 'ignorar' }), morning);
        expect(ig.excluded).toBe('ignorada'); expect(ig.events).toEqual([]);
        const agg = aggregatePunctuality([trip({ shift_override: 'ignorar' })], [ig]);
        expect(agg.groups).toEqual([]); expect(agg.excluded).toEqual([{ tripId: 't1', reason: 'ignorada' }]);
        expect(compute(trip({ shift_override: 'noite' }), morning).shift).toBe('noite');
    });
    test('viagem antiga (sem campo de override) continua calculando', async () => {
        const repo = memoryRepository('ifto_monitor');
        await repo.put('trips', { id: 'old', vehicle_id: 'v', vehicle_label_snapshot: 'Onibus', owner_user_id: null, operator_label: 'A', status: 'finished', started_at: utc('07:00'), ended_at: utc('08:30'), ended_reason: 'user', device_id: 'd', created_at: '', updated_at: '', synced_at: null, sync_status: 'pending', sync_attempts: 0, last_error: null });
        await initialize(repo, 'field');
        const old = (await repo.get('trips', 'old'))!;
        expect(old.shift_override).toBeUndefined();
        const r = compute({ ...old, route_name: 'X' }, [...phase('07:00', '07:43', false), ...phase('07:43', '08:10', true)]);
        expect(ev(r, 'chegada').status).toBe('adiantado');
    });
});

describe('confiança e métricas', () => {
    test('lacuna > 120 s junto ao evento → baixa (e fora do pior caso)', () => {
        const gap = [...phase('07:00', '07:30', false), ...phase('07:36', '08:10', true)];
        const r = compute(trip(), gap);
        expect(ev(r, 'chegada').confidence).toBe('baixa'); expect(r.confidence).toBe('baixa');
        const good = compute(trip({ id: 't2' }), [...phase('07:00', '07:50', false), ...phase('07:50', '08:10', true)]);
        expect(good.confidence).toBe('alta');
        const agg = aggregatePunctuality([trip(), trip({ id: 't2' })], [r, good]);
        expect(agg.groups[0].worstFolga).toBe(10); expect(agg.groups[0].trips).toBe(2);
    });
    test('duração, distância, paradas e tempo parado (sem descartadas)', () => {
        const stops: PunctStop[] = [{ arrived_at: utc('07:10'), duration_s: 60, latitude: OUT, longitude: cfg.campus.lng, status: 'confirmada', label: 'A' }, { arrived_at: utc('07:20'), duration_s: 120, latitude: OUT, longitude: cfg.campus.lng, status: 'candidata', label: 'B' }, { arrived_at: utc('07:30'), duration_s: 600, latitude: OUT, longitude: cfg.campus.lng, status: 'descartada', label: 'C' }];
        const r = compute(trip(), [...phase('07:00', '07:50', false), ...phase('07:50', '08:10', true)], stops);
        expect(r.metrics.durationMin).toBe(90); expect(r.metrics.stopsCount).toBe(2); expect(r.metrics.stoppedMin).toBe(3);
        expect(r.metrics.distanceKm).toBeCloseTo(1.11, 1);
    });
});

describe('agregado', () => {
    const arrive = (id: string, hm: string, over: Partial<PunctTrip> = {}) => { const t = trip({ id, ...over }); return { t, r: compute(t, [...phase('07:00', hm, false), ...phase(hm, '08:20', true)]) }; };
    test('exclui sem rota/fora de turno/ignorada; % e medianas (ímpar e par)', () => {
        const a = arrive('a', '07:43'), b = arrive('b', '07:55'), c = arrive('c', '08:04');
        const noRoute = arrive('n', '07:43', { route_id: null, route_name: '' });
        const off = (() => { const t = trip({ id: 'o', started_at: utc('22:00'), ended_at: utc('23:00') }); return { t, r: compute(t, [...phase('22:00', '22:30', false), ...phase('22:30', '23:00', true)]) }; })();
        const ig = arrive('i', '07:43', { shift_override: 'ignorar' });
        const all = [a, b, c, noRoute, off, ig];
        const agg = aggregatePunctuality(all.map(x => x.t), all.map(x => x.r));
        expect(agg.groups).toHaveLength(1);
        expect(agg.groups[0]).toMatchObject({ trips: 3, onTimePct: 67, medianFolga: 5, worstFolga: -4, bestFolga: 17 });
        expect(agg.excluded.map(e => [e.tripId, e.reason]).sort()).toEqual([['i', 'ignorada'], ['n', 'sem_rota'], ['o', 'fora_de_turno']]);
        const even = [a, c]; // folgas 17 e -4 → mediana 6,5
        expect(aggregatePunctuality(even.map(x => x.t), even.map(x => x.r)).groups[0].medianFolga).toBe(6.5);
        expect(median([])).toBeNull(); expect(median([3, 1, 2])).toBe(2); expect(median([1, 2, 3, 4])).toBe(2.5);
    });
    test('analyze filtra por período e gera CSVs', () => {
        const a = arrive('a', '07:43');
        const nowMs = Date.parse(utc('12:00'));
        const bundles = [{ trip: a.t, points: [...phase('07:00', '07:43', false), ...phase('07:43', '08:20', true)], stops: [] }];
        const res = analyze(bundles, cfg, { period: '7d', routeKey: 'todas', shift: 'todos', nowMs });
        expect(res.aggregate.groups).toHaveLength(1);
        expect(analyze(bundles, cfg, { period: '7d', routeKey: 'todas', shift: 'todos', nowMs: nowMs + 20 * 86400000 }).aggregate.groups).toHaveLength(0);
        expect(analyze(bundles, cfg, { period: 'all', routeKey: 'outra', shift: 'todos', nowMs }).trips).toHaveLength(0);
        expect(periodStartMs('7d', nowMs)).toBe(Date.parse(utc('00:00', '2026-11-10')));
        const lines = punctualityCsv(res.trips, res.results, '2.1.0').replace('﻿', '').trim().split('\r\n');
        expect(lines[0]).toBe('trip_id,bus_label,route,shift,start_local,event,event_time_local,target_time,delta_min,status,confidence,duration_min,distance_km,stops_count,stopped_min,app_version');
        expect(lines[1]).toContain('a,Ônibus 1,Jardim Paulista,manha,2026-11-16 07:00:00,chegada,2026-11-16 07:43:00,08:00,17,adiantado,alta,90.0');
        expect(lines[1].endsWith(',2.1.0')).toBe(true);
    });
    test('csv protege contra fórmulas e mantém números negativos', () => {
        expect(csvText(['a', 'b'], [['=1+1', -5], ['x,"y"', null]])).toBe('﻿a,b\r\n\'=1+1,-5\r\n"x,""y""",\r\n');
    });
});

describe('tabela observada', () => {
    const lat = (dMeters: number) => OUT + dMeters / 111320;
    const stop = (hm: string, dMeters: number, label: string, over: Partial<PunctStop> = {}): PunctStop => ({ arrived_at: utc(hm), duration_s: 30, latitude: lat(dMeters), longitude: cfg.campus.lng, status: 'confirmada', label, ...over });
    test('clusters por proximidade, nomes diferentes juntos, genéricos ignorados, n≥2, ordenação, descartadas', () => {
        const rows = observedTimetable([
            { tripId: 'a', stops: [stop('07:30', 0, 'Praça'), stop('07:10', 200, 'Escola'), stop('07:50', 1000, 'Único')] },
            { tripId: 'b', stops: [stop('07:34', 30, 'Praça Central'), stop('07:14', 200, 'Parada manual'), stop('07:40', 400, 'Descartado', { status: 'descartada' })] },
            { tripId: 'c', stops: [stop('07:32', 10, 'Praça'), stop('07:16', 200, 'Parada detectada'), stop('07:41', 400, 'Descartado', { status: 'descartada' })] }
        ], cfg);
        expect(rows.map(r => [r.order, r.label, r.tripsCount])).toEqual([[1, 'Escola', 3], [2, 'Praça', 3]]);
        expect(rows[1].medianMin).toBe(7 * 60 + 32); expect(rows[1].earliestMin).toBe(7 * 60 + 30); expect(rows[1].latestMin).toBe(7 * 60 + 34);
        expect(rows[0].label).toBe('Escola');
    });
    test('> 50 m separa, ≤ 50 m junta', () => {
        const mk = (d: number) => observedTimetable([{ tripId: 'a', stops: [stop('07:30', 0, 'A')] }, { tripId: 'b', stops: [stop('07:31', d, 'B')] }], cfg);
        expect(mk(40)).toHaveLength(1); expect(mk(40)[0].tripsCount).toBe(2);
        expect(mk(80)).toHaveLength(0); // dois clusters com 1 viagem cada
    });
    test('mesma viagem duas vezes no cluster conta uma viagem; csv', () => {
        const rows = observedTimetable([{ tripId: 'a', stops: [stop('07:30', 0, 'A'), stop('07:45', 5, 'A')] }, { tripId: 'b', stops: [stop('07:31', 0, 'A')] }], cfg);
        expect(rows[0].tripsCount).toBe(2);
        const csv = observedCsv('Jardim', 'manha', rows).replace('﻿', '').trim().split('\r\n');
        expect(csv[0]).toBe('route,shift,order,label,latitude,longitude,trips_count,median_time_local,earliest_time_local,latest_time_local,median_stop_duration_s');
        expect(csv[1]).toMatch(/^Jardim,manha,1,A,-?\d+\.\d{6},-48\.901720,2,07:31,07:30,07:31,30$/);
    });
});

describe('configuração', () => {
    test('validação', () => {
        expect(validateReference(cloneReference())).toEqual([]);
        const bad = cloneReference(); bad.campus.lat = 91; bad.campus.lng = -181; bad.campus.radiusM = 20; bad.eveningDeparture = '25:00'; bad.morningWindow.start = '4h';
        expect(validateReference(bad)).toHaveLength(5);
        const r = cloneReference(); r.campus.radiusM = 501; expect(validateReference(r)).toHaveLength(1);
        r.campus.radiusM = 30; expect(validateReference(r)).toEqual([]); r.campus.lat = NaN; expect(validateReference(r)).toHaveLength(1);
    });
    test('mesclar, restaurar padrões e override por ambiente', () => {
        expect(mergeReference(undefined)).toEqual(defaultReference);
        expect(mergeReference({ campus: { lat: -10.3, lng: -48.9, radiusM: 200 }, toleranceMin: 3 })).toMatchObject({ campus: { lat: -10.3, lng: -48.9, radiusM: 200 }, toleranceMin: 3, eveningDeparture: '17:00' });
        expect(mergeReference({ campus: { lat: 200, lng: 0, radiusM: 10 } })).toEqual(defaultReference);
        expect(referenceFromEnv({ VITE_CAMPUS_LAT: '-10.5', VITE_CAMPUS_RADIUS_M: '100' }).campus).toEqual({ lat: -10.5, lng: -48.90172, radiusM: 100 });
        expect(referenceFromEnv({ VITE_CAMPUS_RADIUS_M: '9999' })).toEqual(defaultReference);
        expect(referenceFromEnv({})).toEqual(defaultReference);
    });
});
