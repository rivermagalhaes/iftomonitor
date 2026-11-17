# Pendências reais — fechamento v1.2

| Item | Status | Motivo e próxima ação/comando |
|---|---|---|
| APK atualizado | NÃO TESTADO | Gradle não executado por instrução. Fora do Codex, PowerShell na raiz: `npm run android:apk`; instalar por cima e executar TESTES_ANDROID.md. |
| Exportação, GPS, rede, voltar, Wake Lock, safe areas, ícone/splash em aparelho | NÃO TESTADO | Integração escrita e verificações locais no relatório; requer novo APK e aparelho. Comando: `npm run android:apk`. |
| SQLite nativo | PARCIAL | Hoje os dados ficam no IndexedDB dentro do WebView, persistem entre aberturas, mas limpar dados/desinstalar apaga tudo. Exportação é a cópia de segurança. Adaptador `src/data/sqlite/index.ts` já implementa Repository e permanece fora do bundle. Instalar futuramente `npm install @capacitor-community/sqlite`, executar `npx cap sync android`, criar/abrir conexão SQLite com nome separado para demo/real e fornecer `new SqliteRepository(name, connection)` à fábrica de Monitor. Migrar dados existentes e validar contratos antes de mudar o padrão. Instalar o pacote sozinho não ativa o adaptador. |
| GPS com tela bloqueada | NÃO IMPLEMENTADO | Falta serviço em primeiro plano e notificação persistente. Sem comando que habilite isso hoje; desenvolver serviço/plugin compatível e depois `npm run android:apk`, teste C. |
| Login e sincronização reais Supabase | NÃO TESTADO | Sem credenciais configuradas. Preencher `.env` conforme CONFIGURACAO_SUPABASE.md, validar migration/RLS em projeto de teste, executar `npm run build` e teste D. |
| Deep link OAuth Android | PARCIAL | Listener App conectado, mas esquema/intent-filter e redirectUrl exigem revisão conjunta antes de ativar login. Configurar o manifesto com modelo em scripts/android-manifest.xml e redirect nativo; depois `npm run android:apk`. |
| Histórico autenticado offline e troca de usuários | PARCIAL | Restore consulta profile online, banco real compartilhado no aparelho e adoção de dados locais ainda precisam revisão. Executar testes com duas contas antes de ativar nuvem; `npm run test` cobre somente sync simulado. |
| SQL/RLS em servidor | NÃO TESTADO | Nenhuma migration aplicada nesta sessão. Usar projeto Supabase de teste e executar a migration revisada no SQL Editor; seguir ensaios em CONFIGURACAO_SUPABASE.md. |
| Mapa de ruas offline | NÃO IMPLEMENTADO | Tiles OSM dependem de rede; grade e trajeto local continuam. Validar teste B; nenhum comando baixa ruas nesta versão. Leaflet instalado, renderização atual SVG mantida. |
| Ícones API <26 | PARCIAL | PNGs antigos preservados como fallback autorizado; identidade adaptativa só em API >=26. `npm run android:apk`, conferir launcher em aparelho antigo se aplicável. |
| Rotas, estatística de horários, painel administrativo, múltiplos veículos (P3) | NÃO IMPLEMENTADO | Exige desenvolvimento posterior; três rótulos atuais são apenas seleção local. Sem comando de ativação. |

Nenhum pacote faltou entre os exigidos no prompt; não foi necessário npm install. Documentos antigos de tentativas são históricos, e não evidência desta sessão; o relatório v1.2 e VERIFICACAO_CORRECOES* registram a execução atual. Ajustes só limpa `ifto_monitor_demo` após confirmação e sem viagem ativa; banco real não é apagado pela interface.

Limite do ambiente: `npx cap sync android` direto falha em `os.userInfo` com ENOMEM. O sync real foi concluído com preload de compatibilidade de metadados, conforme DECISOES.md. Fora do sandbox, use o comando normal. Para repetir a verificação com fallback apenas quando essa falha ocorre: `node scripts/verify-corrections.mjs`.
