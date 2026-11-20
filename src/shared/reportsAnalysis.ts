// Análise dos relatos para o painel (#/painel): etiquetas, filtros, resumo e CSV.
import { checklistItems, checklistSections, isUrgent, labelOf, sectionOf, sortByUrgency, topUrgency, urgencyOf, type Urgency } from './reportChecklist';
import { parseStructuredLine, sentidoLabels, lotacaoLabels, quandoLabels, type Lotacao, type Quando, type Sentido } from './reportForm';
import { csvBr } from './csvBr';
import { localDateTimeFortaleza, localDayKey } from '../lib/time';

export interface ReportRow { id?: string; created_at: string; bus_label?: string | null; route_name?: string | null; category?: string | null; message?: string | null; photo_count?: number | null; status?: string | null }
export interface ReportRecord {
    row: ReportRow; structured: boolean; bus: string; route: string; sentido: Sentido; quando: Quando | ''; lotacao: Lotacao;
    problems: string[]; urgent: boolean; urgency: Urgency | null; comment: string; photos: number; at: string;
    userName: string; userEmail: string; trip: string; latitude: string; longitude: string;
}
export function toRecord(row: ReportRow): ReportRecord {
    const parsed = parseStructuredLine(row.message);
    const problems = parsed ? sortByUrgency(parsed.problems) : [];
    return {
        row, structured: !!parsed,
        bus: parsed?.bus && parsed.bus !== 'Não sei' ? parsed.bus : (row.bus_label || 'Não sei'),
        route: parsed?.route && parsed.route !== 'Não sei' ? parsed.route : (row.route_name || 'Não sei'),
        sentido: parsed?.sentido ?? '', quando: parsed?.quando ?? '', lotacao: parsed?.lotacao ?? '',
        problems, urgent: isUrgent(problems), urgency: topUrgency(problems),
        comment: parsed ? parsed.comment : String(row.message ?? ''), photos: Number(row.photo_count ?? 0), at: row.created_at,
        userName: parsed?.userName ?? '', userEmail: parsed?.user ?? '', trip: parsed?.trip ?? '', latitude: parsed?.loc.split(',')[0] ?? '', longitude: parsed?.loc.split(',')[1] ?? '',
    };
}
const urgencyRank = (r: ReportRecord) => r.urgent ? 2 : r.urgency === 'A' ? 1 : 0;
/** Urgentes no topo; dentro do mesmo nível, os mais recentes primeiro. */
export const sortRecords = (records: readonly ReportRecord[]) => [...records].sort((a, b) => urgencyRank(b) - urgencyRank(a) || b.at.localeCompare(a.at));

export interface ReportFilters { user?: string; bus?: string; route?: string; sentido?: string; section?: string; urgency?: string; from?: string; to?: string }
export function filterRecords(records: readonly ReportRecord[], f: ReportFilters): ReportRecord[] {
    return records.filter(r =>
        (!f.user || r.userEmail === f.user) && (!f.bus || r.bus === f.bus) && (!f.route || r.route === f.route) && (!f.sentido || r.sentido === f.sentido)
        && (!f.section || r.problems.some(id => sectionOf(id)?.id === f.section))
        && (!f.urgency || r.problems.some(id => urgencyOf(id) === f.urgency))
        && (!f.from || localDayKey(r.at) >= f.from) && (!f.to || localDayKey(r.at) <= f.to));
}

export interface Count { key: string; count: number }
const tally = (keys: Iterable<string>): Count[] => { const m = new Map<string, number>(); for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1); return [...m].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'pt-BR')); };
/** Segunda-feira (data local) da semana do relato, "AAAA-MM-DD". */
export function weekKey(iso: string): string {
    const day = new Date(localDayKey(iso) + 'T00:00:00Z'); const back = (day.getUTCDay() + 6) % 7; day.setUTCDate(day.getUTCDate() - back);
    return day.toISOString().slice(0, 10);
}
export interface Summary { total: number; structured: number; urgent: number; urgentPct: number; byProblem: Count[]; byBus: Count[]; byRoute: Count[]; byWeek: Count[]; topByBus: { bus: string; top: Count[] }[] }
export function summarize(records: readonly ReportRecord[]): Summary {
    const total = records.length, urgent = records.filter(r => r.urgent).length;
    const buses = [...new Set(records.map(r => r.bus))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return {
        total, structured: records.filter(r => r.structured).length, urgent, urgentPct: total ? Math.round(urgent / total * 1000) / 10 : 0,
        byProblem: tally(records.flatMap(r => r.problems)), byBus: tally(records.map(r => r.bus)), byRoute: tally(records.map(r => r.route)),
        byWeek: tally(records.map(r => weekKey(r.at))).sort((a, b) => a.key.localeCompare(b.key)),
        topByBus: buses.map(bus => ({ bus, top: tally(records.filter(r => r.bus === bus).flatMap(r => r.problems)).slice(0, 5) })),
    };
}

export const reportCsvColumns = ['data_local', 'onibus', 'rota', 'sentido', 'quando', 'lotacao', 'urgente', 'n_problemas', ...checklistItems.map(i => i.id), 'problemas', 'comentario', 'n_fotos', 'usuario_nome', 'usuario_email', 'trip_id_curto', 'latitude', 'longitude'] as const;
export function reportsCsv(records: readonly ReportRecord[]): string {
    return csvBr(reportCsvColumns, records.map(r => [
        localDateTimeFortaleza(r.at), r.bus, r.route, r.sentido, r.quando, r.lotacao, r.urgent ? 1 : 0, r.problems.length,
        ...checklistItems.map(i => r.problems.includes(i.id) ? 1 : 0),
        r.problems.map(labelOf).join('; '), r.comment, r.photos, r.userName, r.userEmail, r.trip, r.latitude.replace('.', ','), r.longitude.replace('.', ','),
    ]));
}
export const reportsCsvName = (period: string) => `ifto-monitor_relatos_${period || 'tudo'}.csv`;
export { sentidoLabels, lotacaoLabels, quandoLabels, checklistSections };
