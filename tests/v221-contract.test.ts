import { test, expect } from 'vitest';
import { categories, validateReport } from '../supabase/functions/_shared/validate';
import { MemoryReportStore, NetworkError, ReportQueue, ReportRejected, friendlyServerError, httpTransport, type StoredReport } from '../src/services/reports';
import { checklistItems } from '../src/shared/reportChecklist';
import { REPORT_ACTIONS, REPORT_GENERIC_ERROR } from '../src/shared/reportContract';
import { canAddProblem, emptyForm, toPayloadFields, type ReportForm } from '../src/shared/reportForm';

/** Regras de `supabase/functions/submit-report/index.ts` (action=create), copiadas do código lido. */
function serverCreate(body: Record<string, unknown>) {
    expect(body.action).toBe('create');
    const r = validateReport(body); // lança Error se a Edge Function responderia 400
    expect((categories as readonly string[]).includes(r.category)).toBe(true);
    expect(r.bus_label.length).toBeGreaterThanOrEqual(1); expect(r.bus_label.length).toBeLessThanOrEqual(60);
    expect(r.route_name?.length ?? 0).toBeLessThanOrEqual(80);
    expect(r.message.length).toBeLessThanOrEqual(500);            // reports.message char_length <= 500
    expect(r.message.length > 0 || r.photos.length > 0).toBe(true); // reports_text_or_photo
    expect(r.photos.length).toBeLessThanOrEqual(2);
    for (const p of r.photos) { expect(['image/jpeg', 'image/png', 'image/webp']).toContain(p.mime_type); expect(p.size_bytes).toBeGreaterThanOrEqual(1); expect(p.size_bytes).toBeLessThanOrEqual(1048576); }
    expect(body.honeypot).toBe('');
    return r;
}
const base = (over: Partial<ReportForm> = {}): ReportForm => ({ ...emptyForm(new Date('2026-11-20T10:00:00')), bus: 'Ônibus 01', problems: ['pneu_furado'], ...over });
const photo = (size = 5000) => new Blob([new Uint8Array(size)], { type: 'image/jpeg' });
const all = (() => { let f = base({ problems: [] }); for (const i of checklistItems) if (canAddProblem(f, i.id)) f = { ...f, problems: [...f.problems, i.id] }; return f.problems; })();

