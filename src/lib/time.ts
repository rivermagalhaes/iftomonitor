export function localTimestamp(value: string | null, timeZone?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const get = (key: string) => parts.find(p => p.type === key)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}
export const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('pt-BR') : '—';
export function elapsed(start: string, end: string | null = null) { const seconds = Math.max(0, Math.floor(((end ? Date.parse(end) : Date.now()) - Date.parse(start)) / 1000)); return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':'); }

/* ---- Horário local fixo de America/Fortaleza (UTC-3, sem horário de verão) ---- */
export const FORTALEZA_TZ = 'America/Fortaleza';
export const FORTALEZA_OFFSET_MIN = -180;
const MINUTE_MS = 60000, DAY_MS = 86400000;
const shifted = (ms: number) => new Date(ms + FORTALEZA_OFFSET_MIN * MINUTE_MS);
const pad2 = (n: number) => String(n).padStart(2, '0');
/** Minutos desde 00:00 local (fracionário) ou null se a data for inválida. */
export function localMinutesOfDay(iso: string): number | null {
    const ms = Date.parse(iso); if (!Number.isFinite(ms)) return null;
    const d = shifted(ms); return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
}
/** Instante UTC (ms) da meia-noite local do dia de `ms`. */
export const localDayStartMs = (ms: number) => Math.floor((ms + FORTALEZA_OFFSET_MIN * MINUTE_MS) / DAY_MS) * DAY_MS - FORTALEZA_OFFSET_MIN * MINUTE_MS;
export const localDayKey = (iso: string) => { const d = shifted(Date.parse(iso)); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; };
export const localHM = (iso: string) => { const d = shifted(Date.parse(iso)); return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`; };
export const localHMS = (iso: string) => { const d = shifted(Date.parse(iso)); return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`; };
export const localDateTimeFortaleza = (iso: string | null) => !iso || !Number.isFinite(Date.parse(iso)) ? '' : `${localDayKey(iso)} ${localHMS(iso)}`;
/** Minutos do dia (número) para "HH:MM" (arredonda ao minuto mais próximo). */
export const formatMinutesOfDay = (minutes: number) => { const m = ((Math.round(minutes) % 1440) + 1440) % 1440; return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`; };
/** "HH:MM" para minutos do dia, ou null se inválido. */
export function parseHM(value: string): number | null {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
/** Instante UTC (ms) de "HH:MM" local no mesmo dia local de `referenceMs`. */
export const localTimeOnDayOf = (referenceMs: number, hm: string) => localDayStartMs(referenceMs) + (parseHM(hm) ?? 0) * MINUTE_MS;
