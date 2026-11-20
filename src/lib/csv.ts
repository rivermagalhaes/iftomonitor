/** CSV simples (BOM + CRLF). Textos que começam com = + @ ganham apóstrofo (injeção de fórmulas); números ficam intactos. */
export const csvField = (value: unknown) => {
    let text = value === null || value === undefined ? '' : String(value);
    if (typeof value === 'string' && /^[=+@]/.test(text)) text = "'" + text;
    return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
};
export const csvText = (headers: readonly string[], rows: unknown[][]) => '﻿' + [headers.join(','), ...rows.map(r => r.map(csvField).join(','))].join('\r\n') + '\r\n';