test('payload do app respeita as regras da Edge Function em todas as combinações', async () => {
    const forms: ReportForm[] = [
        base(), base({ problems: ['pneu_furado', 'sem_cinto', 'superlotado', 'atraso_15'] }), base({ problems: ['freio_problema'] }), base({ problems: ['elogio'] }),
        base({ comment: 'Texto do aluno' }), base({ comment: 'x'.repeat(2000) }), base({ comment: '<b>oi</b> a < b' }), base({ bus: 'Não sei' }), base({ bus: 'Ônibus 03', route: 'Pouso Alegre' }),
        base({ problems: all, comment: 'y'.repeat(500) }), ...checklistItems.map(i => base({ problems: [i.id] })),
    ];
    for (const form of forms) for (const n of [0, 1, 2]) {
        const bodies: Record<string, unknown>[] = [];
        const t = httpTransport(async (_url, init) => { const body = JSON.parse(String(init!.body)); bodies.push(body); return new Response(JSON.stringify({ report_id: 'r', finalize_token: 't', uploads: Array.from({ length: n }, (_, k) => ({ path: 'p' + k, token: 'k' })) }), { status: 200 }); }, { url: 'https://x.test', key: 'k' }, async () => { });
        const fields = toPayloadFields(form);
        const rep: StoredReport = { id: 'i', created_at: '', ...fields, category: fields.category as StoredReport['category'], photos: Array.from({ length: n }, () => photo()), status: 'pendente' };
        await t.send(rep);
        expect(bodies).toHaveLength(2);
        serverCreate(bodies[0]);
        expect(bodies[1]).toMatchObject({ action: 'finalize', report_id: 'r', finalize_token: 't' }); expect((bodies[1].paths as string[]).length).toBe(n);
        // os problemas marcados nunca se perdem na linha estruturada
        const line = String(bodies[0].message);
        for (const id of form.problems) expect(line.split(']')[0]).toContain(id);
    }
});
/** Roteamento da Edge Function (index.ts): só `create` e `finalize`; o resto → 400 "Ação inválida". */
const serverRoute = (body: Record<string, unknown>) => body.action === 'create' || body.action === 'finalize' ? 'ok' : 'Ação inválida';
test('a ação enviada pelo app é válida para a função (e uma ação errada seria recusada)', async () => {
    const bodies: Record<string, unknown>[] = [];
    const t = httpTransport(async (url, init) => { expect(String(url)).toBe('https://x.test/functions/v1/submit-report'); expect((init!.headers as Record<string, string>)['Content-Type']).toBe('application/json'); bodies.push(JSON.parse(String(init!.body))); return new Response(JSON.stringify({ report_id: 'r', finalize_token: 't', uploads: [{ path: 'p', token: 'k' }] }), { status: 200 }); }, { url: 'https://x.test', key: 'k' }, async () => { });
    const fields = toPayloadFields(base());
    await t.send({ id: 'i', created_at: '', ...fields, category: fields.category as StoredReport['category'], photos: [photo()], status: 'pendente' });
    expect(bodies.map(serverRoute)).toEqual(['ok', 'ok']);
    expect(bodies.map(b => b.action)).toEqual([...REPORT_ACTIONS]);
    expect(serverRoute({})).toBe('Ação inválida'); expect(serverRoute({ ...bodies[0], action: 'criar' })).toBe('Ação inválida'); expect(serverRoute({ ...bodies[0], acao: 'create', action: undefined })).toBe('Ação inválida');
    expect(new TextEncoder().encode(String(bodies[0].message)).length).toBeLessThanOrEqual(2000); expect(String(bodies[0].message).length).toBeLessThanOrEqual(500);
    expect((bodies[0].photos as unknown[]).length).toBeLessThanOrEqual(2);
});
test('o cartão mostra o texto real do servidor; 4xx não reenvia sozinho; Reenviar funciona e reconstrói o payload', async () => {
    let reply: { status: number; error?: string } = { status: 400, error: 'Ação inválida' }, calls = 0; const bodies: Record<string, unknown>[] = [];
    const transport = httpTransport(async (_u, init) => { calls++; bodies.push(JSON.parse(String(init!.body))); return reply.status === 200 ? new Response(JSON.stringify({ report_id: 'r', finalize_token: 't', uploads: [] }), { status: 200 }) : new Response(JSON.stringify({ error: reply.error }), { status: reply.status }); }, { url: 'https://x.test', key: 'k' });
    const queue = new ReportQueue(new MemoryReportStore(), transport, () => true);
    const saved = await queue.submit({ ...toPayloadFields(base({ problems: ['sem_cinto'] })), photos: [] });
    expect(saved).toMatchObject({ status: 'falhou', http_status: 400, error: 'Servidor: "Ação inválida".' });
    await queue.flush(); await queue.flush(); expect(calls).toBe(1);
    reply = { status: 400, error: REPORT_GENERIC_ERROR }; await queue.resend(saved!.id);
    expect(queue.getSnapshot()[0].error).toContain(`Servidor: "${REPORT_GENERIC_ERROR}"`);
    reply = { status: 200 }; await queue.resend(saved!.id); // o mesmo relato salvo é reenviado, sem refazer
    expect(queue.getSnapshot()[0].status).toBe('enviado');
    expect(bodies.at(-2)).toMatchObject({ action: 'create', bus_label: 'Ônibus 01', category: 'seguranca' }); expect(String(bodies.at(-2)!.message)).toContain('problemas=sem_cinto');
    expect(friendlyServerError(429, undefined)).toMatch(/Limite diário/);
    expect(new ReportRejected('x', 400).status).toBe(400); expect(new NetworkError().message).toBeTruthy();
});
test('5xx e rede ficam Pendente com reenvio automático', async () => {
    let status = 503;
    const transport = httpTransport(async () => { if (status === 0) throw new TypeError('rede'); return new Response('{}', { status }); }, { url: 'https://x.test', key: 'k' });
    const queue = new ReportQueue(new MemoryReportStore(), transport, () => true);
    const saved = await queue.submit({ ...toPayloadFields(base()), photos: [] });
    expect(saved!.status).toBe('pendente'); status = 0; await queue.flush(); expect(queue.getSnapshot()[0].status).toBe('pendente');
});
