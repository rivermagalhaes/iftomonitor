// Código do monitor: nunca guardado em texto puro. Guarda-se apenas o SHA-256 de SALT + código.
// Para trocar o código, veja docs/MODOS.md.
export const MONITOR_SALT = 'ifto-monitor/2.2/monitor|';
export const MONITOR_CODE_HASH = '0ca3ce090402b4d5be069eeda30967e85dc1a9ad90ce61f9272c2d23ee5eb60b';
export async function hashMonitorCode(code: string, salt = MONITOR_SALT): Promise<string> {
    const bytes = new TextEncoder().encode(salt + code.trim());
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function verifyMonitorCode(code: string, expected = MONITOR_CODE_HASH, salt = MONITOR_SALT): Promise<boolean> {
    if (!code.trim()) return false;
    return (await hashMonitorCode(code, salt)) === expected;
}
