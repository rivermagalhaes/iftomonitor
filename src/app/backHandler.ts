// Botão voltar (Android): cada tela pode assumir o controle (ex.: perguntar "Descartar este relato?").
let override: (() => boolean) | null = null;
/** A tela registra um tratador; devolve true se tratou o "voltar". Devolve a função para desregistrar. */
export function setBackOverride(fn: (() => boolean) | null) { override = fn; return () => { if (override === fn) override = null; }; }
/** Rota "pai" de cada tela; null = Início (minimiza o app). */
export function parentPath(pathname: string): string | null {
    if (pathname === '/' || pathname === '') return null;
    if (pathname.startsWith('/history/')) return '/history';
    if (pathname === '/settings/routes' || pathname === '/consent') return '/settings';
    return '/';
}
/** Resultado do botão voltar: 'handled' (tela tratou), 'minimize' (Início) ou o caminho para onde ir. */
export function resolveBack(pathname: string): 'handled' | 'minimize' | string {
    if (override?.()) return 'handled';
    return parentPath(pathname) ?? 'minimize';
}
