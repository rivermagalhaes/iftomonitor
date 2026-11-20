import { test, expect } from 'vitest';
import { displaySpeed, findEpisodes, mpsToKmh, speedBand, speedEpisodeColumns, speedEpisodesCsv, speedSummaryColumns, speedSummaryCsv, toSamples, tripSpeedStats, type SpeedPoint } from '../src/lib/speed';

const T0 = Date.parse('2026-11-20T10:00:00Z');
// ~1 grau de latitude = 111 km: desloca 'm' metros ao norte.
const pt = (sec: number, kmh: number | null, over: Partial<SpeedPoint> = {}, northM = 0): SpeedPoint => ({ recorded_at: new Date(T0 + sec * 1000).toISOString(), latitude: -10 + northM / 111195, longitude: -48, accuracy_m: 5, speed_mps: kmh === null ? null : kmh / 3.6, seq: sec, accepted: true, ...over });
const series = (kmhs: number[], step = 10) => kmhs.map((k, i) => pt(i * step, k));

test('conversão m/s → km/h', () => { expect(mpsToKmh(10)).toBe(36); expect(mpsToKmh(27.78)).toBeCloseTo(100.008, 2); });
test('velocímetro: média curta, 0 parado, "—" com precisão ruim ou sem dados', () => {
    const now = T0 + 25000;
    expect(displaySpeed(series([50, 60, 70]), now)).toBe(60);
    expect(displaySpeed(series([50, 60, 70, 80]), T0 + 35000)).toBe(70); // só os 3 últimos
    expect(displaySpeed(series([1, 2, 2]), now)).toBe(0);
    expect(displaySpeed([pt(0, 80, { accuracy_m: 25 })], T0 + 1000)).toBeNull();
    expect(displaySpeed([], now)).toBeNull();
    expect(displaySpeed(series([60, 60]), T0 + 120000)).toBeNull(); // ponto velho
    expect(displaySpeed([pt(0, null)], T0 + 1000)).toBeNull(); // sem velocidade e sem ponto anterior
});
test('faixas de cor: verde < 80, amarelo ≥ 80, vermelho ≥ 100', () => {
    expect([null, 79, 80, 99, 100].map(v => speedBand(v))).toEqual(['none', 'ok', 'warn', 'warn', 'high']);
});
test('episódio: ≥2 pontos sustentados por ≥10 s; ponto isolado é ignorado', () => {
    expect(findEpisodes(toSamples(series([60, 110, 60, 110, 60, 105, 108, 60])), 100)).toHaveLength(1);
    const ep = findEpisodes(toSamples(series([60, 105, 112, 108, 60])), 100)[0];
    expect(ep).toMatchObject({ limit: 100, durationS: 20, vmax: 112 });
    expect(ep.vavg).toBeCloseTo(108.3, 1);
    expect(findEpisodes(toSamples([pt(0, 105), pt(5, 106)]), 100)).toHaveLength(0); // só 5 s
    expect(findEpisodes(toSamples([pt(0, 105), pt(10, 106, { accuracy_m: 30 }), pt(20, 107)]), 100)).toHaveLength(0); // precisão ruim quebra a sequência
});
test('sem speed_mps: estima por distância/tempo entre pontos consecutivos', () => {
    // 300 m em 10 s = 30 m/s = 108 km/h
    const points = [pt(0, null, {}, 0), pt(10, null, {}, 300), pt(20, null, {}, 600), pt(30, null, {}, 900)];
    const samples = toSamples(points);
    expect(samples.slice(1).every(s => s.estimated && Math.abs(s.kmh - 108) < 1)).toBe(true);
    expect(tripSpeedStats(points).episodes100).toHaveLength(1);
});
test('descarta salto de GPS e velocidade > 160 km/h', () => {
    const stats = tripSpeedStats(series([60, 60, 60, 150, 60, 60]));
    expect(stats.vmax).toBe(60); expect(stats.episodes100).toHaveLength(0);
    expect(tripSpeedStats(series([100, 120, 200, 120, 110])).vmax).toBe(120);
    const jump = toSamples([pt(0, null, {}, 0), pt(10, null, {}, 100), pt(20, null, {}, 80000), pt(30, null, {}, 300)]);
    expect(jump[2].good).toBe(false);
});
test('resumo da viagem: máxima, média em movimento e minutos acima dos limites', () => {
    const s = tripSpeedStats(series([0, 40, 85, 85, 105, 105, 105, 40]));
    expect(s.vmax).toBe(105);
    expect(s.vavg).toBeCloseTo((40 + 85 + 85 + 105 * 3 + 40) / 7, 1);
    expect(s.minAbove80).toBe(0.7); // 4 intervalos de 10 s
    expect(s.minAbove100).toBe(0.3);
    expect(s.episodes80).toHaveLength(1); expect(s.episodes100).toHaveLength(1);
});
test('CSV de velocidade: colunas, BOM, ; e uma linha por episódio e limite', () => {
    const trip = { id: 't1', bus_label: 'Ônibus 02', route_name: 'Serrano', started_at: new Date(T0).toISOString(), app_version: '2.2.0' };
    const csv = speedEpisodesCsv([{ trip, points: series([60, 105, 112, 108, 60]) }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[0].split(';')).toEqual([...speedEpisodeColumns]);
    expect(speedEpisodeColumns).toEqual(['trip_id', 'onibus', 'rota', 'data_local', 'inicio_local', 'fim_local', 'duracao_s', 'vmax_kmh', 'vmedia_kmh', 'limite_kmh_usado', 'latitude', 'longitude', 'app_version']);
    expect(lines).toHaveLength(3); // ≥80 e ≥100
    expect(lines[1].split(';').slice(0, 4)).toEqual(['t1', 'Ônibus 02', 'Serrano', '2026-11-20']);
    expect(lines.slice(1).map(l => l.split(';')[9])).toEqual(['80', '100']);
    const summary = speedSummaryCsv([{ trip, points: series([60, 105, 112, 108, 60]) }]).slice(1).trim().split('\r\n');
    expect(summary[0].split(';')).toEqual([...speedSummaryColumns]);
    expect(summary[1].split(';').slice(0, 5)).toEqual(['t1', 'Ônibus 02', 'Serrano', '2026-11-20', '112']);
});
