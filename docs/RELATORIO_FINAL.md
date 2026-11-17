# Fechamento v1.10 - Onibus unico, paradas e CSV completo

17/11/2026. Versao 1.10.0, Android versionCode 11000; versionName deriva de package.json. Relatorios anteriores abaixo sao historicos.

## Secao 0 - diagnostico e localizacao

Screens.tsx monta Viagem/Inicio/Historico. StartTrip.tsx tinha duas escolhas: BusLabel (app_meta.bus_label, persistida pelo Monitor) e vehicles com selecao e lapis proprios. TripService.start gravava vehicle_id da segunda escolha e bus_label da primeira. StopDetector (services/stops.ts) detecta paradas; TripService.updateStops persiste; manualStop gravava chegada e saida iguais com duracao zero. services/export.ts exportava paradas sem onibus, versao e horas locais.

## Secoes 1 a 3 - entrega

- Campo unico Onibus: 01/02/03/Outro livre; sem selecao, iniciar desativado com mensagem solicitada e validacao no Monitor. Nome no topo de Viagem e Inicio. Configuracoes > Onibus permite renomear Outro pelo lapis.
- vehicleForBus cria/seleciona automaticamente o veiculo interno pelo nome persistido. Ao entrar no modo prepara esse registro; ao iniciar ignora veiculo divergente. Preferencia v1.8 prevalece. Viagens antigas mantem seus snapshots.
- Manual dentro de automatica: mesma viagem, distancia menor que 30 m e sobreposicao ou intervalo menor que 60 s. Mantem intervalo, duracao e status da automatica, marca detected_by=auto+manual e manually_confirmed, exibindo selo de confirmacao manual.
- Manual isolada: chegada no toque, saida aberta e duracao positiva; fecha apos dois pontos aceitos consecutivos acima do limite ou ao finalizar. Velocidade ausente usa deslocamento descontando precisao. Operacao serializada com GPS. Automatica detectada depois reutiliza o registro manual.
- mergeStops agrupa duplicatas antigas somente em memoria: snapshot do Monitor para Inicio/Historico/mapas/contagens, counts do repositorio, CSV e GeoJSON. Nao apaga registros antigos; status e intervalo da automatica prevalecem.
- CSV de paradas tem cabecalho fixo com 15 colunas mesmo vazio. Metadados da viagem, UTC preservado e hora local YYYY-MM-DD HH:mm:ss no fuso do aparelho. Nome segue prefixo dos pontos e sufixo _stops.csv, com sem-rota quando necessario; Demo preserva marcador demo.

Cabecalho: `stop_id,trip_id,bus_label,route,arrived_at,arrived_at_local,departed_at,departed_at_local,duration_s,latitude,longitude,status,label,detected_by,app_version`.

## Secao 4 - arquivos e verificacao

Alterados: package.json, package-lock.json, android/app/build.gradle, README.md; src/data/models.ts e repository.ts; src/services/monitor.ts, trip.ts, stops.ts e export.ts; src/components/BusLabel.tsx e StartTrip.tsx; src/screens/Screens.tsx; tests/export.test.ts, navigation.test.tsx, v13.test.tsx, v16.test.tsx, v17.test.tsx e v18.test.tsx; docs/RELATORIO_FINAL.md e TESTES_CAMPO.md. Adicionados tests/v110.test.tsx e supabase/migrations/0002_stop_manual_confirmation.sql.

Nova migracao SQL aceita auto+manual e adiciona manually_confirmed; nao aplicada em servidor nesta sessao. Novos testes cobrem selecao unica, migracao/persistencia, inicio bloqueado, manual dentro de automatica e anterior a deteccao, dois pontos em movimento, fechamento, agrupamento imutavel e limites de tempo/distancia/viagem, cabecalho, horas locais, metadados e arquivo compartilhado.

Sem instalacao de pacotes, Gradle ou APK. Trabalho somente na pasta existente. Validacao final: npm run typecheck PASSOU; npm run lint PASSOU; npm test PASSOU (152 testes, 19 arquivos, incluindo 8 novos testes v1.10); npm run build PASSOU. Vite emitiu somente os avisos de diretivas use client do lucide-react. dist atualizado pelo build. Testes fisicos do roteiro ficam para o aparelho.

---

# Fechamento v1.9 — Aviso condicional de gravação

16/11/2026. Versão 1.9.0, Android versionCode 10900. Esta seção descreve a entrega atual; relatórios anteriores abaixo são históricos. Sem instalação de pacotes, Gradle, cópias do projeto ou geração de APK. Trabalho restrito à raiz existente.

## Localização e reaproveitamento

O texto fixo estava em StartTrip.tsx, via t.permissionReason. O estado existente vem de Monitor.gpsDiagnostics e BackgroundNativeProvider, com permissões de localização/notificações e backgroundActive. O guia Gravação confiável já persiste batteryConfirmed e oferece openSettings. Shell já trata appStateChange e visibilitychange chamando reconnectNative, que atualiza diagnósticos e reconcilia o serviço. Esses listeners foram reaproveitados, sem duplicação.

## Comportamento entregue

- Verde: localização o tempo todo, notificações e disponibilidade nativa confirmadas, bateria confirmada no guia. Durante uma viagem, também exige serviço ativo, gravação efetiva e ausência de pausa. Mensagem solicitada: “Gravação em segundo plano ativa. Pode apagar a tela.” Antes da viagem, indica as condições disponíveis para iniciar, sem iniciar coleta.
- Amarelo durante o uso: orienta manter aberto/tela acesa ou conceder o tempo todo; botão usa openSettings do provider existente. Em navegador sem essa ação, oferece o guia existente.
- Amarelo de atenção: notificações bloqueadas/desconhecidas, bateria não confirmada ou serviço/diagnóstico indisponível, com atalho ao guia Gravação confiável. A API atual não detecta restrição de bateria: o aviso informa que a confirmação é manual, sem inventar detecção automática. Mudanças de bateria exigem atualizar a confirmação no guia.
- Vermelho: localização negada, com botão Permitir localização pelo requestPermission existente. Iniciar viagem conserva o fluxo original de educação, checklist e pedido de permissão; amarelo/verde não acrescentam bloqueio ao botão.
- Todas as faixas têm ícone, texto legível, região de status/alerta e “Nenhuma localização é coletada fora da viagem.” Demo informa simulação e não promete GPS real. Nenhuma faixa usa apenas cor para comunicar estado.

RecordingReadiness consulta os diagnósticos ao montar na tela Viagem e assina o snapshot do Monitor. O retorno do segundo plano usa o ciclo existente do Shell; a consulta também ocorre sem viagem ativa. Falha na consulta invalida o diagnóstico anterior para evitar verde com informações antigas. reliableRecording foi reaproveitado e passou a exigir disponibilidade nativa. Nenhum serviço, permissão Android ou fluxo de coleta foi criado em duplicidade. Safe-area e paleta existentes preservadas.

## Testes e validação desta sessão

| Comando | Resultado |
|---|---|
| npm run typecheck | PASSOU, código 0 |
| npm run lint | PASSOU, código 0 |
| npm test | PASSOU, 144 testes em 18 arquivos; 0 falhos; código 0 |
| npm run build | PASSOU, código 0; avisos existentes de use client do Lucide |

Oito casos novos em tests/v19.test.tsx: os quatro estados com privacidade/ícone e botão Iniciar disponível; notificações; configurações/pedido de permissão; reavaliação ao abrir e voltar pelo ciclo existente, incluindo retirada e restauração de o tempo todo; falha de diagnóstico sem manter verde anterior. A suíte anterior passou integralmente.

Logs reais: QA_V19_TYPECHECK.log, QA_V19_LINT.log, VERIFICACAO_V19_TESTES.txt e QA_V19_BUILD.log, todos em docs/. Versões de package.json/package-lock e versionCode/versionName foram conferidas por leitura local. versionName continua derivado de package.json (1.9.0), sem segunda fonte de versão. Interface e novas viagens já usam APP_VERSION dessa mesma fonte. Dados históricos mantêm suas versões originais.

## Arquivos criados e alterados

Criados:

- src/components/RecordingReadiness.tsx
- tests/v19.test.tsx
- docs/QA_V19_TYPECHECK.log
- docs/QA_V19_LINT.log
- docs/VERIFICACAO_V19_TESTES.txt
- docs/QA_V19_BUILD.log

Alterados:

