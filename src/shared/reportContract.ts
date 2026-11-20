// Contrato ÚNICO com a Edge Function `supabase/functions/submit-report/index.ts` (lido do código; a função não é alterada).
// Corpo: JSON em POST /functions/v1/submit-report. O campo `action` decide a rota; qualquer outro valor/ausência → 400 "Ação inválida".
export const REPORT_FUNCTION = 'submit-report';
export const REPORT_BUCKET = 'ifto-reports';
export const REPORT_ACTION_CREATE = 'create';
export const REPORT_ACTION_FINALIZE = 'finalize';
export const REPORT_ACTIONS = [REPORT_ACTION_CREATE, REPORT_ACTION_FINALIZE] as const;
export const REPORT_MAX_TEXT = 500;
export const REPORT_MAX_PHOTOS = 2;
export const REPORT_MAX_PHOTO_BYTES = 1048576;
export const REPORT_PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Mensagem genérica que a função devolve (HTTP 400) para QUALQUER falha interna, inclusive de banco. */
export const REPORT_GENERIC_ERROR = 'Não foi possível enviar';
