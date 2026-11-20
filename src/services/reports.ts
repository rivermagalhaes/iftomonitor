// Relatos do aluno: mesmo contrato da Edge Function `submit-report` usada pelo site (web/).
// create -> envio das fotos nas URLs assinadas -> finalize.
import { openDB, type IDBPDatabase } from 'idb';
import { categories, validateReport } from '../../supabase/functions/_shared/validate';
import { compressPhoto } from '../../web/lib';
import { getSupabase, isSupabaseConfigured } from './auth';
import { REPORT_ACTION_CREATE, REPORT_ACTION_FINALIZE, REPORT_BUCKET, REPORT_FUNCTION, REPORT_GENERIC_ERROR, REPORT_MAX_PHOTOS, REPORT_MAX_TEXT } from '../shared/reportContract';
export { categories };
export type Category = typeof categories[number];
export const categoryLabels: Record<Category, string> = { atraso: 'Atraso', quebra: 'Quebra', superlotacao: 'Superlotação', parada_nao_feita: 'Parada não feita', desvio: 'Desvio', limpeza_conservacao: 'Limpeza e conservação', seguranca: 'Segurança', outro: 'Outro' };
export const BUS_CHIPS = ['Ônibus 01', 'Ônibus 02', 'Ônibus 03'] as const;
export const MAX_MESSAGE = REPORT_MAX_TEXT, MAX_PHOTOS = REPORT_MAX_PHOTOS;
export type ReportStatus = 'pendente' | 'enviado' | 'falhou';
export interface StoredReport { id: string; created_at: string; bus_label: string; route_name?: string; category: Category; message: string; photos: Blob[]; status: ReportStatus; error?: string; sent_at?: string; http_status?: number }
export interface ReportDraft { bus_label: string; route_name?: string; category: string; message: string; photos: Blob[]; honeypot?: string }
export class NetworkError extends Error { constructor(message = 'Sem conexão. O relato será enviado quando a internet voltar.') { super(message); } }
export class ReportRejected extends Error { constructor(message: string, public status?: number) { super(message); } }
/** Mensagem para o cartão do relato: o texto REAL do campo `error` devolvido pelo servidor. */
export function friendlyServerError(status: number, serverMessage: unknown): string {
    const msg = typeof serverMessage === 'string' ? serverMessage.trim() : '';
    if (status === 429) return msg || 'Limite diário de relatos atingido. Tente amanhã.';
    if (msg === REPORT_GENERIC_ERROR) return `Servidor: "${msg}". É uma falha interna do servidor, não do seu relato; avise a equipe do projeto e use Reenviar depois.`;
    return msg ? `Servidor: "${msg}".` : `O servidor recusou o relato (sem mensagem).`;
}

export interface ReportStore { all(): Promise<StoredReport[]>; put(report: StoredReport): Promise<void> }
export class MemoryReportStore implements ReportStore {
    private rows = new Map<string, StoredReport>();
    async all() { return [...this.rows.values()].map(r => ({ ...r })); }
    async put(report: StoredReport) { this.rows.set(report.id, { ...report }); }
}
export class IdbReportStore implements ReportStore {
    private db: Promise<IDBPDatabase>;
    constructor(name = 'ifto_reports') { this.db = openDB(name, 1, { upgrade(db) { db.createObjectStore('reports', { keyPath: 'id' }); } }); }
    async all() { return (await (await this.db).getAll('reports')) as StoredReport[]; }
    async put(report: StoredReport) { await (await this.db).put('reports', report); }
}

