// Fonte ÚNICA da verdade do checklist de relatos (app Aluno, página web #/relatar e painel #/painel).
// Ids são permanentes: nunca renomear, só adicionar. Rótulos podem mudar. Aumente CHECKLIST_VERSION
// somente se a leitura da linha estruturada mudar de formato.
export const CHECKLIST_VERSION = 1;
export type Urgency = 'U' | 'A' | 'N';
export type ReportCategory = 'atraso' | 'quebra' | 'superlotacao' | 'parada_nao_feita' | 'desvio' | 'limpeza_conservacao' | 'seguranca' | 'outro';
export interface ChecklistItem { id: string; label: string; urgency: Urgency; category: ReportCategory }
export interface ChecklistSection { id: string; title: string; icon: string; items: ChecklistItem[] }
const i = (id: string, label: string, urgency: Urgency, category: ReportCategory): ChecklistItem => ({ id, label, urgency, category });

export const checklistSections: ChecklistSection[] = [
    { id: 'mecanica', title: 'Quebra e problemas mecânicos', icon: '🔧', items: [
        i('quebrou_parou', 'Ônibus quebrou / parou na estrada', 'U', 'quebra'),
        i('pneu_furado', 'Pneu furado', 'A', 'quebra'),
        i('motor_parou', 'Motor parou / perdeu força', 'A', 'quebra'),
        i('superaquecimento_fumaca', 'Superaquecimento ou fumaça', 'U', 'quebra'),
        i('freio_problema', 'Problema nos freios', 'U', 'quebra'),
        i('nao_pegou', 'Ônibus não ligou / bateria', 'A', 'quebra'),
        i('sem_combustivel', 'Ficou sem combustível', 'A', 'quebra'),
        i('vazamento', 'Vazamento (óleo, água ou combustível)', 'A', 'quebra'),
        i('porta_defeito', 'Porta não abre ou não fecha direito', 'A', 'quebra'),
        i('barulho_mau_estado', 'Barulho estranho ou ônibus em mau estado geral', 'N', 'quebra'),
    ] },
    { id: 'horario', title: 'Horário e itinerário', icon: '🕒', items: [
        i('nao_passou', 'Ônibus não passou', 'A', 'atraso'),
        i('atraso_15', 'Atrasou mais de 15 minutos', 'N', 'atraso'),
        i('atraso_30', 'Atrasou mais de 30 minutos', 'A', 'atraso'),
        i('passou_adiantado', 'Passou adiantado (perdi o ônibus)', 'A', 'atraso'),
        i('trajeto_alterado', 'Mudou o trajeto', 'A', 'desvio'),
        i('nao_parou_ponto', 'Não parou no meu ponto', 'A', 'parada_nao_feita'),
        i('nao_esperou', 'Não esperou os alunos', 'N', 'parada_nao_feita'),
        i('chegou_tarde_campus', 'Chegou ao campus depois das 08:00', 'A', 'atraso'),
        i('volta_nao_saiu_17h', 'Ônibus da volta não saiu às 17:00', 'A', 'atraso'),
        i('volta_nao_chegou_19h', 'Ônibus da volta não chegou até 19:00', 'A', 'atraso'),
        i('deixou_ponto_errado', 'Deixou aluno em ponto errado', 'A', 'parada_nao_feita'),
    ] },
    { id: 'seguranca', title: 'Segurança', icon: '🛡️', items: [
        i('sem_cinto', 'Sem cinto de segurança (ou cinto quebrado)', 'A', 'seguranca'),
        i('superlotado', 'Superlotado / gente em pé', 'A', 'superlotacao'),
        i('sem_lugar', 'Aluno ficou sem lugar para sentar', 'N', 'superlotacao'),
        i('alta_velocidade', 'Motorista em alta velocidade', 'A', 'seguranca'),
        i('freadas_curvas', 'Freadas ou curvas bruscas', 'N', 'seguranca'),
        i('motorista_celular', 'Motorista usando celular', 'A', 'seguranca'),
        i('desrespeito_transito', 'Motorista desrespeitou o trânsito (sinal, ultrapassagem perigosa)', 'A', 'seguranca'),
        i('motorista_alcool', 'Suspeita de motorista alcoolizado', 'U', 'seguranca'),
        i('saida_emergencia', 'Saída de emergência bloqueada ou sem extintor', 'A', 'seguranca'),
        i('acidente_colisao', 'Acidente ou colisão', 'U', 'seguranca'),
        i('estrada_ruim', 'Estrada em mau estado (buracos, lama, poeira)', 'N', 'seguranca'),
        i('trecho_perigoso', 'Ponte ou trecho perigoso', 'A', 'seguranca'),
    ] },
    { id: 'conforto', title: 'Conforto e conservação', icon: '🪑', items: [
        i('muito_quente', 'Muito quente / sem ventilação', 'N', 'limpeza_conservacao'),
        i('janela_defeito', 'Janela quebrada ou que não abre', 'N', 'limpeza_conservacao'),
        i('banco_quebrado', 'Banco quebrado ou solto', 'N', 'limpeza_conservacao'),
        i('onibus_sujo', 'Ônibus sujo', 'N', 'limpeza_conservacao'),
        i('mau_cheiro', 'Mau cheiro', 'N', 'limpeza_conservacao'),
        i('goteira', 'Entra chuva / goteira', 'N', 'limpeza_conservacao'),
        i('sem_luz_interna', 'Sem iluminação interna (à noite)', 'A', 'limpeza_conservacao'),
        i('som_alto', 'Som ou barulho excessivo', 'N', 'limpeza_conservacao'),
    ] },
    { id: 'convivencia', title: 'Motorista e convivência', icon: '🧑‍🤝‍🧑', items: [
        i('motorista_desrespeito', 'Motorista tratou mal ou foi desrespeitoso', 'A', 'outro'),
        i('briga_assedio', 'Briga, bullying ou assédio dentro do ônibus', 'U', 'seguranca'),
        i('estranhos_onibus', 'Pessoas estranhas ou não autorizadas no ônibus', 'A', 'seguranca'),
        i('sem_acessibilidade', 'Sem acessibilidade (cadeirante / mobilidade reduzida)', 'A', 'outro'),
        i('cobranca_indevida', 'Cobrança indevida', 'N', 'outro'),
    ] },
    { id: 'pontos', title: 'Pontos de parada', icon: '🚏', items: [
        i('ponto_sem_abrigo', 'Ponto sem abrigo (sol e chuva)', 'N', 'outro'),
        i('ponto_perigoso', 'Ponto perigoso (beira de pista, escuro)', 'A', 'seguranca'),
        i('ponto_sem_sinalizacao', 'Ponto sem sinalização', 'N', 'outro'),
    ] },
    { id: 'outros', title: 'Outros', icon: '💬', items: [
        i('elogio', 'Quero elogiar (tudo certo hoje)', 'N', 'outro'),
        i('outro', 'Outro problema (explique no campo opcional)', 'N', 'outro'),
    ] },
];