- src/components/StartTrip.tsx — retirada do aviso fixo.
- src/screens/Screens.tsx — faixa na tela Viagem, antes e durante a gravação.
- src/services/monitor.ts — estado derivado, confiabilidade e invalidação de diagnóstico em falha.
- src/i18n/pt-BR.ts — mensagens condicionais e frase de privacidade.
- src/style.css — apresentação acessível da faixa, mantendo tokens e safe-area.
- package.json e package-lock.json — versão 1.9.0, sem mudar dependências.
- android/app/build.gradle — versionCode 10900; versionName herda 1.9.0.
- docs/RELATORIO_FINAL.md e docs/TESTES_CAMPO.md — entrega e roteiro v1.9.

npm run build regenerou dist/index.html e os assets de produção no diretório existente. Não foi executado cap sync nesta tarefa: android:apk já faz build e sync antes do Gradle quando o usuário o executar.

## Validação em aparelho

NÃO TESTADO nesta sessão. TESTES_CAMPO.md orienta conferir verde com permissões corretas/bateria confirmada, retirar o tempo todo e conferir amarelo ao retornar, restaurar permissões, bloquear notificações, negar localização e testar a confirmação manual da bateria. Não se apresenta teste simulado como coleta real com tela apagada.

Pronto para gerar o APK: wsl --shutdown; cd C:\dev\ifto-monitor; npm run android:apk

---

## Relatórios históricos anteriores à v1.9

# Relatório final — IFTO Monitor v1.2

Fechamento em 14/11/2026, na raiz `C:\dev\ifto-monitor`. Prompt `referencia/PROMPT_CORRECOES_v1.2.md` lido integralmente. Sem instalação de pacotes, Gradle, cap add ou cópia paralela do projeto. **APK não gerado pelo agente.**

Lint, TypeScript e build: código 0. **47 testes no total: 47 passados, 0 falhos, em 11 arquivos.** Sync Android real concluído com os cinco plugins instalados, com o fallback de metadados explicado abaixo. Chromium verificou o build de produção em largura 390 px, sem erros JavaScript nem transbordamento nas cinco telas.

`PRONTO` indica verificação local pelos comandos desta sessão; não implica validação física. `PARCIAL` distingue código integrado de comportamento ainda dependente do celular. As novas correções em aparelho permanecem **NÃO TESTADO**.

## Itens do prompt

| Item | Status | Entrega e evidência |
|---|---|---|
| 1.1 Exportação | PARCIAL | Filesystem Cache/UTF-8 + Share com URI/nome; CSV com BOM e paradas separado; Blob web mantido; sucesso/erro real visíveis. Testes export/corrections/native-export passaram; Chromium baixou os três arquivos. Android físico NÃO TESTADO. |
| 1.2 Paradas | PRONTO | Teste de 5 min, cadência aproximada de 18s, jitter 3–10m e rejeitado: uma parada de 300s. Mínimo absoluto de 15s para detecção automática; lacuna max(60s, configuração, 3 × intervalo); desconto da incerteza na velocidade inferida e mesclagem por local/lacuna. Testes de saída, movimento e lacuna passaram. Em campo NÃO TESTADO. |
| 1.3 Safe areas | PARCIAL | Viewport-fit=cover e insets no cabeçalho/rodapé conferidos; banner demo corrigido. Início, Viagem, Histórico, detalhe e Ajustes sem overflow no Chromium. Barra de status/recorte Android NÃO TESTADO. |
| 1.4 Precisão | PRONTO | Math.round na exibição; teste exige Precisão: 20 m para 20.01300048828125. Valor bruto preservado. |
| 1.5 Tela acesa | PARCIAL | Wake Lock solicitado durante captura, readquirido em visibilitychange e liberado ao encerrar/desmontar; aviso claro se indisponível/falhar. Teste de ciclo passou; aviso inspecionado no Chromium. Aparelho NÃO TESTADO. |
| 1.6 Cadência | PARCIAL | Limiar ≥0,9 × intervalo testado. Plugin recebe interval explícito, alta precisão, maximumAge=0, minimumUpdateInterval de 0,9 × intervalo e timeout no mínimo 30s ou 3 × intervalo. Achado interval=timeout documentado em DECISOES. Cadência real Android NÃO TESTADO. |
| 2.1 GPS/permissões | PARCIAL | Geolocation nativo com check/request/watch; navegador usa API web. Permissão resolvida antes de criar viagem; negação, negação permanente e GPS desligado tratados/testados por contrato. Baixa precisão aparece na interface. Sync registra plugin. Aparelho NÃO TESTADO. |
| 2.2 Rede e voltar | PARCIAL | Network alimenta indicador; App inicializa backButton/appUrlOpen. Testes de rede, limpeza de listener e saída durante gravação apenas após confirmação passaram. Aparelho NÃO TESTADO. |
| 2.3 Demonstração | PRONTO | Paradas automáticas pelo mesmo detector; Olá!, pendentes=0 na UI e counts, sync bloqueado com nota. Chromium testou cancelar/confirmar limpeza; IndexedDB real confirmou que o banco real é preservado. |
| 2.4 Ícone/splash | PARCIAL | BusFront Lucide branco, fundo #79A83B, splash #F8FBF5; XMLs analisados sem erro e icon/roundIcon preservados. PNGs antigos como fallback API <26. Compilação de recursos e aparência instalada NÃO TESTADO. |
| 2.5 Comando APK | PRONTO | android:apk detecta JDK/SDK, verifica manifesto, build/sync, Wrapper --no-daemon, ZIP/entradas APK, caminho/tamanho/horário e orientação de memória. Helpers testados; node --check e verificador de manifesto passaram. Gradle/produto APK NÃO TESTADO nesta sessão, conforme instrução. |
| 2.6 Documentação | PRONTO | README, .env.example e os nove documentos exigidos revisados e verificados. Guias incluem Windows, JDK 21, SDK, APK, cabo/WhatsApp/Drive, Play Protect, Depuração USB e memória, com comandos comentados. |
| 2.7 Campo observado | PRONTO | TESTES_ANDROID registra somente os relatos fornecidos, como observado pelo usuário em 14/11/2026: 0 pontos/manifesto, depois 8 pontos/145s/posição/~20m, paradas divididas e exportação falha. Novas correções NÃO TESTADO em campo; B–F NÃO TESTADO e resultados em branco. |
| 2.8 Pendências | PRONTO | PENDENCIAS explica IndexedDB ativo, perda ao limpar/desinstalar e exportação como backup; SQLiteRepository existente e testado, fora do bundle, com orientação de ativação. GPS bloqueado NÃO IMPLEMENTADO, Supabase NÃO TESTADO e P3 registrados. |

## Evidência e limites

O `npx cap sync android` direto falhou antes da cópia: `os.userInfo()` retornou `uv_os_get_passwd / ENOMEM`. A nova execução usou NODE_OPTIONS carregando `scripts/terminal-info-compat.cjs`. Esse fallback trata somente a falha de metadados do terminal usando variáveis do processo. Não altera node_modules nem simula plugins. **O sync real retornou código 0**, copiou dist e registrou App 8.1.2, Filesystem 8.1.5, Geolocation 8.2.4, Network 8.0.1 e Share 8.0.3. O preload não integra o aplicativo nem o comando normal de APK. `node scripts/verify-corrections.mjs` reproduz a tentativa direta e usa fallback somente nessa falha.

O build emitiu avisos de diretivas use client do Lucide ignoradas, sem impedir compilação. Não houve aparelho, Java/AAPT, Gradle ou chamada real ao Supabase nesta sessão. Testes de contratos/bindings não substituem validação física de permissões, rede, compartilhamento, Wake Lock ou GPS.

No Chromium de produção: saudação/sync demo, parada automática sem clique, download GeoJSON e CSVs de pontos/paradas, histórico após reload e cancelar/confirmar limpeza passaram. Nas cinco telas, cabeçalho visível, rodapé dentro da viewport, viewport-fit=cover e nenhum overflow. Insets físicos não são reproduzidos pelo desktop. Evidência: VERIFICACAO_WEB.json e VERIFICACAO_WEB.png. O teste IndexedDB executa num navegador isolado e preservou registro real durante a limpeza demo; nenhum banco de um celular foi acessado.

## Pendências reais

