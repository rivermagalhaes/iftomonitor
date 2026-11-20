/** Login por e-mail/Google e "Modo demonstração" ficam desativados (código mantido). O monitor entra no modo campo local automaticamente.
 *  Só os testes ligam isto (VITE_AUTH_LOGIN_ENABLED=true); no app é sempre false. */
export const AUTH_LOGIN_ENABLED: boolean = import.meta.env.VITE_AUTH_LOGIN_ENABLED === 'true';