export const checklistItems: ChecklistItem[] = checklistSections.flatMap(s => s.items);
export const itemById = new Map(checklistItems.map(item => [item.id, item]));
const sectionOfId = new Map(checklistSections.flatMap(s => s.items.map(item => [item.id, s] as const)));
const order = new Map(checklistItems.map((item, index) => [item.id, index]));
export const sectionOf = (id: string) => sectionOfId.get(id);
export const urgencyLabels: Record<Urgency, string> = { U: 'Urgente', A: 'Alta', N: 'Normal' };
export const urgencyColors: Record<Urgency, string> = { U: '#C62828', A: '#E65100', N: '#6B7280' };
const rank: Record<Urgency, number> = { U: 2, A: 1, N: 0 };
export const labelOf = (id: string) => itemById.get(id)?.label ?? id;
export const urgencyOf = (id: string): Urgency => itemById.get(id)?.urgency ?? 'N';

/** Remove ids desconhecidos/duplicados e ordena na ordem do checklist (forma canônica). */
export const canonicalProblems = (ids: readonly string[]) => [...new Set(ids)].filter(id => itemById.has(id)).sort((a, b) => order.get(a)! - order.get(b)!);
/** Maior urgência entre os problemas (null se vazio). */
export function topUrgency(ids: readonly string[]): Urgency | null {
    let best: Urgency | null = null;
    for (const id of ids) { const u = urgencyOf(id); if (best === null || rank[u] > rank[best]) best = u; }
    return best;
}
/** Relato urgente = tem ao menos um item de urgência U. */
export const isUrgent = (ids: readonly string[]) => ids.some(id => urgencyOf(id) === 'U');
/** Ordena ids por urgência (U, A, N), mantendo a ordem do checklist dentro de cada nível. */
export const sortByUrgency = (ids: readonly string[]) => canonicalProblems(ids).sort((a, b) => rank[urgencyOf(b)] - rank[urgencyOf(a)] || order.get(a)! - order.get(b)!);
/** Item principal: o de maior urgência (empate: o primeiro na ordem do checklist). */
export const primaryProblem = (ids: readonly string[]) => sortByUrgency(ids)[0] ?? null;
/** Categoria aceita pela Edge Function `submit-report` (conjunto restrito), derivada do item principal. */
export const categoryFor = (ids: readonly string[]): ReportCategory => { const id = primaryProblem(ids); return (id && itemById.get(id)?.category) || 'outro'; };