- Gerar e instalar o APK atualizado e repetir A–F. C continua sem garantia por ausência de serviço em primeiro plano.
- IndexedDB permanece ativo no WebView. Limpar dados/desinstalar apaga viagens; exportação é backup. SQLite nativo PARCIAL: adaptador existente, conexão/plugin/migração não ativados. Futuramente: `npm install @capacitor-community/sqlite`, integrar a fábrica de Repository e migrar, depois `npx cap sync android`.
- GPS com tela bloqueada: NÃO IMPLEMENTADO. Manter app visível e tela ligada.
- Login/Supabase/sync reais: NÃO TESTADO, sem credenciais. Intent-filter/redirect nativo, restauração offline, troca de usuários, adoção de dados e SQL/RLS precisam validação antes de ativar nuvem.
- Mapa de ruas offline NÃO IMPLEMENTADO. SVG/tiles OSM mantidos; Leaflet está instalado. PNGs antigos abaixo da API 26 preservados.
- Rotas, estatística de horários, painel administrativo e múltiplos veículos como produto: P3, NÃO IMPLEMENTADO.

Motivos e próximos comandos em PENDENCIAS.md. Não foi instalado pacote nem executado Gradle.

## Gerar e instalar

Em PowerShell fora do Codex, na pasta `C:\dev\ifto-monitor`:

```powershell
npm run android:apk
```

Envie `android/app/build/outputs/apk/debug/app-debug.apk` ao celular e instale por cima. Com a mesma identificação e assinatura, o Android atualiza preservando os dados. Não desinstale para atualizar. Consulte GUIA_INSTALACAO.md para cabo ou WhatsApp/Drive.

## Validação adicional executada

Python/ElementTree analisou 7 XMLs sem erro; as duas permissões e GPS required=false estão presentes. Os 11 documentos exigidos foram lidos como UTF-8 e estão preenchidos. Os 9 pacotes exigidos estão declarados e instalados. Todos os 9 arquivos de dist coincidem byte a byte com a cópia nativa. O adaptador SQLite permanece fora do bundle ativo.

## Arquivos criados

Inventário por hashes antes/depois; não há .git nesta pasta. Inclui arquivos produzidos pelo sync. Arquivos temporários dos testes foram removidos.

- `android/app/src/main/assets/public/assets/index-CPj8J83D.css`
- `android/app/src/main/assets/public/assets/index-D0GJEV_N.js`
- `android/app/src/main/assets/public/assets/web-B90TBm9c.js`
- `android/app/src/main/assets/public/assets/web-BRef9qiY.js`
- `android/app/src/main/assets/public/assets/web-D006yO7m.js`
- `android/app/src/main/assets/public/assets/web-D4fL-Sox.js`
- `android/app/src/main/assets/public/assets/web-MiNKoBss.js`
- `android/app/src/main/res/drawable/ic_launcher_foreground.xml`
- `docs/VERIFICACAO_CORRECOES.json`
- `docs/VERIFICACAO_CORRECOES.txt`
- `scripts/check-android-manifest.mjs`
- `scripts/check-corrections-browser.mjs`
- `scripts/terminal-info-compat.cjs`
- `scripts/verify-corrections.mjs`
- `tests/build-apk.test.ts`
- `tests/corrections.test.ts`
- `tests/native-export.test.ts`

## Arquivos alterados

- `.env.example`
- `README.md`
- `android/app/src/main/assets/public/index.html`
- `android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml`
- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml`
- `android/app/src/main/res/values/ic_launcher_background.xml`
- `android/app/src/main/res/values/styles.xml`
- `android/gradle.properties`
- `docs/CONFIGURACAO_SUPABASE.md`
- `docs/DECISOES.md`
- `docs/GUIA_ALUNOS.md`
- `docs/GUIA_CAPACITOR.md`
- `docs/GUIA_INSTALACAO.md`
- `docs/PENDENCIAS.md`
- `docs/PRIVACIDADE.md`
- `docs/RELATORIO_FINAL.md`
- `docs/TESTES_ANDROID.md`
- `docs/VERIFICACAO_WEB.json`
- `docs/VERIFICACAO_WEB.png`
- `package.json`
- `scripts/build-apk.mjs`
- `src/app/App.tsx`
- `src/data/models.ts`
- `src/data/repository.ts`
- `src/i18n/pt-BR.ts`
- `src/screens/Screens.tsx`
- `src/services/export.ts`
- `src/services/location.ts`
- `src/services/monitor.ts`
- `src/services/network.ts`
- `src/services/stops.ts`
- `src/style.css`
- `tests/indexeddb.test.ts`
- `tests/navigation.test.tsx`
- `tests/sqlite.test.ts`

## Bundles antigos substituídos pelo sync

- `android/app/src/main/assets/public/assets/index-D5xj2fyn.js`
- `android/app/src/main/assets/public/assets/index-Dat8JSXC.css`

## Saída web gerada/regenerada

Dist não teve hashes iniciais coletados; lista precisa dos arquivos atuais, sem inventar distinção anterior entre criação e alteração:

- `dist/assets/Geist-Regular-5U7sAi-B.ttf`
- `dist/assets/index-CPj8J83D.css`
- `dist/assets/index-D0GJEV_N.js`
- `dist/assets/web-B90TBm9c.js`
- `dist/assets/web-BRef9qiY.js`
- `dist/assets/web-D006yO7m.js`
- `dist/assets/web-D4fL-Sox.js`
- `dist/assets/web-MiNKoBss.js`
- `dist/index.html`

## Saídas reais da verificação final

Conteúdo de VERIFICACAO_CORRECOES.txt, com a falha direta e o sucesso do sync real usando compatibilidade de metadados:

```text
> npm run lint
Código: 0

> ifto-monitor@1.0.0 lint
> eslint src tests


> npm run typecheck
Código: 0

> ifto-monitor@1.0.0 typecheck
> tsc --noEmit


> npm run test
Código: 0

> ifto-monitor@1.0.0 test
> node scripts/test.mjs


 RUN  v5.0.5 C:/dev/ifto-monitor


 Test Files  11 passed (11)
      Tests  47 passed (47)
   Start at  21:07:43
   Duration  23.52s (environment 62%, tests 17%, setup 14%, import 5%, transform 2%)

    Isolate  11 workers spawned · ~1.36s startup each (spawn + environment, per file)
             at least ~13.61s faster with isolate: false — reuses workers across files instead of one per file


> npm run build
Código: 0

> ifto-monitor@1.0.0 build
> tsc --noEmit && vite build --configLoader runner

vite v7.3.8 building client environment for production...
transforming...
✓ 2028 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                           0.42 kB │ gzip:  0.30 kB
dist/assets/Geist-Regular-5U7sAi-B.ttf  125.96 kB
dist/assets/index-CPj8J83D.css            8.96 kB │ gzip:  2.80 kB
dist/assets/web-D006yO7m.js               0.36 kB │ gzip:  0.25 kB
dist/assets/web-D4fL-Sox.js               0.84 kB │ gzip:  0.40 kB
dist/assets/web-MiNKoBss.js               1.15 kB │ gzip:  0.55 kB
dist/assets/web-B90TBm9c.js               2.30 kB │ gzip:  0.93 kB
dist/assets/web-BRef9qiY.js               8.67 kB │ gzip:  2.95 kB
dist/assets/index-D0GJEV_N.js           308.59 kB │ gzip: 98.68 kB
✓ built in 3.07s
node_modules/lucide-react/dist/esm/context.mjs (2:0): Module level directives cause errors when bundled, "use client" in "node_modules/lucide-react/dist/esm/context.mjs" was ignored.
node_modules/lucide-react/dist/esm/Icon.mjs (2:0): Module level directives cause errors when bundled, "use client" in "node_modules/lucide-react/dist/esm/Icon.mjs" was ignored.

> npx cap sync android
Código: 1
node:os:306
    throw new ERR_SYSTEM_ERROR(ctx);
    ^

