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

/** `userEmail`, `userName`, `trip` (8 caracteres do id da viagem) e `loc` ("lat,lon") são opcionais e entram na linha só se couberem. */
export interface ReportForm { bus: string; route: string; sentido: Sentido; quando: Quando; lotacao: Lotacao; problems: string[]; comment: string; userEmail?: string; userName?: string; trip?: string; loc?: string }
export const emptyForm = (now = new Date()): ReportForm => ({ bus: '', route: '', sentido: defaultSentido(now), quando: 'agora', lotacao: '', problems: [], comment: '' });

/** Ida de manhã (antes do meio-dia, hora local do aparelho), volta à tarde/noite. */
export const defaultSentido = (now = new Date()): Exclude<Sentido, ''> => now.getHours() < 12 ? 'ida' : 'volta';

const safe = (value: string) => value.replace(/[|\],[<>=]/g, ' ').replace(/\s+/g, ' ').trim();
/** "Ônibus 02" -> "02"; "Não sei"/vazio -> "nao_sei". */
export const busCode = (label: string) => { const text = safe(label); if (!text || text === NAO_SEI) return 'nao_sei'; return safe(text.replace(/^[ÔO]nibus\s*/i, '')) || 'nao_sei'; };
export const routeCode = (label: string) => { const text = safe(label); return !text || text === NAO_SEI ? 'nao_sei' : text; };
export const busFromCode = (code: string) => code === 'nao_sei' || !code ? NAO_SEI : /^\d+$/.test(code) ? `Ônibus ${code}` : code;
export const routeFromCode = (code: string) => code === 'nao_sei' || !code ? NAO_SEI : code;

/** Linha: `[v1|u=a@b.com|n=Maria|bus=02|sentido=ida|quando=agora|trip=ab12cd34|loc=-10.16735,-48.86950|problemas=a,b]`.
 *  Obrigatórios: v, bus, quando, problemas (a rota e a lotação são opcionais; a rota é inferida depois pelas viagens GPS).
 *  Campos opcionais entram por prioridade (trip, loc, u, n, rota, lotacao) enquanto a linha couber em MAX_LINE; os problemas nunca são cortados. */
export function buildStructuredLine(form: ReportForm): string {
    const text = (v: string | undefined, max: number) => safe(v ?? '').slice(0, max).trim();
    const optional: [string, string][] = [
        ['trip', /^[0-9a-f]{8}$/i.test(form.trip ?? '') ? form.trip!.toLowerCase() : ''],
        ['loc', /^-?\d{1,3}\.\d{1,6},-?\d{1,3}\.\d{1,6}$/.test(form.loc ?? '') ? form.loc! : ''],
        ['u', text(form.userEmail, 60)], ['n', text(form.userName, 30)], ['rota', form.route ? routeCode(form.route) : ''], ['lotacao', form.lotacao],
    ];
    const required = (extra: Record<string, string>) => {
        const f = (k: string) => extra[k] ? [`${k}=${extra[k]}`] : [];
        return `[${[`v${CHECKLIST_VERSION}`, ...f('u'), ...f('n'), `bus=${busCode(form.bus)}`, ...f('rota'), ...(form.sentido ? [`sentido=${form.sentido}`] : []), `quando=${form.quando}`, ...f('trip'), ...f('loc'), ...f('lotacao'), `problemas=${canonicalProblems(form.problems).join(',')}`].join('|')}]`;
    };
    const chosen: Record<string, string> = {};
    for (const [key, value] of optional) { if (value && required({ ...chosen, [key]: value }).length <= MAX_LINE) chosen[key] = value; }
    return required(chosen);
}
const cleanComment = (text: string) => text.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
/** Texto final enviado no campo `message`: linha estruturada + comentário. */
export function buildReportText(form: ReportForm): string {
    const line = buildStructuredLine(form);
    // Nunca perde os problemas marcados: é o comentário que é truncado para caber em MAX_TEXT.
    const comment = cleanComment(form.comment).slice(0, Math.max(0, MAX_TEXT - line.length - 1)).trim();
    return comment ? `${line} ${comment}` : line;
}
/** Quantos caracteres restam para o comentário. */
export const commentRoom = (form: ReportForm) => Math.max(0, MAX_TEXT - buildStructuredLine({ ...form, comment: '' }).length - 1);
/** Marcar mais um item ainda cabe (linha ≤ MAX_LINE)? */
/** Mede só os campos obrigatórios: os opcionais (usuário, viagem, local) cedem lugar, os problemas não. */
export const canAddProblem = (form: ReportForm, id: string) => buildStructuredLine({ ...form, userEmail: undefined, userName: undefined, trip: undefined, loc: undefined, route: '', lotacao: '', problems: [...form.problems, id] }).length <= MAX_LINE;

export interface ParsedReport { version: number; user: string; userName: string; trip: string; loc: string; bus: string; route: string; sentido: Sentido; quando: Quando | ''; lotacao: Lotacao; problems: string[]; comment: string }
/** Lê a linha estruturada no início do texto. Relatos antigos (sem linha) devolvem null. */
export function parseStructuredLine(text: string | null | undefined): ParsedReport | null {
    const match = /^\s*\[v(\d+)((?:\|[^|\]]*)*)\]\s*(.*)$/s.exec(String(text ?? ''));
    if (!match) return null;
    const fields = new Map<string, string>();
    for (const part of match[2].split('|').filter(Boolean)) { const at = part.indexOf('='); if (at > 0) fields.set(part.slice(0, at), part.slice(at + 1)); }
    const oneOf = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T) => allowed.includes(value as T) ? value as T : fallback;
    return {
        version: Number(match[1]), user: fields.get('u') ?? '', userName: fields.get('n') ?? '', trip: fields.get('trip') ?? '', loc: fields.get('loc') ?? '',
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
