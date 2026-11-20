import { parseHM } from '../lib/time';

export interface TimeWindow { start: string; end: string }
export interface ReferenceConfig {
    campus: { lat: number; lng: number; radiusM: number };
    morningArrivalDeadline: string;
    eveningDeparture: string;
    eveningArrivalDeadline: string;
    toleranceMin: number;
    earlyMarginMin: number;
    morningWindow: TimeWindow;
    eveningWindow: TimeWindow;
    minTripsForObservedTable: number;
    stopClusterRadiusM: number;
    lowConfidenceGapS: number;
}

/** Padrões: campus IFTO Paraíso do Tocantins (derivado de duas viagens reais). */
export const defaultReference: ReferenceConfig = {
    campus: { lat: -10.2006, lng: -48.90172, radiusM: 150 },
    morningArrivalDeadline: '08:00',
    eveningDeparture: '17:00',
    eveningArrivalDeadline: '19:00',
    toleranceMin: 5,
    earlyMarginMin: 10,
    morningWindow: { start: '04:00', end: '11:59' },
    eveningWindow: { start: '12:00', end: '20:59' },
    minTripsForObservedTable: 2,
    stopClusterRadiusM: 50,
    lowConfidenceGapS: 120
};

export const cloneReference = (value: ReferenceConfig = defaultReference): ReferenceConfig => ({ ...value, campus: { ...value.campus }, morningWindow: { ...value.morningWindow }, eveningWindow: { ...value.eveningWindow } });
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Valida uma configuração completa; devolve a lista de erros em português (vazia = válida). */
export function validateReference(c: ReferenceConfig): string[] {
    const errors: string[] = [];
    if (!isNum(c.campus.lat) || c.campus.lat < -90 || c.campus.lat > 90) errors.push('Latitude deve estar entre -90 e 90.');
    if (!isNum(c.campus.lng) || c.campus.lng < -180 || c.campus.lng > 180) errors.push('Longitude deve estar entre -180 e 180.');
    if (!isNum(c.campus.radiusM) || c.campus.radiusM < 30 || c.campus.radiusM > 500) errors.push('O raio deve estar entre 30 e 500 m.');
    const times: [string, string][] = [['Chegada da manhã', c.morningArrivalDeadline], ['Saída da tarde', c.eveningDeparture], ['Retorno da noite', c.eveningArrivalDeadline], ['Início da janela da manhã', c.morningWindow.start], ['Fim da janela da manhã', c.morningWindow.end], ['Início da janela da tarde', c.eveningWindow.start], ['Fim da janela da tarde', c.eveningWindow.end]];
    for (const [label, value] of times) if (typeof value !== 'string' || parseHM(value) === null) errors.push(`${label}: use o formato HH:MM.`);
    if (!isNum(c.toleranceMin) || c.toleranceMin < 0 || c.toleranceMin > 60) errors.push('Tolerância de saída deve estar entre 0 e 60 min.');
    if (!isNum(c.earlyMarginMin) || c.earlyMarginMin < 0 || c.earlyMarginMin > 120) errors.push('Margem de adiantamento deve estar entre 0 e 120 min.');
    if (!isNum(c.minTripsForObservedTable) || c.minTripsForObservedTable < 1) errors.push('Mínimo de viagens da tabela observada deve ser 1 ou mais.');
    if (!isNum(c.stopClusterRadiusM) || c.stopClusterRadiusM < 5 || c.stopClusterRadiusM > 500) errors.push('Raio de agrupamento de paradas deve estar entre 5 e 500 m.');
    if (!isNum(c.lowConfidenceGapS) || c.lowConfidenceGapS < 10) errors.push('Lacuna de baixa confiança deve ser de pelo menos 10 s.');
    return errors;
}

/** Mescla um valor parcial/desconhecido (ex.: JSON salvo) sobre os padrões; resultado inválido volta aos padrões. */
export function mergeReference(raw: unknown): ReferenceConfig {
    const base = cloneReference();
    if (!raw || typeof raw !== 'object') return base;
    const r = raw as Record<string, unknown>;
    const obj = (v: unknown) => (v && typeof v === 'object' ? v as Record<string, unknown> : {});
    const num = (v: unknown, d: number) => (isNum(v) ? v : d);
    const hm = (v: unknown, d: string) => (typeof v === 'string' && parseHM(v) !== null ? v : d);
    const campus = obj(r.campus), mw = obj(r.morningWindow), ew = obj(r.eveningWindow);
    const merged: ReferenceConfig = {
        campus: { lat: num(campus.lat, base.campus.lat), lng: num(campus.lng, base.campus.lng), radiusM: num(campus.radiusM, base.campus.radiusM) },
        morningArrivalDeadline: hm(r.morningArrivalDeadline, base.morningArrivalDeadline),
        eveningDeparture: hm(r.eveningDeparture, base.eveningDeparture),
        eveningArrivalDeadline: hm(r.eveningArrivalDeadline, base.eveningArrivalDeadline),
        toleranceMin: num(r.toleranceMin, base.toleranceMin),
        earlyMarginMin: num(r.earlyMarginMin, base.earlyMarginMin),
        morningWindow: { start: hm(mw.start, base.morningWindow.start), end: hm(mw.end, base.morningWindow.end) },
        eveningWindow: { start: hm(ew.start, base.eveningWindow.start), end: hm(ew.end, base.eveningWindow.end) },
        minTripsForObservedTable: num(r.minTripsForObservedTable, base.minTripsForObservedTable),
        stopClusterRadiusM: num(r.stopClusterRadiusM, base.stopClusterRadiusM),
        lowConfidenceGapS: num(r.lowConfidenceGapS, base.lowConfidenceGapS)
    };
    return validateReference(merged).length ? base : merged;
}

/** Override opcional do painel web por VITE_CAMPUS_LAT / VITE_CAMPUS_LNG / VITE_CAMPUS_RADIUS_M. */
export function referenceFromEnv(env: Record<string, unknown>): ReferenceConfig {
    const read = (key: string) => { const raw = env[key]; if (raw === undefined || raw === null || String(raw).trim() === '') return null; const n = Number(raw); return Number.isFinite(n) ? n : null; };
    const candidate = cloneReference();
    const lat = read('VITE_CAMPUS_LAT'), lng = read('VITE_CAMPUS_LNG'), radius = read('VITE_CAMPUS_RADIUS_M');
    if (lat !== null) candidate.campus.lat = lat;
    if (lng !== null) candidate.campus.lng = lng;
    if (radius !== null) candidate.campus.radiusM = radius;
    return validateReference(candidate).length ? cloneReference() : candidate;
}

/** Velocidade (km/h) — referências do projeto, NÃO o limite legal (que depende da sinalização de cada trecho). Ver docs/VELOCIDADE.md. */
export const SPEED_WARN_KMH = 80;
export const SPEED_HIGH_KMH = 100;
/** Pontos com precisão pior que isso não entram no velocímetro nem nos episódios. */
export const SPEED_MAX_ACCURACY_M = 20;
/** Episódio: no mínimo 2 pontos consecutivos e esta duração (s) acima do limite. */
export const SPEED_EPISODE_MIN_S = 10;