SystemError [ERR_SYSTEM_ERROR]: A system error occurred: uv_os_get_passwd returned ENOMEM (not enough memory)
    at Object.userInfo (node:os:306:11)
    at getShell (C:\dev\ifto-monitor\node_modules\@ionic\utils-terminal\dist\info.js:16:26)
    at Object.<anonymous> (C:\dev\ifto-monitor\node_modules\@ionic\utils-terminal\dist\info.js:36:12)
    at Module._compile (node:internal/modules/cjs/loader:1854:14)
    at Object..js (node:internal/modules/cjs/loader:1985:10)
    at Module.load (node:internal/modules/cjs/loader:1577:32)
    at Module._load (node:internal/modules/cjs/loader:1379:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:255:19)
    at Module.require (node:internal/modules/cjs/loader:1600:12)
    at require (node:internal/modules/helpers:153:16) {
  code: 'ERR_SYSTEM_ERROR',
  info: {
    errno: -4057,
    code: 'ENOMEM',
    message: 'not enough memory',
    syscall: 'uv_os_get_passwd'
  },
  errno: [Getter/Setter],
  syscall: [Getter/Setter]
}

Node.js v24.16.0

> npx cap sync android
NODE_OPTIONS: preload scripts/terminal-info-compat.cjs (fallback de metadados do terminal)
Código: 0
√ Copying web assets from dist to android\app\src\main\assets\public in 9.98ms
√ Creating capacitor.config.json in android\app\src\main\assets in 999.30μs
√ copy android in 31.26ms
√ Updating Android plugins in 3.79ms
[info] Found 5 Capacitor plugins for android:
       @capacitor/app@8.1.2
       @capacitor/filesystem@8.1.5
       @capacitor/geolocation@8.2.4
       @capacitor/network@8.0.1
       @capacitor/share@8.0.3
√ update android in 52.36ms
[info] Sync finished in 0.115s
[terminal-info] os.userInfo indisponível (ENOMEM); usando variáveis do terminal.

> node --check scripts/build-apk.mjs
Código: 0

> node --check scripts/check-android-manifest.mjs
Código: 0

> node scripts/check-android-manifest.mjs
Código: 0
Manifesto: FINE e COARSE presentes.
```


## Correções v1.3

Changelog 1.3 — 14/11/2026.

### Arquivos e resultados

- `src/components/PageLayout.tsx`: layout único contendo cabeçalho, todas as rotas e o fluxo Login/Onboarding/Consentimento.
- `src/app/App.tsx`: aplica o layout e aviso informativo com X e expiração em 8 s.
- `src/style.css`: safe-area superior `max(env(safe-area-inset-top), 12px)`, margem inferior incluindo navegação e safe-area; aviso neutro #EDF3E6/#2E5328 e lista de coordenadas acessível. Banner Demo integrado ao fluxo para não disputar espaço com a barra de status.
- `src/screens/Screens.tsx`: ações por status da parada; sincronização desabilitada sem nuvem; contagem de registros locais em vez de pendentes sem nuvem.
- `src/i18n/pt-BR.ts`: textos das novas ações, contador e mensagem informativa solicitada.
- `src/services/monitor.ts`: tentativa manual de sincronização indisponível gera aviso, sem erro vermelho.
- `src/components/TripMap.tsx`: `fitBounds` calculado na projeção SVG existente, margem de 32 px, zoom máximo 18 e zoom 17 para um ponto ou todos os pontos separados por menos de 30 m; polilinha #79A83B/4, início/fim e paradas numeradas por status; fallback com coordenadas sem OSM.
- `src/services/stops.ts`: retorno ao mesmo local após lacuna de 70 s preserva o grupo, sem alterar os parâmetros de configuração.
- `src/services/trip.ts`: parada manual com duração zero, ponto aceito mais próximo do instante do toque e bloqueio de duplicatas em menos de 5 s.
- `scripts/build-apk.mjs`: propriedades Gradle idempotentes, consulta de memória virtual no Windows, aviso abaixo de 3 GiB sem impedir build, limpeza de `hs_err_pid*.log` em `android/`, log em `docs/BUILD_ANDROID.log` com últimas 40 linhas na falha e verificação final do manifesto e APK (caminho, bytes e data).
- `android/gradle.properties`: removida duplicidade de `org.gradle.jvmargs`, mantido Xmx1536m e demais limites solicitados.
- `.gitignore`: ignora `hs_err_pid*.log`.
- `tests/v13.test.tsx`: 16 testes novos, cobrindo as cinco trilhas sintéticas, manuais, status, rotas/safe-area, sincronização, mapa, idempotência Gradle e remoção de cada permissão do manifesto.
- `docs/TESTES_CAMPO.md`: checklist completo de instalação e validação no aparelho.

`index.html` já continha `viewport-fit=cover` e foi preservado. `scripts/check-android-manifest.mjs` já falhava na ausência de FINE ou COARSE; os novos testes verificam cada remoção separadamente. As permissões e o recurso GPS do manifesto foram preservados.

### Decisões autônomas

- Reaproveitar o mapa SVG e implementar seu enquadramento `fitBounds`, sem trocar a biblioteca nem instalar dependências.
- Para conciliar o novo cenário de 70 s com o teste existente de separação em 80 s, tolerar até um intervalo GPS adicional somente quando o retorno está no mesmo raio. A configuração máxima de lacuna permanece igual; locais diferentes ou lacunas maiores continuam separando grupos. O intervalo sem amostras compõe a duração estimada da parada.
- Sem nuvem, contar todos os registros persistidos nas quatro tabelas de dados, em vez de somente os marcados como pendentes.
- Usar o instante da solicitação manual para a janela de 5 s, preservando a coordenada e os horários do ponto GPS mais próximo.
- Registrar a versão 1.3 neste relatório, pois não há CHANGELOG no projeto. Não executar instalação de dependências nem Gradle, conforme solicitado.

### Pendências

SQLite nativo; GPS com tela bloqueada/serviço nativo em primeiro plano; login real e sincronização com Supabase; ícone adaptativo a verificar no aparelho. O APK desta revisão deve ser gerado pelo usuário fora do sandbox e o checklist de campo ainda precisa ser executado.


### Qualidade e entrega v1.3

Comandos executados na ordem solicitada, após as alterações:

| Comando | Resultado |
| --- | --- |
| `npm run lint` | OK, código 0 |
| `npm run typecheck` | OK, código 0 |
| `npm test` | OK, código 0; 63 testes em 12 arquivos (47 existentes + 16 novos) |
| `npm run build` | OK, código 0; avisos não impeditivos de `use client` do lucide-react |
| `npx cap sync android` | OK na segunda tentativa, código 0; cinco plugins Android sincronizados |

A primeira tentativa do Capacitor falhou em `os.userInfo`, com `uv_os_get_passwd`/ENOMEM neste ambiente Windows restrito. Decisão adicional: reutilizar o arquivo existente `scripts/terminal-info-compat.cjs`, sem alterá-lo, com `$env:NODE_OPTIONS='--require=./scripts/terminal-info-compat.cjs'` na segunda tentativa. Esse contorno trata apenas a consulta de metadados do terminal; a sincronização efetiva concluiu normalmente. Não foram executados Gradle, instalação de dependências nem geração de APK.

Feche Chrome/Word/Edge, rode `wsl --shutdown` e depois `cd C:\dev\ifto-monitor; npm run android:apk`


## Paleta v1.4

Atualização visual de 15/11/2026.

| Token | Antes | Agora |
| --- | --- | --- |
| Primária | #79A83B | #2F9E41 |
| Hover/pressionado | sem token | #278A38 |
| Verde escuro | #2E5328 | #1F6B2C |
| Verde claro | #A8CF66 | #7FCB6A |
| Fundo de apoio | #EDF4E5 / #EDF3E6 e oliva equivalente | #E6F4E8 |
| Vermelho | #D83232 | preservado |
| Fundo da tela | #F8FBF5 | preservado |

Arquivos alterados:

- `src/tokens.css`: fonte única de tokens web, incluindo neutros verdes, bordas e sombras.
- `tailwind.config.cjs`: nomes da paleta apontam para as variáveis CSS, sem duplicar hexadecimais.
- `src/style.css`: logotipo, navegação ativa, botões, selos, aviso, banner Demo, cartão escuro e cores auxiliares usam tokens. Texto do cartão escuro branco; Demo mantém banner exclusivo.
- `src/components/TripMap.tsx`: linha, grade e marcadores usam os mesmos tokens.
- `index.html` e `capacitor.config.ts`: tema e fundo nativo na nova primária.
- `android/app/src/main/res/values/ic_launcher_background.xml`: fundo adaptativo sólido #2F9E41.
- `android/app/src/main/res/values/colors.xml` e `values/styles.xml`: primária, splash e barras do sistema alinhadas; barras #1F6B2C com ícones claros.
- `android/app/src/main/res/drawable/ic_launcher_background.xml`: substituído o fundo padrão por referência à cor institucional.
- `android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher{,_round,_foreground}.png`: 15 imagens regeneradas, incluindo primeiro plano transparente, mantendo dimensões existentes.
- `android/app/src/main/res/drawable*/splash.png`: 11 imagens regeneradas, preservando dimensões e orientações.
- `src/assets/android/icon.svg`, `icon.png` e `splash.png`: fontes visuais atualizadas.
- `scripts/generate-assets.mjs`: somente o gerador visual passou a ler a primária dos tokens para não reintroduzir oliva. Scripts de build não alterados.
- `tests/v13.test.tsx`: asserção de cor da polilinha atualizada para o token.

Decisões: manter o BusFront vetorial branco existente, centralizado e ocupando cerca de 46% da largura total (incluindo traço), dentro da zona segura central de 66%. Os XMLs adaptativos já referenciam esse vetor e o fundo por recurso. Os PNGs foram rasterizados localmente com Chromium, sem instalações nem pastas novas. Não existem favicon ou ícones PWA independentes no projeto.

Contraste branco: #2F9E41 = 3,45:1; #278A38 = 4,39:1; #1F6B2C = 6,57:1. Como até o hover solicitado fica abaixo de 4,5:1, os botões primários usam uma derivação acessível do token #278A38 (96% da cor + 4% preto), com escurecimento para 94% no hover/pressionado. Os valores solicitados continuam preservados nos tokens institucionais.

GPS, exportação, banco, permissões do manifesto e scripts de build preservados. APK e Gradle não executados; ícone adaptativo e barras do sistema ainda requerem conferência final no aparelho.


Verificação final v1.4, na ordem solicitada:

| Comando | Resultado |
| --- | --- |
| `npm run lint` | OK |
| `npm run typecheck` | OK |
| `npm test` | OK: 63 testes em 12 arquivos |
| `npm run build` | OK; avisos não impeditivos de `use client` do lucide-react |
| `npx cap sync android` | OK na segunda tentativa, cinco plugins sincronizados |

A primeira tentativa do Capacitor encontrou novamente ENOMEM em `uv_os_get_passwd`. A segunda usou somente nesta sessão `$env:NODE_OPTIONS='--require=./scripts/terminal-info-compat.cjs'`, contorno já existente, sem modificar scripts de build.

Conferência adicional em Chromium sobre o build: primária #2F9E41, cartão #1F6B2C com texto branco, Demo #7FCB6A, navegação ativa #2F9E41 e fundo #F8FBF5 confirmados. Contraste efetivo do botão: **4,74:1**, acima de 4,5:1. Os 15 PNGs do launcher foram examinados: nenhum pixel opaco #79A83B. A varredura de fontes web não encontrou os tons oliva antigos. Hashes do manifesto, GPS, viagens, exportação e script de build coincidem com o início da tarefa.


## Símbolo v1.5

Atualização visual de 15/11/2026: ônibus frontal original branco, com painel branco de cantos arredondados, letras IF verdes feitas de caminhos geométricos e pingo vermelho dentro do painel. Sem fontes instaladas, download ou reprodução de marca oficial. `referencia/logo-if-oficial.svg` não existe; foi adotado o desenho geométrico solicitado.

Arquivos alterados:

- `src/assets/android/symbol.json`: geometria única, compartilhada pelo componente e pelo gerador, com cores derivadas dos tokens existentes.
- `src/components/LogoIF.tsx`: componente SVG único, quadrado arredondado verde, acessível e sem texto/fontes no desenho.
- `src/app/App.tsx`: substitui BusFront por LogoIF no cabeçalho comum ao Login/Onboarding e a todas as telas.
- `src/style.css`: remove dimensão antiga do SVG interno e permite que LogoIF ocupe o quadrado inteiro, mantendo 60 px ou 48 px conforme a largura da tela.
- `scripts/generate-assets.mjs`: somente o gerador visual passou a derivar SVG, vetores Android e PNGs da mesma geometria; scripts de build preservados.
- `src/assets/android/icon.svg`, `icon.png`, `splash.png`: atualizados com o novo símbolo.
- `android/app/src/main/res/drawable/ic_launcher_foreground.xml` e `drawable-v24/ic_launcher_foreground.xml`: primeiro plano vetorial colorido, grade 108x108.
- `android/app/src/main/res/drawable/ic_launcher_monochrome.xml`: silhueta branca com painel, IF, pingo e faróis vazados por preenchimento evenOdd.
- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` e `ic_launcher_round.xml`: referenciam primeiro plano colorido e versão monocromática para Android 13+.
- `android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher{,_round,_foreground}.png`: 15 PNGs regenerados, incluindo primeiro plano transparente, preservando dimensões.
- `android/app/src/main/res/drawable*/splash.png`: 11 imagens atualizadas nas dimensões existentes, fundo #2F9E41 e novo símbolo.
- `tests/logo-if.test.tsx`: dois testes para cores exatas do pingo/letras, desenho sem fonte e consistência dos vetores/adaptativos/monocromático.

