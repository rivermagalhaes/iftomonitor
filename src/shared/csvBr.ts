/** CSV para Excel em português: UTF-8 com BOM, separador `;`, decimais com vírgula, CRLF. */
export function csvCellBr(value: unknown): string {
    let text: string;
    if (value === null || value === undefined) text = '';
    else if (typeof value === 'number') text = Number.isFinite(value) ? String(value).replace('.', ',') : '';
    else if (typeof value === 'boolean') text = value ? '1' : '0';
    else text = String(value);
    // Evita injeção de fórmulas em textos (números ficam intactos).
    if (typeof value === 'string' && /^[=+@]/.test(text)) text = "'" + text;
    return /[;"\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}
export function csvBr(columns: readonly string[], rows: readonly (readonly unknown[])[]): string {
    return '﻿' + [columns.join(';'), ...rows.map(r => r.map(csvCellBr).join(';'))].join('\r\n') + '\r\n';
}
