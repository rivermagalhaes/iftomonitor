# IFTO Monitor — v1.10

Aplicativo de ensino do IFTO, Campus Paraíso do Tocantins, para registrar percursos e paradas do transporte escolar. Coordenação: Prof. Dr. River Souza Magalhães. Correções e evidências: [relatório final](docs/RELATORIO_FINAL.md).

A interface mantém a identidade visual e as abas Início, Viagem e Histórico. Ajustes fica no cabeçalho. O projeto Android e os plugins Capacitor já estão instalados. As correções atuais exigem novo APK e repetição dos testes físicos; Gradle não foi executado nesta sessão.

## Executar

Na raiz `C:\dev\ifto-monitor`, com Node compatível com o lockfile:

```powershell
# Somente para uma instalação nova, com acesso à rede.
npm ci
# Inicia o aplicativo web no endereço local mostrado pelo Vite.
npm run dev
# Gera e verifica o APK no PowerShell fora do Codex (JDK 21 e SDK Android).
npm run android:apk
```

Envie `android/app/build/outputs/apk/debug/app-debug.apk` ao celular e instale por cima, preservando os dados quando identificação e assinatura forem as mesmas. Consulte [instalação](docs/GUIA_INSTALACAO.md) para Windows, SDK, cabo, WhatsApp/Drive e memória do Gradle.

## Modos e uso

- Demonstração: dados fictícios em `ifto_monitor_demo`, saudação Olá!, paradas automáticas e botão para alternar imobilidade. Relógio acelerado: um segundo representa um intervalo GPS. Pendentes visuais zero e sincronização desativada. Ajustes permite apagar somente esse banco após confirmação e sem viagem ativa.
- Campo local: dados reais em `ifto_monitor`, sem dependência da nuvem. Apelido e termo obrigatórios; autorize localização antes de iniciar. Android usa Geolocation nativo; navegador exige localhost ou HTTPS. HTTP pelo IP do computador não permite testar GPS web no celular.
- Autenticado: cliente Supabase PKCE e sincronização preparados. Sem credenciais, login e sincronização reais NÃO TESTADO. Consulte as pendências antes de ativar.

Defina o Nome do ônibus em Ajustes ou em Viagem (Ônibus 01/02/03 ou Outro), escolha o veículo e a rota e inicie. O nome fica salvo no aparelho e cada viagem guarda seu próprio nome, device_id e versão de origem. Alterar a configuração depois não muda o nome de viagens anteriores. A duração mínima de parada pode ser 10/15/20/30 s (padrão 15 s).

No Android, a coleta em segundo plano usa o serviço nativo já integrado, mediante localização o tempo todo e notificação. No primeiro uso o assistente do modo Monitor pede localização o tempo todo, avisos e a isenção de bateria (diálogo oficial do Android); ver docs/MODOS.md. O indicador não garante que o fabricante manterá o processo vivo. Sem segundo plano, mantenha app aberto e tela acesa; Wake Lock tenta manter a tela ativa. O vigia reinicia a captura quando deixa de receber pontos e a reabertura recupera a mesma viagem. Pausar/retomar registra eventos e a pausa intencional não dispara o vigia.

No detalhe, selecione CSV de pontos, GeoJSON e/ou CSV de eventos e toque Exportar selecionados. CSV de pontos também preserva o arquivo de paradas. Android grava os arquivos no cache e abre um compartilhamento conjunto; se o destino declarar que não aceita múltiplos arquivos, compartilha individualmente. Cancelamentos não reabrem o diálogo automaticamente. Navegador usa downloads Blob. Arquivos usam UTF-8 com BOM para CSV, vírgula como separador e escape de aspas/vírgulas/quebras de linha.

Cabeçalho fixo do CSV de pontos (mesmo vazio):

`trip_id,bus_label,route,seq,recorded_at,recorded_at_local,latitude,longitude,accuracy_m,speed_mps,accepted,source,device_id,gap_before_s,suspect,app_version`

Cabeçalho do CSV de eventos (`_eventos.csv`):

`trip_id,bus_label,route,event_type,occurred_at,occurred_at_local,detail,app_version`

UTC continua sendo a fonte de verdade. Campos locais usam o fuso atual do aparelho no formato YYYY-MM-DD HH:mm:ss; nomes de arquivo usam o início local (ex.: `ifto-monitor_Onibus-01_Serrano_20261116-0735_73ac0f2b.csv`). GeoJSON inclui bus_label, app_version, started_at_local e ended_at_local no percurso, além dos eventos e lacunas. Histórico, detalhe e eventos exibem hora local. Viagens antigas recebem bus_label/app_version vazios; o nome do arquivo pode usar o antigo nome do veículo como alternativa.

Armazenamento ativo é IndexedDB v3 também no WebView, com migração sem apagar viagens/pontos; limpar dados/desinstalar apaga viagens. Exporte para cópia de segurança. SQLiteRepository existe, mas não está ativado no bundle. Pontos imprecisos continuam no CSV bruto como rejeitados e são excluídos de mapa/distância/paradas.

A versão tem fonte única em package.json (1.10.0); interface, novas viagens e Android versionName usam esse valor. Android versionCode: 11000. Nenhum APK é gerado pelos testes web.

Mapa usa SVG com tiles OpenStreetMap e grade local quando sem rede. Leaflet está instalado, porém a renderização existente foi preservada. Não há ruas offline. Não registre nomes de estudantes.

## Verificar o código

| Comando | Finalidade |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run test` | Unidades, interface, SQLite Node e IndexedDB Chromium real |
| `npm run build` | Compilação web |
| `npx cap sync android` | Copia dist e registra plugins locais |
| `npm run android:sync` | Build e sync |
| `npm run android:open` | Abre Android Studio |
| `npm run android:apk` | Ambiente, manifesto, build, sync, Gradle e validação ZIP |
| `node scripts/verify-corrections.mjs` | Repete as verificações locais e grava logs, sem Gradle |

Testes de IndexedDB exigem Chromium do Playwright instalado. Em máquina nova, `npx playwright install chromium` disponibiliza-o. O teste SQLite usa node:sqlite. Verificações locais não substituem [testes Android A–F](docs/TESTES_ANDROID.md).

## Estrutura e guias

`src/` contém interface, serviços, persistência e textos em `src/i18n/pt-BR.ts`. `tests/` contém testes; `scripts/`, ferramentas; `android/`, plataforma existente; `supabase/migrations/`, SQL preparado; `docs/`, documentação; `referencia/`, instruções recebidas.

[Alunos](docs/GUIA_ALUNOS.md) · [Capacitor](docs/GUIA_CAPACITOR.md) · [Supabase](docs/CONFIGURACAO_SUPABASE.md) · [Privacidade](docs/PRIVACIDADE.md) · [Decisões](docs/DECISOES.md) · [Pendências](docs/PENDENCIAS.md).