Decisões: usar carroceria com retrovisores entre x=24 e x=84, total de 60 unidades, na grade 108x108; silhueta contida no círculo central de diâmetro 66. Painel frontal grande, letras com altura de cerca de 70% do painel, pingo acima do I com folga. A versão monocromática usa vazados reais, sem verde ou vermelho. Não existem favicon ou ícones PWA independentes a atualizar. Não foram criadas pastas nem cópias do projeto. PNGs produzidos localmente com Chromium, sem instalação de dependências.

Paleta, fundo adaptativo #2F9E41 e barras do sistema #1F6B2C preservados. Manifesto/permissões, GPS, exportação, banco de dados e scripts de build não alterados. Gradle e geração do APK não executados. A aparência em launcher real, ícones temáticos Android 13+ e splash continua sujeita à conferência no aparelho.


Verificação final v1.5, comandos na ordem solicitada:

| Comando | Resultado |
| --- | --- |
| `npm run lint` | OK |
| `npm run typecheck` | OK |
| `npm test` | OK: 65 testes em 13 arquivos, incluindo os dois novos testes do símbolo |
| `npm run build` | OK; avisos não impeditivos de `use client` do lucide-react |
| `npx cap sync android` | OK na segunda tentativa; cinco plugins sincronizados |

O Capacitor inicialmente falhou em `uv_os_get_passwd`/ENOMEM, erro de metadados deste terminal. A segunda tentativa reutilizou `$env:NODE_OPTIONS='--require=./scripts/terminal-info-compat.cjs'`, contorno já existente, sem modificar scripts de build.

Conferência em Chromium sobre o build: cabeçalho com LogoIF em 60 px e 48 px, pingo #D83232 e letras #2F9E41, inclusive no onboarding. O primeiro plano transparente foi rasterizado e medido: raio máximo de 32,72 unidades, abaixo das 33 unidades da zona segura. Os caminhos do monocromático foram renderizados para confirmar IF e pingo transparentes, com painel e carroceria opacos. Hashes de manifesto, GPS, viagens, exportação, paleta, build e contratos de dados coincidem com o início da tarefa.


## GPS em segundo plano v1.6

Implementação de 15/11/2026, com o extra de proteção da barra de status em todas as telas.

### Arquivos alterados e comportamento