export interface ReportTransport { send(report: StoredReport): Promise<void> }
type CreateResult = { report_id: string; finalize_token: string; uploads: { path: string; token: string }[] };
export function httpTransport(
    fetchFn: typeof fetch = (...args) => fetch(...args),
    env: { url?: string; key?: string } = { url: import.meta.env.VITE_SUPABASE_URL as string | undefined, key: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined },
    upload?: (path: string, token: string, blob: Blob) => Promise<void>,
): ReportTransport {
    const call = async (body: Record<string, unknown>) => {
        if (!env.url || !env.key) throw new ReportRejected('Envio indisponível: a nuvem não está configurada neste aplicativo.', 0);
        let response: Response;
        try { response = await fetchFn(`${env.url.replace(/\/$/, '')}/functions/v1/${REPORT_FUNCTION}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.key, Authorization: `Bearer ${env.key}` }, body: JSON.stringify(body) }); }
        catch { throw new NetworkError(); }
        if (response.status >= 500 || response.status === 408) throw new NetworkError('Serviço indisponível no momento. Tentaremos de novo.');
        const data = await response.json().catch(() => ({})) as Record<string, unknown>;
        if (!response.ok) throw new ReportRejected(friendlyServerError(response.status, data.error), response.status);
        return data as unknown as CreateResult;
    };
    const put = upload ?? (async (path: string, token: string, blob: Blob) => {
        const client = getSupabase();
        if (!client) throw new ReportRejected('Envio indisponível: a nuvem não está configurada neste aplicativo.');
        const { error } = await client.storage.from(REPORT_BUCKET).uploadToSignedUrl(path, token, blob, { contentType: 'image/jpeg' });
        if (error) throw new NetworkError('Não foi possível enviar a foto. Tentaremos de novo.');
    });
    return {
        async send(report) {
            const payload = { ...validateReport({ bus_label: report.bus_label, route_name: report.route_name ?? '', category: report.category, message: report.message, photos: report.photos.map(p => ({ mime_type: p.type || 'image/jpeg', size_bytes: p.size })) }), honeypot: '', action: REPORT_ACTION_CREATE };
            const created = await call(payload);
            const paths: string[] = [];
            for (let i = 0; i < report.photos.length; i++) { const u = created.uploads[i]; await put(u.path, u.token, report.photos[i]); paths.push(u.path); }
            await call({ action: REPORT_ACTION_FINALIZE, report_id: created.report_id, finalize_token: created.finalize_token, paths });
        },
    };
}
export const reportsConfigured = () => isSupabaseConfigured();

type Field = 'bus' | 'category' | 'message' | 'photos';
/** Valida o rascunho com as mesmas regras do site; devolve mensagens por campo (vazio = válido). */
export function validateDraft(d: ReportDraft): Partial<Record<Field, string>> {
    const errors: Partial<Record<Field, string>> = {};
    if (!d.bus_label.trim()) errors.bus = 'Escolha o ônibus.';
    else if (d.bus_label.trim().length > 60 || /[<>]/.test(d.bus_label)) errors.bus = 'Nome do ônibus inválido.';
    if (!(categories as readonly string[]).includes(d.category)) errors.category = 'Escolha o tipo de ocorrência.';
    if (d.message.length > MAX_MESSAGE) errors.message = `O texto deve ter até ${MAX_MESSAGE} caracteres.`;
    else if (/[<>]/.test(d.message)) errors.message = 'Não use os símbolos < e >.';
    if (d.photos.length > MAX_PHOTOS) errors.photos = `Envie no máximo ${MAX_PHOTOS} fotos.`;
        return errors;
}

export class ReportQueue {
    private listeners = new Set<() => void>();
    private flushing: Promise<void> | null = null;
    private rows: StoredReport[] = [];
    constructor(private store: ReportStore = new MemoryReportStore(), private transport: ReportTransport = httpTransport(), private isOnline: () => boolean = () => navigator.onLine) { }
    subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
    getSnapshot = () => this.rows;
    private async reload() { this.rows = (await this.store.all()).sort((a, b) => b.created_at.localeCompare(a.created_at)); this.listeners.forEach(l => l()); }
    async load() { await this.reload(); }
    /** Honeypot preenchido: descarta em silêncio, como no site. Retorna o relato salvo (ou null). */
    async submit(draft: ReportDraft): Promise<StoredReport | null> {
        if (draft.honeypot) return null;
        const errors = validateDraft(draft);
        if (Object.keys(errors).length) throw new ReportRejected(Object.values(errors)[0]);
        const report: StoredReport = { id: crypto.randomUUID(), created_at: new Date().toISOString(), bus_label: draft.bus_label.trim(), route_name: (draft.route_name ?? '').trim(), category: draft.category as Category, message: draft.message.replace(/\s+/g, ' ').trim(), photos: draft.photos, status: 'pendente' };
        await this.store.put(report); await this.reload();
        await this.attempt(report.id);
        return (await this.store.all()).find(r => r.id === report.id) ?? report;
    }
    private async attempt(id: string) {
        const report = (await this.store.all()).find(r => r.id === id);
        if (!report || report.status === 'enviado' || !this.isOnline()) return;
        try { await this.transport.send(report); await this.store.put({ ...report, status: 'enviado', error: undefined, sent_at: new Date().toISOString() }); }
        catch (e) {
            if (e instanceof NetworkError) await this.store.put({ ...report, status: 'pendente', error: e.message });
            else await this.store.put({ ...report, status: 'falhou', http_status: e instanceof ReportRejected ? e.status : undefined, error: e instanceof Error ? e.message : 'Não foi possível enviar.' });
        }
        await this.reload();
    }
    /** Reenvia pendentes (ao voltar a conexão e ao abrir o app). Falhos só por ação do usuário. */
    flush(): Promise<void> {
        if (this.flushing) return this.flushing;
        this.flushing = (async () => { await this.reload(); for (const r of this.rows.filter(r => r.status === 'pendente')) await this.attempt(r.id); })().finally(() => { this.flushing = null; });
        return this.flushing;
    }
    async resend(id: string) {
        const report = (await this.store.all()).find(r => r.id === id);
        if (!report || report.status === 'enviado') return;
        await this.store.put({ ...report, status: 'pendente', error: undefined, http_status: undefined }); await this.reload();
        await this.attempt(id);
    }
}

/** Reduz para JPEG, lado maior 1280 px e no máximo 1 MB (mesma rotina do site). */
export async function reducePhoto(blob: Blob): Promise<Blob> { return compressPhoto(new File([blob], 'foto.jpg', { type: blob.type || 'image/jpeg' })); }
export async function pickPhoto(source: 'camera' | 'galeria' | 'escolher' = 'escolher'): Promise<Blob | null> {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    try {
        const photo = await Camera.getPhoto({ quality: 85, resultType: CameraResultType.Uri, source: source === 'camera' ? CameraSource.Camera : source === 'galeria' ? CameraSource.Photos : CameraSource.Prompt, promptLabelHeader: 'Foto do ônibus', promptLabelPhoto: 'Escolher da galeria', promptLabelPicture: 'Tirar foto', promptLabelCancel: 'Cancelar', correctOrientation: true, width: 1600 });
        if (!photo.webPath) return null;
        return await reducePhoto(await (await fetch(photo.webPath)).blob());
    } catch (e) {
        if (/cancel/i.test(String(e instanceof Error ? e.message : e))) return null;
        throw new Error('Não foi possível obter a foto. Verifique a permissão de câmera ou tente de novo.');
    }
}
