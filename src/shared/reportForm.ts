// Lógica pura do formulário rápido de relatos (compartilhada por app e web) e da linha estruturada.
import { CHECKLIST_VERSION, canonicalProblems, categoryFor } from './reportChecklist';

export const MAX_TEXT = 500;
/** Parte do texto reservada para a linha estruturada; o resto é do comentário do aluno. */
export const MAX_LINE = 400;
export const NAO_SEI = 'Não sei';
export type Sentido = '' | 'ida' | 'volta';
export type Quando = 'agora' | 'manha' | 'noite' | 'outro_dia';
export type Lotacao = '' | 'poucos' | 'metade' | 'cheio' | 'superlotado';
export const sentidoLabels: Record<Exclude<Sentido, ''>, string> = { ida: 'Indo para o IFTO', volta: 'Voltando do IFTO' };
export const quandoLabels: Record<Quando, string> = { agora: 'Agora', manha: 'Hoje de manhã', noite: 'Hoje à noite', outro_dia: 'Outro dia' };
export const lotacaoLabels: Record<Exclude<Lotacao, ''>, string> = { poucos: 'Poucos', metade: 'Metade', cheio: 'Cheio', superlotado: 'Superlotado' };

export interface ReportForm { bus: string; route: string; sentido: Sentido; quando: Quando; lotacao: Lotacao; problems: string[]; comment: string }
export const emptyForm = (now = new Date()): ReportForm => ({ bus: '', route: '', sentido: defaultSentido(now), quando: 'agora', lotacao: '', problems: [], comment: '' });

/** Ida de manhã (antes do meio-dia, hora local do aparelho), volta à tarde/noite. */
export const defaultSentido = (now = new Date()): Exclude<Sentido, ''> => now.getHours() < 12 ? 'ida' : 'volta';

const safe = (value: string) => value.replace(/[|\],[<>=]/g, ' ').replace(/\s+/g, ' ').trim();
/** "Ônibus 02" -> "02"; "Não sei"/vazio -> "nao_sei". */
export const busCode = (label: string) => { const text = safe(label); if (!text || text === NAO_SEI) return 'nao_sei'; return safe(text.replace(/^[ÔO]nibus\s*/i, '')) || 'nao_sei'; };
export const routeCode = (label: string) => { const text = safe(label); return !text || text === NAO_SEI ? 'nao_sei' : text; };
export const busFromCode = (code: string) => code === 'nao_sei' || !code ? NAO_SEI : /^\d+$/.test(code) ? `Ônibus ${code}` : code;
export const routeFromCode = (code: string) => code === 'nao_sei' || !code ? NAO_SEI : code;

/** Linha: `[v1|bus=02|sentido=ida|quando=agora|problemas=a,b,c]` (rota e lotacao são opcionais; a rota é inferida depois pelas viagens GPS). */
export function buildStructuredLine(form: ReportForm): string {
    const parts = [`v${CHECKLIST_VERSION}`, `bus=${busCode(form.bus)}`];
    if (form.route) parts.push(`rota=${routeCode(form.route)}`);
    if (form.sentido) parts.push(`sentido=${form.sentido}`);
    parts.push(`quando=${form.quando}`);
    if (form.lotacao) parts.push(`lotacao=${form.lotacao}`);
    parts.push(`problemas=${canonicalProblems(form.problems).join(',')}`);
    return `[${parts.join('|')}]`;
}
const cleanComment = (text: string) => text.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
/** Texto final enviado no campo `message`: linha estruturada + comentário. */
export function buildReportText(form: ReportForm): string {
    const comment = cleanComment(form.comment);
    return comment ? `${buildStructuredLine(form)} ${comment}` : buildStructuredLine(form);
}
/** Quantos caracteres restam para o comentário. */
export const commentRoom = (form: ReportForm) => Math.max(0, MAX_TEXT - buildStructuredLine({ ...form, comment: '' }).length - 1);
/** Marcar mais um item ainda cabe (linha ≤ MAX_LINE)? */
export const canAddProblem = (form: ReportForm, id: string) => buildStructuredLine({ ...form, problems: [...form.problems, id] }).length <= MAX_LINE;

export interface ParsedReport { version: number; bus: string; route: string; sentido: Sentido; quando: Quando | ''; lotacao: Lotacao; problems: string[]; comment: string }
/** Lê a linha estruturada no início do texto. Relatos antigos (sem linha) devolvem null. */
export function parseStructuredLine(text: string | null | undefined): ParsedReport | null {
    const match = /^\s*\[v(\d+)((?:\|[^|\]]*)*)\]\s*(.*)$/s.exec(String(text ?? ''));
    if (!match) return null;
    const fields = new Map<string, string>();
    for (const part of match[2].split('|').filter(Boolean)) { const at = part.indexOf('='); if (at > 0) fields.set(part.slice(0, at), part.slice(at + 1)); }
    const oneOf = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T) => allowed.includes(value as T) ? value as T : fallback;
    return {
        version: Number(match[1]),
        bus: busFromCode(fields.get('bus') ?? ''),
        route: routeFromCode(fields.get('rota') ?? ''),
        sentido: oneOf<Sentido>(fields.get('sentido'), ['ida', 'volta'], ''),
        quando: oneOf<Quando | ''>(fields.get('quando'), ['agora', 'manha', 'noite', 'outro_dia'], ''),
        lotacao: oneOf<Lotacao>(fields.get('lotacao'), ['poucos', 'metade', 'cheio', 'superlotado'], ''),
        problems: canonicalProblems((fields.get('problemas') ?? '').split(',').filter(Boolean)),
        comment: match[3].trim(),
    };
}

/** Rascunho -> payload do contrato atual (bus_label, route_name, category, message). */
export function toPayloadFields(form: ReportForm) {
    return { bus_label: form.bus.trim() || NAO_SEI, route_name: !form.route || form.route === NAO_SEI ? '' : form.route.trim(), category: categoryFor(form.problems), message: buildReportText(form) };
}

/** Pelo menos 1 problema marcado para avançar da tela 2. */
export const canAdvance = (form: Pick<ReportForm, 'problems'>) => form.problems.length >= 1;
export function validateForm(form: ReportForm): string | null {
    if (!form.bus) return 'Escolha o ônibus.';
    if (!canAdvance(form)) return 'Marque pelo menos um problema.';
    if (buildReportText(form).length > MAX_TEXT) return `O texto deve ter até ${MAX_TEXT} caracteres.`;
    return null;
}