- `src/services/background-location.ts`: novo `BackgroundNativeProvider`, selecionado automaticamente para viagens reais no Android com o plugin disponível. Usa a API instalada de `@capgo/background-geolocation` **8.6.4**, major compatível com Capacitor 8. Web/ausência do plugin usam ForegroundProvider; Demo permanece simulado e isolado.
- `src/services/location.ts`: abstração ampliada para diagnóstico, lote e recuperação; permissões de primeiro plano verificadas sem solicitar em Ajustes. Simulação não solicita permissões reais.
- `src/services/trip.ts`: deduplica timestamps persistidos na retomada, recebe lotes ordenados, mantém todas as amostras nativas, inclusive rejeitadas por precisão, marca `suspect` e `gap_before_s`, e importa a cauda do registro antes de finalizar. Reclassifica pontos seguintes quando recebe uma amostra atrasada. A extensão de paradas é calculada uma vez por lote.
- `src/services/monitor.ts`: seleção do provider, registro da explicação inicial por banco local, diagnóstico e retomada automática de viagem nativa ativa. A volta ao primeiro plano relê o registro nativo e atualiza o IndexedDB.
- `src/services/stops.ts`: amostras rejeitadas por precisão, com velocidade zero e coordenadas exatamente iguais ao último ponto aceito, prolongam internamente uma parada (`stationary_extended`). Sem parada iniciada, são apenas evidência pendente: um novo ponto bom e parado precisa confirmar antes que produzam parada. Coordenadas diferentes não estendem o grupo. Dados GPS originais continuam rejeitados e preservados para exportação.
- `src/lib/geo.ts`: análise compartilhada de trechos, lacunas maiores que `max(60 s, 3 x intervalo GPS)` e velocidades médias acima de 200 km/h. Distância exclui saltos de lacuna e trechos suspeitos.
- `src/data/models.ts`: campos opcionais `suspect`, `gap_before_s` e intervalo GPS por viagem, sem migração destrutiva. `src/data/repository.ts`: leitura cronológica dos pontos; sequências/IDs existentes preservados.
- `src/services/export.ts`: CSV inclui `gap_before_s` e `suspect`; GeoJSON possui trilhas contínuas, pontos aceitos com os campos novos e features `LineString` de tipo `gap` separadas. Mantidos Filesystem + Share, privacidade e arquivos de paradas.
- `src/components/TripMap.tsx`: polilinhas verdes por segmento, lacunas em tracejado cinza fino, dois marcadores por lacuna e legenda Sem sinal por mm:ss. Enquadramento, cores, marcadores de paradas e fallback sem OSM preservados.
- `src/screens/Screens.tsx`: explicação inicial com Continuar/Agora não; indicador verde ou amarelo e aviso persistente quando segundo plano estiver desativado; resumos com contagem/tempo de lacunas e selo Gravação incompleta; exportação usa intervalo da viagem.
- `src/components/GpsDiagnostics.tsx`: permissões, provider, hora de recebimento do último ponto, média dos últimos 10 pontos do mesmo percurso, consulta sem prompt e acesso aos Ajustes. Inclui orientação de bateria Sem restrições.
- `src/app/App.tsx`: retorno nativo ao primeiro plano aciona recuperação. Wake lock preservado; sua orientação de manter tela acesa fica restrita à captura sem segundo plano. `src/i18n/pt-BR.ts`: orientação de captura atualizada.
- `src/components/PageLayout.tsx` e `src/style.css`: uma única faixa fixa de altura `env(safe-area-inset-top)`, fundo opaco #F8FBF5 e z-index 10000, acima inclusive de diálogos, protege relógio/ícones durante a rolagem em todas as rotas. Safe-area e navegação inferior preservadas.
- `android/app/src/main/res/values/styles.xml`: barra de status #F8FBF5 com ícones escuros, coerente com a faixa; navegação inferior mantida na paleta atual.
- `android/app/src/main/AndroidManifest.xml`: FINE, COARSE, BACKGROUND_LOCATION, FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION e POST_NOTIFICATIONS declaradas explicitamente; recurso GPS e permissões anteriores mantidos. O manifesto do plugin declara o serviço com `foregroundServiceType="location"`.
- `scripts/check-android-manifest.mjs`: exige todas as seis permissões e, quando válido, imprime Manifesto: permissões de localização e segundo plano presentes.
- `android/app/src/main/res/values/strings.xml`: canal de gravação e ícone de notificação `drawable/ic_launcher_monochrome` já existente. Título IFTO Monitor e mensagem Gravando percurso do transporte escolar definidos no provider.
- `capacitor.config.ts`: `android.useLegacyBridge: true`, conforme README instalado para evitar interrupção da ponte após cinco minutos.
- `tests/v16.test.tsx` e `tests/v16-browser.test.ts`: cenários adicionais funcionais, integração de provider/permissões, paradas congeladas e rolagem com safe-area em Chromium. Fixtures antigas do verificador do manifesto e da distância foram adequadas às novas regras; nenhum teste existente foi removido.
- `docs/TESTES_CAMPO.md`: checklist de permissões, bolso/tela bloqueada por 10 minutos, bateria, retomada, lacunas, exportação e faixa de status.

### Decisões e limites

- API consultada localmente no README, tipos e código Android instalados, sem consulta de rede, instalação ou Gradle. `minIntervalMs: 10000` é um pedido ao GPS Android, não garantia de periodicidade exata; `distanceFilter: 0`, `stale: false`, GPS nativo e `networkFallback: false` priorizam precisão. O filtro final de aceitação permanece em no máximo 50 m.
- Habilitado `locationLog: true`, backend nativo em arquivo (SQLite opcional do plugin desabilitado). Esse registro continua com a WebView suspensa e é lido em páginas de 1000 amostras, filtrado pelo início da viagem, ordenado por `time` e deduplicado no IndexedDB por timestamp. A cauda é importada antes do fim da viagem.
- O registro nativo é limitado a 100000 pontos e não é apagado antes de confirmar persistência, evitando perda na retomada. Seu limite e remoção automática dos mais antigos são os oferecidos pelo plugin; não há envio nativo a servidor. A sequência local permanece estável; cálculos e exportações usam ordem cronológica.
- Agora não ou negar segundo plano/notificações inicia a viagem com o provider de primeiro plano e aviso amarelo. Não há promessa de captura com tela bloqueada nesse estado. Ajustes permite revisar permissões; ao retornar ao aplicativo com uma viagem ativa, novas concessões promovem automaticamente a captura para o serviço nativo, e revogações rebaixam para primeiro plano. O estado também é verificado ao iniciar outra viagem.
- Os sete pontos congelados, sozinhos, não iniciam parada. A fixture com os horários e estados descritos no teste real confirma retroativamente a evidência com dois pontos bons: duração esperada 95 s. Como não foi fornecido arquivo GPS bruto com as coordenadas originais, foram usadas coordenadas sintéticas anônimas; não se afirma um deslocamento constante verificável sobre coordenadas originais indisponíveis. A precisão ruim não é convertida em trajetória aceita.
- Manifestos mesclados existentes em `android/app/build/intermediates` foram inspecionados: são de build anterior, contendo apenas FINE/COARSE e sem o novo serviço. Não foram adulterados. O próximo build Gradle deve mesclar as declarações explícitas e o serviço do plugin; isso permanece para conferência ao gerar o APK.
- Dependem do aparelho: permissão o tempo todo, notificação persistente, captura com tela bloqueada por 10 minutos, comportamento de bateria Motorola/outros, status bar nativa e retomada real. Encerrar o processo ou forçar parada pode interromper o serviço; este modo local não usa a opção de POST nativo que permitiria outro ciclo de vida. Não foi gerado APK nem executado Gradle. Permanecem pendentes SQLite nativo da aplicação, login real e sincronização Supabase.


Correção adicional de robustez encontrada na validação: `src/data/indexeddb/index.ts` agora aguarda o término das transações de leitura/escrita antes de fechar a conexão. Isso evita a corrida intermitente entre leituras em conclusão e a exclusão do banco Demo, sem mudar esquema, nomes ou isolamento dos bancos. Também foi testada uma nova tentativa de captura após falha inicial do fallback, para não deixar o provider marcado como iniciado sem sensor ativo.


### Qualidade e entrega v1.6

| Comando (ordem executada na rodada final) | Resultado |
| --- | --- |
| `npm run lint` | OK, código 0 |
| `npm run typecheck` | OK, código 0 |
| `npm test` | OK, código 0: **91 testes em 15 arquivos**, 65 existentes e 26 novos |
| `npm run build` | OK, código 0; avisos não impeditivos `use client` de lucide-react |
| `npx cap sync android` | OK na segunda tentativa, código 0: **6 plugins**, incluindo Capgo 8.6.4 |

A primeira tentativa de sync reutilizou o contorno existente de `os.userInfo`/ENOMEM por caminho relativo, mas o novo hook `capacitor:sync:before` do plugin executa em outro diretório e não encontrou esse caminho. A segunda usou `$env:NODE_OPTIONS='--require=C:/dev/ifto-monitor/scripts/terminal-info-compat.cjs'` e concluiu. Nenhum script de build foi alterado para esse contorno; apenas o verificador de manifesto recebeu as novas exigências solicitadas.

A sincronização atualizou os arquivos gerados `android/capacitor.settings.gradle`, `android/app/capacitor.build.gradle` e recursos de `android/app/src/main/assets/`, confirmando a inclusão do módulo `capgo-background-geolocation`, sua classe nativa e `useLegacyBridge: true`. Não equivale a compilação Gradle.

