# PROMPT ÚNICO DE FECHAMENTO — IFTO MONITOR v1.2

Você é engenheiro de software sênior (React, TypeScript, Capacitor, Android, geolocalização, offline-first). O IFTO Monitor já existe nesta pasta e foi instalado em um celular Android real. Este prompt fecha **tudo o que falta**, de uma vez. Execute de ponta a ponta, **sem parar para pedir confirmação**, até o relatório final. Este prompt substitui qualquer prompt de correção anterior.

## 0. Regras de operação

1. **Esta pasta é a raiz do projeto** (`C:\dev\ifto-monitor`). Não crie pastas paralelas, cópias, `_v2`, nem arquivos fora da estrutura existente. Documentos ficam em `docs/`, scripts em `scripts/`.
2. **Não mude a identidade visual** (cores `#79A83B`, `#A8CF66`, `#2E5328`, `#D83232`, `#F8FBF5`; ônibus `BusFront` branco em quadrado oliva). Não adicione abas: a navegação continua Início, Viagem, Histórico.
3. **O sandbox desta sessão bloqueia rede e execução fora dele.** Portanto: **não rode `npm install`, não rode Gradle, não rode `cap add`**. Já estão instalados e listados no `package.json`: `@capacitor/core`, `@capacitor/android`, `@capacitor/cli`, `@capacitor/app`, `@capacitor/geolocation`, `@capacitor/network`, `@capacitor/filesystem`, `@capacitor/share`, `leaflet`. Confira. Se faltar alguma coisa, **não trave**: registre o comando exato em `docs/PENDENCIAS.md` e siga.
4. Rodam normalmente: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npx cap sync android` (local).
5. **Não remova** as permissões de localização já presentes em `android/app/src/main/AndroidManifest.xml` (`ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `uses-feature location.gps required=false`). Sem elas o app gravou 0 pontos em campo.
6. Status só com evidência: `PRONTO` (verificado por comando rodado nesta sessão), `PARCIAL`, `NÃO TESTADO` (exige celular), `NÃO IMPLEMENTADO`. Nunca escreva "pronto" sem verificar. Escreva código novo com testes quando houver lógica.
7. UI e docs em português do Brasil; código em inglês; textos da interface em `src/i18n/pt-BR.ts`.

## 1. Defeitos observados em campo (corrigir)

**1.1 Exportação CSV/GeoJSON não funciona no Android.** Usa download por Blob, que o WebView ignora. Quando `Capacitor.isNativePlatform()` for verdadeiro: gravar o arquivo com `@capacitor/filesystem` (`Directory.Cache`, UTF-8; CSV com BOM) e chamar `@capacitor/share` (`Share.share` com o `uri`, título e nome do arquivo) para o usuário escolher onde salvar ou enviar. No navegador, manter o download por Blob. Mostrar na interface mensagem de sucesso ("Arquivo pronto para compartilhar") ou o texto real do erro. Nunca falhar em silêncio. Exportar também o arquivo de paradas (CSV) conforme o prompt original.

**1.2 Detecção de paradas divide uma parada longa em várias curtas.** Com o celular parado alguns minutos foram criadas 3 paradas de 18 a 22 s, com intervalos sem parada. Reproduza em teste unitário (parado por 5 min, pontos a cada ~18 s, jitter de 3 a 10 m, precisão de 10 a 30 m), ache a causa (centroide/raio reiniciando o grupo; lacuna máxima de 30 s curta demais para a cadência real do Android; pontos `accepted=false` quebrando o grupo) e corrija. Esperado: **uma** parada com a duração total. Lacuna máxima padrão = 3 × o intervalo configurado, mínimo 60 s. Mescle paradas consecutivas do mesmo local (centroides a menos que o raio, intervalo menor que a lacuna máxima). **Nenhuma parada pode ser criada antes de atingir a duração mínima (15 s)**: uma apareceu com 6 s de viagem.

**1.3 Cabeçalho cortado sob a barra de status do Android.** Aplicar `padding-top: env(safe-area-inset-top)` e `viewport-fit=cover` (também no rodapé: `safe-area-inset-bottom`). Conferir em Início, Viagem, Histórico, detalhe e Ajustes.

