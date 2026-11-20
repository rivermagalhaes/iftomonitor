// Binding explícito para a etapa de integração Capacitor, bloqueada nesta máquina.
// Não há importação falsa nem plugin simulado usado em produção.
import { t } from '../i18n/pt-BR';
import { exchangeCallback } from '../services/auth';
export interface NativeAppApi {
    addListener(event: 'backButton', listener: (event: {
        canGoBack: boolean;
    }) => void): Promise<{
        remove(): Promise<void>;
    }>;
    addListener(event: 'appUrlOpen', listener: (event: {
        url: string;
    }) => void): Promise<{
        remove(): Promise<void>;
    }>;
    exitApp(): Promise<void>;
    minimizeApp?(): Promise<void>;
}
/** `onBack` (v2.3): trata o botão voltar do Android pelas rotas do app; sem ele mantém o comportamento antigo (histórico do navegador/sair). */
export async function bindNativeApp(app: NativeAppApi, isRecording: () => boolean, onAuth: () => Promise<void>, onBack?: () => void) {
    const back = await app.addListener('backButton', event => {
        if (onBack) { onBack(); return; }
        if (event.canGoBack) {
            history.back();
            return;
        } if (!isRecording() || window.confirm(t.closeConfirm))
            void app.exitApp();
    });
    const url = await app.addListener('appUrlOpen', event => { if (event.url.startsWith('br.edu.ifto.monitor://auth/callback'))
        void exchangeCallback(event.url).then(onAuth); });
    return async () => { await back.remove(); await url.remove(); };
}