A rodada final do navegador validou a faixa opaca #F8FBF5, fixa no topo e com 28 px de safe-area emulada, nas rotas Início, Viagem, Histórico, Detalhe, Ajustes e Consentimento, além da presença no Login/Onboarding. Foi usado o mesmo conjunto de módulos React locais que o servidor de desenvolvimento do projeto, sem downloads. Para tornar o teste independente de configuração externa, Campo local foi habilitado somente no servidor do teste. O contraste e o logotipo IF no ônibus não foram alterados.

**Pendente de teste no aparelho:** novo APK e manifesto mesclado atual, localização o tempo todo/notificações, serviço com tela bloqueada por 10 minutos, pontos ~10–20 s, bateria Sem restrições, retomada sem duplicatas, fim da notificação ao encerrar e proteção da barra de status nativa durante rolagem. Sem Gradle, instalação de dependências ou geração de APK nesta execução.

Feche Chrome/Word/Edge, rode `wsl --shutdown` e depois `cd C:\dev\ifto-monitor; npm run android:apk`


## Gravação resiliente e rotas v1.7

Executadas as seções 0 a 6, sem rede, instalação de pacotes ou Gradle.

### Arquivos alterados

- Dados: src/data/models.ts, repository.ts, indexeddb/index.ts e sqlite/index.ts: routes, campos route_id/route_name/events e migrações idempotentes, preservando registros existentes. Campo local e Demo continuam isolados.
- Serviços: src/services/trip.ts, monitor.ts, location.ts, background-location.ts e routes.ts: vigia de 15 s, recuperação na mesma viagem, eventos e gestão de rotas. Escritas da viagem são serializadas com pontos para preservar rota e eventos.
- Interface: src/App.tsx, src/screens/Screens.tsx, src/components/StartTrip.tsx, Routes.tsx, RecordingReliability.tsx, GpsDiagnostics.tsx e src/style.css: retomada por appStateChange/visibilitychange, banner, guia Motorola, checklist de 24 h, estado e idade do último ponto, rotas e filtros no Histórico.
- Exportação: src/services/export.ts: route após trip_id, rota no nome do arquivo e route/route_id/events no GeoJSON. Eventos CSV usam arquivo complementar _events.csv, somente quando existem eventos.
- Testes: tests/v17.test.tsx, indexeddb.test.ts, sqlite.test.ts, export.test.ts e v16.test.ts.
- Documentação: docs/RELATORIO_FINAL.md, TESTES_CAMPO.md, ROTAS_SUPABASE.md e CONFIGURACAO_SUPABASE.md. Assets web Android atualizados pelo cap sync.

### Decisões e limites

- API Capgo 8.6.4 consultada localmente: oferece start/stop, log nativo e openSettings, mas não consulta de estado do serviço. Ausência de pontos é indício de interrupção, não prova de encerramento pelo Android. Antes de reiniciar, o vigia importa o log nativo e considera o horário original da amostra; limite max(45 s, 3 × intervalo). Tentativas concorrentes são agrupadas e repetições respeitam esse limite.
- Viagem mantém o ID e deduplica pontos por timestamp. Novo ponto restaura o estado verde; falha de reinício mostra Parada. Eventos de interrupção, retomada, reabertura e edição de rota são persistidos e exibidos no detalhe.
- O vigia JS depende do processo vivo. Se o Android matar o processo, a recuperação ocorre ao reabrir; não há garantia de execução JS durante suspensão. Guia de bateria e teste físico continuam necessários.
- Rotas validam 2 a 60 caracteres, recusam duplicação ignorando caixa/acentos/espaços e permitem desativação sem apagar histórico. Renomear atualiza viagens vinculadas. Viagens antigas aparecem Sem rota; iniciar sem rota é permitido.
- Supabase recebeu somente documentação de esquema, políticas e ordem futura de sincronização. Nenhuma nuvem foi alterada. Sincronização e permissões reais de coordenador dependem dessa implementação futura.
- Hashes antes/depois confirmam preservação do AndroidManifest, tokens, símbolo/LogoIF, cálculo de lacunas, mapa e detector de paradas. Scripts de build não foram alterados.

### Verificação

| Comando | Resultado |
| --- | --- |
| npm run lint | OK, código 0 |
| npm run typecheck | OK, código 0 |
| npm test | OK, código 0: 121 testes em 16 arquivos (91 anteriores e 30 adicionais) |
| npm run build | OK, código 0; avisos não impeditivos use client do lucide-react |
| npx cap sync android | OK, código 0; 6 plugins, incluindo Capgo 8.6.4 |

Sync usou o contorno existente de ENOMEM/os.userInfo: NODE_OPTIONS=--require=C:/dev/ifto-monitor/scripts/terminal-info-compat.cjs, com caminho absoluto. Nenhum pacote instalado. Testes cobrem migração repetida de bancos antigos IndexedDB e SQLite sem perder viagens/pontos/rotas, isolamento Demo, vigia, reabertura, checklist, interface e exportações.

**Depende do aparelho:** gerar/instalar APK, confirmar permissões e notificação, bloquear a tela por 30 minutos com o celular no bolso sem abrir o app, verificar ausência de lacunas, bateria Motorola, recuperação após suspensão/encerramento e exportações reais. Roteiro em docs/TESTES_CAMPO.md. Nenhum APK foi gerado nesta execução.

Feche Chrome/Word/Edge, rode `wsl --shutdown` e depois `cd C:\dev\ifto-monitor; npm run android:apk`


## Entrega v1.8.0 - 16/11/2026

### 0. Diagnóstico antes das alterações

Já existiam a tabela local routes, trips.route_id/route_name, seleção e criação de rota ao iniciar, edição no histórico, watchdog com importação do log antes de reiniciar e eventos recording_interrupted, recording_resumed, app_restarted, route_changed e route_edited. A coluna route já existia no código local da v1.7. Eventos tinham exportação auxiliar automática _events.csv, sem seleção independente. Histórico e detalhe já usavam Date.toLocaleString; horários de eventos usavam toLocaleTimeString.

Lacunas confirmadas: nome de arquivo calculado a partir do ISO UTC, CSV sem recorded_at_local/bus_label/app_version, ausência de nome persistente do ônibus, duração configurável limitada artificialmente a 15 s e eventos incompletos. package.json/interface estavam em 1.0.0, Android versionName em 1.0 e versionCode em 1.

### 1 a 5. Implementação

- src/lib/time.ts: localTimestamp usa Intl e fuso atual do aparelho; UTC original permanece intacto. Exportações GeoJSON incluem started_at_local/ended_at_local, bus_label e app_version no percurso.
- src/services/export.ts: 16 colunas fixas na ordem solicitada, inclusive valores vazios e arquivos sem pontos; escape CSV mantido. Nome usa hora local, nome do ônibus, slug da rota e oito caracteres do ID. Legado usa nome do veículo apenas como alternativa no nome do arquivo.
- src/components/BusLabel.tsx: escolhas Ônibus 01/02/03 e Outro; armazenamento em app_meta no mesmo banco das configurações, nome no Início e checklist, escolha exigida na tela antes de iniciar.
- src/data/models.ts, src/data/indexeddb/index.ts e src/data/repository.ts: IndexedDB v3 migra objetos trips, preservando todos os campos e pontos. Viagens antigas recebem bus_label/app_version vazios. Inicialização idempotente mantém compatibilidade do contrato de repositórios; SQLite continua inativo.
- src/services/trip.ts: novos registros guardam bus_label, device_id e APP_VERSION no início. Recuperação usa o snapshot original; nunca substitui versão/identidade pelo aparelho atual. Início, fim, pausa, retomada e reinício pelo vigia são persistidos; watchdog_restarted inclui seconds_without_points. Pausa intencional permanece na mesma viagem e não dispara o vigia.
- src/services/monitor.ts: transições GPS e mudanças de permissão viram eventos. Reabertura e alterações de rota existentes continuam preservadas. Configuração de bateria é confirmada manualmente; permissões de localização o tempo todo e notificação vêm do diagnóstico. Indicador Gravação confiável: OK/atenção tem atalho para o guia.
- src/screens/Screens.tsx, src/components/StartTrip.tsx e src/components/RecordingReliability.tsx: eventos recolhidos abaixo do mapa; seleção independente de CSV de pontos, GeoJSON e CSV de eventos. Compartilhamento nativo envia todas as URIs juntas; destino com erro explícito de falta de suporte usa envios individuais. Cancelar não provoca nova tentativa automática. busy é liberado no finally existente.
- src/services/stops.ts: respeita 10/15/20/30 s, padrão 15 s. UI usa seletor, alteração salva para as próximas viagens. O piso defensivo passou a 10 s.
- package.json é a única fonte da versão 1.8.0: src/config/version.ts alimenta interface e viagem, android/app/build.gradle lê o mesmo JSON para versionName. versionCode aumentou de 1 para 10800. package-lock.json acompanha a versão sem alterar dependências.

