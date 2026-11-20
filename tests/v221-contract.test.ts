import { test, expect } from 'vitest';
import { categories, validateReport } from '../supabase/functions/_shared/validate';
import { MemoryReportStore, NetworkError, ReportQueue, ReportRejected, friendlyServerError, httpTransport, type StoredReport } from '../src/services/reports';
import { checklistItems } from '../src/shared/reportChecklist';
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
test('mensagens de erro do servidor viram português claro', () => {
    expect(friendlyServerError(400, 'Não foi possível enviar')).toMatch(/erro 400 sem detalhe/);
    expect(friendlyServerError(400, 'Texto inválido')).toMatch(/Texto inválido/);
    expect(friendlyServerError(400, 'Fotos inválidas')).toMatch(/até 2 fotos/);
    expect(friendlyServerError(429, 'x')).toMatch(/Limite diário/);
    expect(friendlyServerError(401, undefined)).toMatch(/chave/);
});
test('4xx marca Falhou com código HTTP e não reenvia sozinho; 5xx e rede ficam Pendente', async () => {
    let status = 400, calls = 0;
    const transport = httpTransport(async () => { calls++; if (status === 0) throw new TypeError('rede'); return new Response(JSON.stringify({ error: 'Não foi possível enviar' }), { status }); }, { url: 'https://x.test', key: 'k' });
    const queue = new ReportQueue(new MemoryReportStore(), transport, () => true);
    const draft = { ...toPayloadFields(base()), photos: [] };
    const saved = await queue.submit(draft);
    expect(saved).toMatchObject({ status: 'falhou', http_status: 400 }); expect(saved!.error).toMatch(/erro 400/);
    await queue.flush(); await queue.flush(); expect(calls).toBe(1); // sem loop
    status = 503; await queue.resend(saved!.id); expect(queue.getSnapshot()[0]).toMatchObject({ status: 'pendente' });
    status = 0; await queue.resend(saved!.id); expect(queue.getSnapshot()[0].status).toBe('pendente');
    expect(new ReportRejected('x', 400).status).toBe(400); expect(new NetworkError().message).toBeTruthy();
});