**1.4 Precisão com casas demais** (`20.01300048828125 m`): exibir sem decimais.

**1.5 Tela não fica acesa na gravação.** O texto diz "quando houver suporte", mas nada mantém a tela ligada. Usar `navigator.wakeLock.request('screen')` enquanto houver viagem gravando, readquirir em `visibilitychange`, liberar ao encerrar. Sem suporte, avisar claramente que o usuário deve manter a tela ligada. Sem plugin novo.

**1.6 Cadência do GPS.** Com intervalo de 10 s saíram ~8 pontos em 145 s (~18 s). Verificar a lógica de aceitação do `ForegroundProvider` (aceitar um ponto a cada ≥ 0,9 × o intervalo) e as opções do `watchPosition` (`enableHighAccuracy: true`, `maximumAge: 0`, `timeout` adequado). Registrar em `docs/DECISOES.md` o que foi encontrado; se for limitação do Android, dizer.

## 2. Lacunas em relação ao prompt original (completar)

**2.1 GPS nativo com permissões explícitas.** No Android usar `@capacitor/geolocation` (`checkPermissions`, `requestPermissions`, `watchPosition`) no `ForegroundProvider`; no navegador, a API web. Tratar e mostrar mensagens para: permissão negada, negada permanentemente (orientar a abrir Configurações do Android > Apps > IFTO Monitor > Permissões), GPS desligado, sem sinal, precisão baixa. A viagem só inicia depois da permissão resolvida; se negada, não iniciar e explicar.

**2.2 Rede e botão voltar.** Indicador online/offline via `@capacitor/network`. Botão voltar do Android via `@capacitor/app`: navega para trás; durante gravação nunca fecha o app sem confirmação.

**2.3 Modo demonstração.** Hoje, no navegador: 393 pontos, 0 paradas, 397 "pendentes" e botão "Sincronizar agora". Corrigir: (a) a simulação deve **gerar paradas** (percurso ilustrativo em Paraíso do Tocantins com paradas de 20 a 40 s detectadas pelo mesmo algoritmo); (b) em demonstração, pendentes = 0 e "Sincronizar agora" desativado com a nota "Demonstração não sincroniza"; (c) saudação "Olá!" em vez de "Olá, Modo demonstração"; (d) botão "Limpar dados de demonstração" em Ajustes (só no modo demo, com confirmação, só apaga o banco `ifto_monitor_demo`). O modo demonstração continua totalmente isolado do real.

**2.4 Ícone e splash no Android.** O ícone atual é o padrão do Capacitor. Criar ícone adaptativo **sem ferramentas externas**: `res/drawable/ic_launcher_foreground.xml` (vector drawable do `bus-front` do Lucide, branco, centralizado, com margem de segurança), fundo `#79A83B` em `res/values/ic_launcher_background.xml`, `res/mipmap-anydpi-v26/ic_launcher.xml` e `ic_launcher_round.xml` apontando para eles, e fundo do splash `#F8FBF5`. Manter os PNGs antigos apenas como fallback para API < 26 ou substituí-los por versão com a cor da marca se for viável sem instalar nada. Conferir o `AndroidManifest.xml` (`android:icon`, `android:roundIcon`).

**2.5 Um comando para gerar o APK.** Criar `scripts/build-apk.mjs` e o script `npm run android:apk` que, em ordem: (1) detecta `JAVA_HOME` (variável de ambiente, senão `C:\Program Files\Eclipse Adoptium\jdk-*` mais recente) e `ANDROID_HOME`/`ANDROID_SDK_ROOT` (variável, senão `%LOCALAPPDATA%\Android\Sdk`) e aborta com mensagem clara se faltar; (2) roda `scripts/check-android-manifest.mjs`, que **falha** se faltar `ACCESS_FINE_LOCATION` ou `ACCESS_COARSE_LOCATION` no manifesto; (3) `npm run build`; (4) `npx cap sync android`; (5) `gradlew(.bat) assembleDebug --no-daemon` dentro de `android/`; (6) confirma que `android/app/build/outputs/apk/debug/app-debug.apk` existe, verifica que abre como zip (classes.dex, AndroidManifest.xml) e imprime caminho, tamanho e horário; (7) se o Gradle falhar por falta de memória (saída com `OutOfMemory` / "daemon disappeared"), imprime a orientação: fechar navegador/Word/Edge, `wsl --shutdown`, e rodar de novo. Garantir `android/gradle.properties` com `org.gradle.jvmargs=-Xmx1024m -Dfile.encoding=UTF-8`, `org.gradle.daemon=false`, `org.gradle.workers.max=2`. Você **não executa** o Gradle nesta sessão; apenas escreve e valida a sintaxe do script (`node --check`) e testa as funções de detecção com testes unitários onde possível.

