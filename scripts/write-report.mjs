import {readFileSync,writeFileSync,existsSync,statSync} from 'node:fs';
const read=path=>{const b=readFileSync(path);return b[0]===0xff&&b[1]===0xfe?b.toString('utf16le').replace(/^\uFEFF/,''):b.toString('utf8');};
const results=JSON.parse(read('docs/VERIFICACAO_FINAL.json'));
const passed=results.every(row=>row.exitCode===0);
const browser=JSON.parse(read('docs/VERIFICACAO_WEB.json'));
const apk='android/app/build/outputs/apk/debug/app-debug.apk';
const required=['README.md','.env.example','docs/GUIA_INSTALACAO.md','docs/GUIA_CAPACITOR.md','docs/GUIA_ALUNOS.md','docs/TESTES_ANDROID.md','docs/CONFIGURACAO_SUPABASE.md','docs/PRIVACIDADE.md','docs/DECISOES.md','docs/PENDENCIAS.md'];
if(required.some(path=>!existsSync(path)))throw new Error('Documentação obrigatória ausente');
const checks=read('docs/VERIFICACAO_FINAL.txt');
const total=checks.match(/Tests\s+(\d+) passed/);
const tests=total?Number(total[1]):null;
const report=`# Relatório final — IFTO Monitor — 14/11/2026

## Resultado da execução

**PARCIAL — entrega web verificada; integração Android bloqueada.** A execução foi retomada após a F0 e avançou pelos trabalhos possíveis das fases F1–F10 na mesma raiz. Não é correto afirmar que toda a Prioridade 1 nativa foi concluída. As limitações não interromperam a implementação web, os testes e a documentação.

Fidelidade ao protótipo: NÃO VERIFICADA — protótipo não encontrado na pasta. Status: NÃO TESTADO. referencia existe, mas contém somente PROMPT_IFTO_MONITOR_v1.1.md, lido integralmente; não há HTML ou imagens para comparação. A interface segue tokens, marca BusFront e composição textual do documento.

## Funcionalidades e evidências

| Funcionalidade | Status | Evidência desta sessão |
|---|---|---|
| React/TS strict, Tailwind v3, marca e três abas | ${passed?'PRONTO':'PARCIAL'} | Typecheck/lint/build e teste Testing Library |
| Demonstração, isolamento e termo de campo local | PRONTO | Testes de modos/contrato; banner e fluxo completo Chromium |
| IndexedDB com migração, metadados e veículos | PRONTO | Contrato comum em Chromium com índice único e reabertura |
| SQLiteRepository | PARCIAL | Mesmo contrato executado com arquivo SQLite real do Node; integração Capacitor ausente |
| Ciclo, intervalo, precisão e recuperação | PRONTO | Testes de TripService e ForegroundProvider com API de localização simulada |
| GPS real em aparelho e tela acesa | NÃO TESTADO | Não foi observado GPS real; navegador usa navigator.geolocation e Wake Lock |
| Plugins Geolocation/Network/keep-awake Android | NÃO IMPLEMENTADO | Pacotes nativos indisponíveis; contratos preparados sem conexão concreta |
| Paradas automáticas, manuais, edição e distância | PRONTO | Onze cenários de paradas/distância; confirmação no fluxo de interface |
| Histórico, detalhe, ajustes e mapa SVG fallback | PRONTO | Testes de UI e Chromium; mapa com tiles bloqueados; sem erro de página ou overflow a 390 px |
| Leaflet solicitado | NÃO IMPLEMENTADO | Indisponível no cache; SVG Web Mercator usado como desvio explícito |
| CSV e GeoJSON no navegador | PRONTO | Testes BOM/escape/colunas/privacidade/lon-lat; download GeoJSON observado em Chromium |
| Compartilhamento Android | PARCIAL | NativeFiles implementado como contrato; Filesystem/Share não instalados |
| Ícone BusFront e splash fonte | PRONTO | generate-assets executado; PNGs em src/assets/android |
| Android, ícone adaptativo instalado e APK | PARCIAL | cap add/sync tentados, falharam sem CLI; nenhum projeto Android ou APK gerado |
| Supabase PKCE e login real | PARCIAL | Cliente protegido por isSupabaseConfigured, indisponibilidade testada; serviço real NÃO TESTADO |
| Sync com cliente simulado | PRONTO | Lotes, ordem, idempotência, retry, IDs e concorrência testados; sync real NÃO TESTADO |
| Migrations/RLS e deep link | PARCIAL | SQL, modelo manifest e binding escritos; lint SQL e runtime nativo NÃO TESTADO |
| GPS com tela bloqueada | NÃO IMPLEMENTADO | Não foi possível avaliar metadados do candidato; nenhum plugin escolhido |
| Documentação exigida | PRONTO | Existência conferida por write-report; conteúdo escrito para a entrega real |
| Testes Android A–F | NÃO TESTADO | Roteiro completo, resultados observados em branco |

## Fases e portões

| Fase | Status | Resultado |
|---|---|---|
| F0 | PARCIAL | Ambiente e versões web conferidos; compatibilidade nativa não verificável sem registro |
| F1 | PRONTO | Base, build e navegação testados |
| F2 | PARCIAL | Contrato comum verde em IndexedDB e SQLite; conexão Android pendente |
| F3 | PRONTO | Demo/campo, consentimento e isolamento testados; login fica preparação P2 |
| F4 | PARCIAL | Ciclo/recuperação e provider web testados; plugin nativo pendente |
| F5 | PRONTO | Cenários obrigatórios de paradas e distância verdes |
| F6 | PARCIAL | Telas e fallback verificados; Leaflet e Network nativo ausentes |
| F7 | PARCIAL | Formatos e download web verificados; Share Android pendente |
| F8 | PARCIAL | Assets/config gerados; cap add/sync falharam; sem APK |
| F9 | PARCIAL | Sync mock e cliente auth preparados; SQL e integração nativa não validados |
| F10 | ${passed?'PRONTO':'PARCIAL'} | Documentos e comandos finais executados; pendências expostas |

Os portões web foram executados durante o desenvolvimento e corrigidos antes das etapas seguintes de código. Bloqueios nativos da P1 foram mantidos como pendências enquanto a preparação P2 e a documentação avançaram, conforme a orientação de continuar os demais trabalhos. Isso não converte um portão nativo bloqueado em aprovação.

## Ambiente Android e tentativa real

Node v24.16.0; npm 11.13.0. Java não está no PATH e JAVA_HOME está vazio. A inspeção complementar encontrou e executou Temurin 21.0.13 em C:/Program Files/Eclipse Adoptium/jdk-21.0.13.9-hotspot/bin/java.exe. O diretório C:/Program Files/Java/jdk-21 não tinha bin/java.exe.

SDK em C:/Users/river/AppData/Local/Android/Sdk, plataformas android-26,31,33-ext5,34-ext12,35; build-tools 35.0.0 e 35.0.1. ANDROID_HOME e ANDROID_SDK_ROOT vazios. adb executado pelo caminho completo: 1.0.41 / 35.0.2-12147458. Nada foi instalado globalmente ou alterado no sistema.

Bloqueio decisivo: npm online EACCES e ausência dos pacotes Capacitor/plugins no cache. npx cap add/sync não pôde executar a CLI correta. Gradle Wrapper não existe, pois android não foi gerado. O script build-apk foi tentado e informou ausência do projeto/Wrapper; não usa Gradle global.

APK: ${existsSync(apk)?`${apk}, ${statSync(apk).size} bytes`:'NÃO IMPLEMENTADO — não foi gerado; arquivo ausente, confirmado por existsSync e Get-Item. Nenhum tamanho ou caminho de APK existente é alegado.'}

Saída da verificação Android:

\`\`\`text
${read('docs/VERIFICACAO_ANDROID.txt')}
\`\`\`

## Saídas finais reais — ordem do item 19

Lint, typecheck, testes e build abaixo foram executados por verify-final.mjs, sem substituir comandos por simulação. Resultado dos testes: ${tests??'consultar saída'} passados, ${passed?'0 falhos':'consultar falhas abaixo'}. O contrato IndexedDB usa Chromium local em vez de fake-indexeddb indisponível. O contrato SQLite usa SQLite real do Node com fechamento/reabertura do arquivo, não um plugin Android.

\`\`\`text
${checks}
\`\`\`

## Servidor e navegador

Servidor Vite iniciado com npm run dev:host -- --port 5173 --strictPort. URL local: http://localhost:5173/ . Na rede desta sessão: http://192.168.0.28:5173/ . A URL de rede pode mudar com o computador. GPS real no celular não funciona por HTTP nesse endereço de rede; usar APK quando disponível ou HTTPS apropriado.

Saída real de curl:

\`\`\`text
${existsSync('docs/VERIFICACAO_HTTP.txt')?read('docs/VERIFICACAO_HTTP.txt'):'HTTP não verificado nesta etapa.'}
\`\`\`

Verificação Chromium: ${browser.status}, errors=${JSON.stringify(browser.errors)}, overflow=${browser.overflow}. Fluxo: ${browser.checks.join(', ')}. Arquivo baixado: ${browser.download}. Evidências adicionais: VERIFICACAO_WEB.json e VERIFICACAO_WEB.png.

## Decisões e pendências que afetam o uso

- Demonstração usa banco separado e nunca sincroniza. Campo local exige apelido e termo e funciona sem credenciais; modo autenticado fica atrás da configuração Supabase. Trocar de modo só sem viagem ativa.
- Parâmetros padrão: GPS 10 s; precisão 50 m; velocidade de parada 3 km/h; duração 15 s; raio 25 m ampliado pela precisão; lacuna 30 s. Demo acelera o relógio fictício e não representa tempo real.
- Plugins nativos não foram escolhidos sem verificar versões/licenças. Browser usa Geolocation, eventos de rede e Wake Lock; SQLite, App e Filesystem/Share têm interfaces de integração ainda pendentes. A stack real e seus desvios estão em DECISOES.
- GPS bloqueado, login real, sync real, SQLite em aparelho e testes A–F não foram aprovados. SQL/RLS precisa de ensaio em servidor local autorizado; Docker recusou acesso e CLI Supabase falhou na telemetria. Nenhuma migration remota executada.
- Não há instalação Android utilizável nesta entrega. Após instalar e integrar Capacitor em ambiente adequado: npm run android:open; gerar e confirmar o APK; adb devices; adb install -r android/app/build/outputs/apk/debug/app-debug.apk. Esses comandos de instalação não foram executados em aparelho.
- Privacidade e termo são rascunhos para revisão institucional. P3 permanece NÃO IMPLEMENTADO. Não houve push, serviço remoto, credencial ou alteração em referencia.

Consulte PENDENCIAS, TESTES_ANDROID e os guias antes do teste de campo. Este relatório substitui integralmente o registro inicial de interrupção na F0.
`;
writeFileSync('docs/RELATORIO_FINAL.md',report);console.log('Relatório escrito; verificações web:',passed,'testes:',tests);
