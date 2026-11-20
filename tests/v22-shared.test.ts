import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { categories, validateReport } from '../supabase/functions/_shared/validate';
import { CHECKLIST_VERSION, canonicalProblems, categoryFor, checklistItems, checklistSections, isUrgent, primaryProblem, sortByUrgency, topUrgency } from '../src/shared/reportChecklist';
import { MAX_LINE, MAX_TEXT, buildReportText, buildStructuredLine, canAddProblem, canAdvance, commentRoom, defaultSentido, emptyForm, parseStructuredLine, toPayloadFields, validateForm } from '../src/shared/reportForm';
import { filterRecords, reportCsvColumns, reportsCsv, sortRecords, summarize, toRecord, weekKey } from '../src/shared/reportsAnalysis';
import { csvBr } from '../src/shared/csvBr';

const form = (over = {}) => ({ ...emptyForm(new Date('2026-11-20T10:00:00')), bus: 'Ônibus 02', route: 'Pouso Alegre', problems: ['pneu_furado', 'sem_cinto', 'superlotado'], lotacao: 'cheio' as const, ...over });

test('checklist: 51 itens, 7 seções, ids únicos e urgências válidas', () => {
    expect(CHECKLIST_VERSION).toBe(1);
    expect(checklistItems).toHaveLength(51);
    expect(checklistSections).toHaveLength(7);
    expect(new Set(checklistItems.map(i => i.id)).size).toBe(51);
    expect(checklistItems.every(i => /^[a-z0-9_]+$/.test(i.id) && ['U', 'A', 'N'].includes(i.urgency) && (categories as readonly string[]).includes(i.category))).toBe(true);
    expect(checklistItems.filter(i => i.urgency === 'U').map(i => i.id).sort()).toEqual(['acidente_colisao', 'briga_assedio', 'freio_problema', 'motorista_alcool', 'quebrou_parou', 'superaquecimento_fumaca']);
});
test('mínimo de 1 item para enviar', () => {
    expect(canAdvance({ problems: [] })).toBe(false);
    expect(canAdvance({ problems: ['elogio'] })).toBe(true);
    expect(validateForm({ ...form(), problems: [] })).toBe('Marque pelo menos um problema.');
    expect(validateForm(form())).toBeNull();
});
test('sentido pré-marcado pela hora', () => { expect(defaultSentido(new Date('2026-11-20T07:00:00'))).toBe('ida'); expect(defaultSentido(new Date('2026-11-20T17:30:00'))).toBe('volta'); });
test('linha estruturada: formato exato e ida e volta de ponta a ponta', () => {
    const f = form({ comment: 'Pneu careca <b>' });
    expect(buildStructuredLine(f)).toBe('[v1|bus=02|rota=Pouso Alegre|sentido=ida|quando=agora|lotacao=cheio|problemas=pneu_furado,sem_cinto,superlotado]');
    const text = buildReportText(f);
    expect(text).toBe('[v1|bus=02|rota=Pouso Alegre|sentido=ida|quando=agora|lotacao=cheio|problemas=pneu_furado,sem_cinto,superlotado] Pneu careca b');
    expect(parseStructuredLine(text)).toEqual({ version: 1, bus: 'Ônibus 02', route: 'Pouso Alegre', sentido: 'ida', quando: 'agora', lotacao: 'cheio', problems: ['pneu_furado', 'sem_cinto', 'superlotado'], comment: 'Pneu careca b' });
    const unknown = parseStructuredLine(buildReportText(form({ bus: 'Não sei', route: 'Não sei', sentido: '', lotacao: '', problems: ['outro'] })));
    expect(unknown).toMatchObject({ bus: 'Não sei', route: 'Não sei', sentido: '', lotacao: '', problems: ['outro'], comment: '' });
});
test('linha nova (sem rota e lotação) e linha antiga (v1 completa) são lidas', () => {
    const novo = buildStructuredLine(form({ route: '', lotacao: '', problems: ['pneu_furado', 'sem_cinto'] }));
    expect(novo).toBe('[v1|bus=02|sentido=ida|quando=agora|problemas=pneu_furado,sem_cinto]');
    expect(parseStructuredLine(novo + ' texto')).toMatchObject({ bus: 'Ônibus 02', route: 'Não sei', lotacao: '', comment: 'texto', problems: ['pneu_furado', 'sem_cinto'] });
    const antigo = parseStructuredLine('[v1|bus=03|rota=Serrano|sentido=volta|quando=noite|lotacao=cheio|problemas=superlotado] ok');
    expect(antigo).toMatchObject({ bus: 'Ônibus 03', route: 'Serrano', sentido: 'volta', quando: 'noite', lotacao: 'cheio' });
    const rec = toRecord({ created_at: '2026-11-20T12:00:00Z', route_name: null, message: novo });
    expect(rec).toMatchObject({ structured: true, route: 'Não sei', lotacao: '', urgent: false });
});
test('relato antigo sem linha estruturada não é lido como estruturado', () => {
    expect(parseStructuredLine('Ônibus atrasou muito')).toBeNull();
    expect(parseStructuredLine(null)).toBeNull();
    const r = toRecord({ created_at: '2026-11-20T10:00:00Z', bus_label: 'Ônibus 01', route_name: null, message: 'Ônibus atrasou muito' });
    expect(r).toMatchObject({ structured: false, bus: 'Ônibus 01', problems: [], comment: 'Ônibus atrasou muito' });
});
test('payload respeita o contrato atual da Edge Function (categoria restrita, ≤ 500 caracteres)', () => {
    const fields = toPayloadFields(form({ problems: ['atraso_15', 'motorista_alcool', 'sem_cinto'] }));
    expect(fields.category).toBe('seguranca');
    const validated = validateReport({ ...fields, photos: [] });
    expect(validated.message.startsWith('[v1|')).toBe(true);
    expect(toPayloadFields(form({ route: 'Não sei' })).route_name).toBe('');
    // seleção máxima: o texto continua cabendo em 500 caracteres
    let f = form({ problems: [] as string[] });
    for (const item of checklistItems) if (canAddProblem(f, item.id)) f = { ...f, problems: [...f.problems, item.id] };
    expect(buildStructuredLine(f).length).toBeLessThanOrEqual(MAX_LINE);
    expect(commentRoom(f)).toBeGreaterThanOrEqual(MAX_TEXT - MAX_LINE - 1);
    expect(() => validateReport({ ...toPayloadFields({ ...f, comment: 'x'.repeat(commentRoom(f)) }), photos: [] })).not.toThrow();
});
test('ordenação por urgência e categoria do item de maior urgência', () => {
    expect(sortByUrgency(['onibus_sujo', 'atraso_30', 'acidente_colisao'])).toEqual(['acidente_colisao', 'atraso_30', 'onibus_sujo']);
    expect(primaryProblem(['onibus_sujo', 'atraso_30'])).toBe('atraso_30');
    expect(categoryFor(['onibus_sujo', 'nao_passou'])).toBe('atraso');
    expect(categoryFor([])).toBe('outro');
    expect(topUrgency(['onibus_sujo'])).toBe('N');
    expect(isUrgent(['atraso_30'])).toBe(false);
    expect(isUrgent(['freio_problema'])).toBe(true);
    expect(canonicalProblems(['sem_cinto', 'desconhecido', 'pneu_furado', 'sem_cinto'])).toEqual(['pneu_furado', 'sem_cinto']);
    const records = [
        toRecord({ created_at: '2026-11-20T12:00:00Z', message: buildReportText(form({ problems: ['onibus_sujo'] })) }),
        toRecord({ created_at: '2026-11-19T12:00:00Z', message: buildReportText(form({ problems: ['freio_problema'] })) }),
        toRecord({ created_at: '2026-11-20T13:00:00Z', message: buildReportText(form({ problems: ['atraso_30'] })) }),
    ];
    expect(sortRecords(records).map(r => r.problems[0])).toEqual(['freio_problema', 'atraso_30', 'onibus_sujo']);
    expect(filterRecords(records, { urgency: 'U' })).toHaveLength(1);
    expect(filterRecords(records, { section: 'conforto' })).toHaveLength(1);
    expect(summarize(records)).toMatchObject({ total: 3, urgent: 1, urgentPct: 33.3 });
    expect(weekKey('2026-11-20T12:00:00Z')).toBe('2026-11-16');
});
test('CSV dos relatos: colunas, BOM, separador ; e uma coluna 0/1 por item', () => {
    expect(reportCsvColumns).toHaveLength(8 + 51 + 3);
    expect(reportCsvColumns.slice(0, 8)).toEqual(['data_local', 'onibus', 'rota', 'sentido', 'quando', 'lotacao', 'urgente', 'n_problemas']);
    expect(reportCsvColumns.slice(-3)).toEqual(['problemas', 'comentario', 'n_fotos']);
    const csv = reportsCsv([toRecord({ created_at: '2026-11-20T12:00:00Z', photo_count: 2, message: buildReportText(form({ problems: ['freio_problema', 'sem_cinto'], comment: 'a;b' })) })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [head, line] = csv.slice(1).split('\r\n');
    expect(head.split(';')).toEqual([...reportCsvColumns]);
    expect(line.startsWith('2026-11-20 09:00:00;Ônibus 02;Pouso Alegre;ida;agora;cheio;1;2;')).toBe(true);
    expect(line).toContain('"Problema nos freios; Sem cinto de segurança (ou cinto quebrado)";a;b'.replace('a;b', '"a;b"'));
    expect(line.endsWith(';2')).toBe(true);
});
test('csvBr: decimais com vírgula e proteção contra fórmulas', () => {
    expect(csvBr(['a', 'b'], [[1.5, '=1+1']])).toBe('﻿a;b\r\n1,5;\'=1+1\r\n');
});
test('código do monitor não fica em texto puro no código-fonte', () => {
    const source = readFileSync('src/config/monitorCode.ts', 'utf8');
    expect(source).not.toContain('IFTO2026');
});