**2.6 Documentação real, sem esqueletos.** Conferir e completar `README.md`, `.env.example`, `docs/GUIA_INSTALACAO.md` (incluir Windows, JDK 21, SDK, `npm run android:apk`, instalação do APK por cabo ou WhatsApp/Drive, Play Protect "Instalar mesmo assim", Depuração USB, erro de memória do Gradle), `docs/GUIA_CAPACITOR.md`, `docs/GUIA_ALUNOS.md` (didático, comandos comentados), `docs/TESTES_ANDROID.md`, `docs/CONFIGURACAO_SUPABASE.md`, `docs/PRIVACIDADE.md`, `docs/DECISOES.md`, `docs/PENDENCIAS.md`, `docs/RELATORIO_FINAL.md`.

**2.7 `docs/TESTES_ANDROID.md` com os resultados já observados** (registrar como "observado pelo usuário em 14/11/2026", sem inventar nada além disto):
- Primeira viagem de campo de ~2 h: **0 pontos**. Causa: APK sem permissões de localização no manifesto. Corrigido adicionando as permissões.
- Após a correção, teste A (app aberto, celular parado ~2 min 25 s): gravou pontos (8), mapa OpenStreetMap exibiu a posição, precisão ~20 m. Paradas divididas (corrigido em 1.2 — **NÃO TESTADO em campo** até novo teste).
- Exportação CSV/GeoJSON: não funcionou no Android (corrigido em 1.1 — **NÃO TESTADO em campo**).
- Testes B, C, D, E, F: **NÃO TESTADO** (coluna "Resultado observado" em branco).

**2.8 `docs/PENDENCIAS.md` honesto**, com motivo e comando de cada item:
- **SQLite nativo:** hoje os dados ficam em IndexedDB dentro do WebView (persistem entre aberturas do app, mas são apagados se o usuário limpar os dados do app ou desinstalar). Por isso a exportação é a cópia de segurança. Para migrar: o usuário instala `@capacitor-community/sqlite` e o agente liga o adaptador SQLite já previsto na camada de persistência. Se o adaptador SQLite ainda não existir no código, escreva-o atrás da mesma interface, **sem importá-lo no bundle** (para o build continuar passando sem o plugin), e documente como ativar.
- **GPS com tela bloqueada** (serviço em primeiro plano): `NÃO IMPLEMENTADO`.
- **Login real e sincronização com Supabase:** preparados, sem credenciais, `NÃO TESTADO`.
- **Rotas, estatística de horários, painel administrativo, múltiplos veículos** (P3).
- Qualquer outro limite que encontrar.

## 3. Verificação final (obrigatória)

Rode e cole as saídas reais: `npm run lint`, `npm run typecheck`, `npm run test` (total, passados, falhos), `npm run build`, `npx cap sync android`. Corrija o que falhar. Depois escreva `docs/RELATORIO_FINAL.md` com:
- tabela de itens deste prompt (1.1 a 1.6, 2.1 a 2.8) com status (`PRONTO`/`PARCIAL`/`NÃO TESTADO`/`NÃO IMPLEMENTADO`) e a evidência de cada um;
- lista exata dos arquivos criados e alterados;
- pendências reais.

Responda no chat com um resumo curto e **o comando exato** que o usuário deve rodar para gerar o APK: `npm run android:apk` (na pasta `C:\dev\ifto-monitor`, num PowerShell fora do Codex), e o que fazer depois (enviar o `app-debug.apk` ao celular e instalar por cima; o Android atualiza sem apagar os dados). Não declare o APK gerado: quem gera é o usuário.