Cabeçalho de pontos:

`trip_id,bus_label,route,seq,recorded_at,recorded_at_local,latitude,longitude,accuracy_m,speed_mps,accepted,source,device_id,gap_before_s,suspect,app_version`

Cabeçalho de eventos (_eventos.csv):

`trip_id,bus_label,route,event_type,occurred_at,occurred_at_local,detail,app_version`

### 6. Testes, documentação e limites

Novos testes em tests/v18.test.tsx cobrem cabeçalho exato, valores vazios, UTC-3 e virada de data, escape, nome local, GeoJSON, todos os tipos de eventos, limites de parada, seleção/persistência do nome, snapshot ao recuperar, pausa/retomada, GPS/permissão, indicador e compartilhamento/fallback/cancelamento. tests/indexeddb.test.ts usa Chromium e bancos reais antigos v1/v2 para verificar preservação de viagens/pontos, defaults novos e migração idempotente. Testes existentes ajustados: export, native-export, navigation, v16 e v17. Script scripts/check-corrections-browser.mjs atualizado para a escolha do ônibus e os quatro arquivos selecionados no build de produção.

Documentação atualizada: README.md, docs/TESTES_CAMPO.md e docs/CHANGELOG.md. Logs finais: docs/QA_V18_TYPECHECK.log, QA_V18_LINT.log, QA_V18_TESTES.log, QA_V18_BUILD.log e QA_V18_BROWSER.log. Evidências visuais usam os caminhos existentes docs/VERIFICACAO_WEB.json e VERIFICACAO_WEB.png.

Sem instalação de pacotes, Gradle ou geração de APK. Logo, ícone, paleta, tokens e CSS de safe-area preservados. Nenhuma nuvem ou banco de celular foi acessado. Sincronização remota de rotas continua uma pendência documentada da v1.7; antes de habilitar nuvem, o esquema remoto também precisará de bus_label/app_version e paused. Esta entrega opera na persistência local existente.

Horários locais refletem o fuso do aparelho no momento da consulta/exportação; o UTC permite recalcular se o aparelho mudar de fuso. O plugin não fornece verificação automática da restrição de bateria neste fluxo: a confirmação manual é visível no guia. WhatsApp real, fabricante Android e coleta com tela bloqueada devem ser validados pelo roteiro de campo; navegador e mocks não substituem isso.


### Resultado final da v1.8

| Verificação | Resultado |
| --- | --- |
| npm run typecheck | OK, saída 0 |
| npm run lint | OK, saída 0 |
| npm test | OK, 136 testes em 17 arquivos, saída 0 |
| npm run build | OK, saída 0; avisos existentes de use client do lucide-react |
| node scripts/check-corrections-browser.mjs | OK, quatro downloads, eventos recolhidos, persistência e cinco telas sem overflow |

O roteiro de navegador passou a medir layout no topo após os cliques (que podem rolar a página). O seletor do aviso de sucesso usa .notice porque o texto do botão X também compõe o conteúdo do elemento. Nenhuma alteração visual foi necessária para essas correções do roteiro.

Arquivos de produto/configuração alterados: package.json, package-lock.json, android/app/build.gradle; src/config/version.ts; src/data/models.ts, repository.ts e indexeddb/index.ts; src/lib/time.ts; src/services/export.ts, trip.ts, monitor.ts e stops.ts; src/components/BusLabel.tsx, StartTrip.tsx e RecordingReliability.tsx; src/screens/Screens.tsx; src/i18n/pt-BR.ts. Testes, roteiro e documentação alterados estão enumerados acima. O script android:apk já executa build e cap sync android antes do Gradle, portanto copiará o dist atualizado quando o usuário gerar o APK.

Pronto para gerar o APK: wsl --shutdown; cd C:\dev\ifto-monitor; npm run android:apk


## Versão 2.0.0 — nuvem e relatos
Implementados envio anon no schema ifto_monitor, IndexedDB v4 preservando registros, funções submit-report/purge-photos, site separado e painel com login admin. Android versionCode 20000; Gradle não executado. Ativação manual: docs/NUVEM_E_RELATOS.md.

Roteiro de aceite nos aparelhos:
- Com internet, finalizar viagem e conferir Tudo sincronizado, hora e Enviada no Histórico.
- Sem internet, gravar/finalizar/exportar viagem; conferir pendência. Reconectar e verificar envio sem duplicar. Durante gravação não deve enviar.
- Desligar nuvem e reiniciar; dados permanecem. Compilar sem VITE_* e verificar gravação offline e Nuvem não configurada.
- Abrir QR de cada ônibus, enviar texto e foto, verificar aviso de privacidade e confirmação.
- Entrar como admin, filtrar relato, abrir foto, moderar, salvar nota, marcar guardar e conferir viagem relacionada.
- Limpar fotos antigas: conferir contagem e preservação de keep=true. Exportar CSV e abrir QR impresso.
- Testar usuário sem admin, limite de 10 relatos/dia, falha de rede com texto/fotos preservados e reenvio de viagem parcialmente enviada.


## Retomada e QA da v2.0 ? 2026-11-17

A implementa??o existente das partes A?D foi preservada. Nesta retomada foram alterados somente:
- `src/services/monitor.ts`: restaura??o do aviso informativo, fech?vel e tempor?rio, ao sincronizar manualmente sem nuvem configurada.
- `web/lib.ts`: filtro de viagens pela partida (e n?o pela cria??o remota), incluindo o ?ltimo milissegundo do dia final.
- `tests/v13.test.tsx`: seletor espec?fico do aviso, distinguindo-o do status permanente da nuvem.
- `tests/v110.test.tsx`: expectativa de vers?o do CSV vinculada ? vers?o atual do aplicativo.
- `tests/indexeddb.test.ts`: verifica??o real no Chromium da migra??o v3?v4, preservando viagem, ponto, parada e evento, com marcas de pend?ncia.
- `tests/reports-v2.test.ts`: regress?o para o per?odo das viagens.

Verifica??es executadas em sequ?ncia, nunca em paralelo, todas com sa?da 0:
1. `npm run typecheck` ? `docs/QA_V20_TYPECHECK.log`.
2. `npm run lint` ? `docs/QA_V20_LINT.log`.
3. `npm test` ? 179 testes em 21 arquivos; `docs/QA_V20_TESTES.log`.
4. `npm run build` ? `docs/QA_V20_BUILD.log`.
5. `npm run build:web` ? `docs/QA_V20_BUILD_WEB.log`.

Os builds foram gerados sem `.env`; apenas `.env.example` existe, com valores vazios. Os testes verificam nuvem desligada/ausente, grava??o e persist?ncia locais, isolamento dos bancos e migra??o sem apagar dados. Isso n?o substitui o teste f?sico do APK com GPS e Android em modo avi?o. A vers?o permanece 2.0.0 e o Android versionCode 20000.

Busca local de padr?es de credenciais em 104 arquivos de c?digo/documenta??o e modelos de ambiente: nenhuma ocorr?ncia de JWT, chave secreta Supabase, chave AWS ou chave privada. Nenhum segredo foi adicionado; service_role permanece restrito ?s Edge Functions. Sem `.git` nesta pasta, `git status --short` retorna ?not a git repository?; n?o foi poss?vel verificar arquivos rastreados nem hist?rico.

Documenta??o atualizada nesta retomada: este relat?rio, `docs/TESTES_CAMPO.md` e `docs/NUVEM_E_RELATOS.md`; criados/atualizados os cinco logs de QA acima. Nenhum pacote instalado, SQL aplicado, deploy ou Gradle executado. Continuam manuais a ativa??o do Supabase/segredos/admin, deploy das fun??es e site, gera??o do APK e aceite nos tr?s celulares, conforme `docs/NUVEM_E_RELATOS.md`.
