import {readFileSync,writeFileSync} from 'node:fs';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
let table='| Pacote | Versão exata | Motivo |\n|---|---|---|\n';
for(const [name,version] of Object.entries({...pkg.dependencies,...pkg.devDependencies})){const manifest=JSON.parse(readFileSync(`node_modules/${name}/package.json`,'utf8'));const reason=name.includes('react')?'Interface, navegação ou ícones':name.includes('supabase')?'Preparação P2, sem serviço real':name==='idb'?'IndexedDB transacional':name==='playwright'?'IndexedDB real e ensaio visual Chromium':'Build, análise estática ou testes';table+=`| ${name} | ${version} | ${reason}; ${manifest.license||'licença no pacote'}${manifest.engines?.node?`; Node ${manifest.engines.node}`:''} |\n`;}
const text=`# Decisões técnicas — F0–F10

Status geral: PARCIAL. As verificações web estão registradas no RELATORIO_FINAL; Android não foi gerado. Este documento substitui o registro inicial da F0, que foi retomada a pedido do usuário.

## Ambiente e dependências

Node v24.16.0 e npm 11.13.0 verificados. Java ausente no PATH, mas Temurin 21.0.13 foi localizado e executado por caminho absoluto em C:/Program Files/Eclipse Adoptium/jdk-21.0.13.9-hotspot/bin/java.exe. adb 1.0.41 / 35.0.2 foi executado por caminho absoluto; SDK tem plataformas até android-35 e build-tools 35.0.0/35.0.1. A falta de pacotes Capacitor continua bloqueando Android. Vite 7 foi escolhido porque o configLoader runner e o pré-bundle Rollup evitam uma falha de acesso a diretórios pais pelo processo nativo esbuild neste sandbox. TypeScript strict, React Router HashRouter e Tailwind v3 com PostCSS. O npm online retornou EACCES; a instalação foi recuperada de tarballs e metadados do cache local, sem baixar pacotes ausentes. Lockfile e versões diretas exatas preservados.

${table}
O override @types/estree 1.0.9 permitiu a resolução offline; Vite 7.3.8 foi usado com Vitest 5.0.5, validado pela suíte. Não há intervalos com ^ nas dependências diretas. O script restore-cache é específico desta máquina e não é pré-requisito de uma instalação normal com npm ci.

## Escolhas de implementação

- Raiz única e referencia somente leitura; não há imagens ou HTML de protótipo, somente o documento mestre. Fidelidade ao protótipo: NÃO TESTADO.
- Marca BusFront confirmada pelo import e renderização instalada, tokens exatos, navegação House/Route/History e botões com altura mínima 48 px.
- Fonte Geist Regular local extraída do pacote já em cache, sem usar Next como framework. Copyright 2024 e OFL conferidos nos metadados da fonte; licença distribuída junto ao arquivo. Referência de licença: https://github.com/vercel/geist-font/blob/main/OFL.txt.
- Modo demo usa ifto_monitor_demo; campo/autenticado usam ifto_monitor. Demo nunca sincroniza; exportações incluem demo no nome. localStorage contém somente preferência de modo e sessão Supabase.
- Campo local habilitado por padrão sem .env; pode ser desabilitado por VITE_ALLOW_LOCAL_FIELD_MODE=false. Exige iniciais/apelido, consent_version e consent_accepted_at antes da captura.
- IndexedDB é o adaptador efetivamente integrado no navegador. SQLiteRepository é uma implementação sobre conexão injetada, com payload JSON, índice físico único de trip_id/seq e migração user_version=1. O contrato comum passou em IndexedDB/Chromium e SQLite/Node com arquivo reaberto. Integração com plugin Android: NÃO IMPLEMENTADO.
- fake-indexeddb indisponível no cache; em seu lugar foi usado Chromium com IndexedDB real. A suíte comum é repositoryContract, parametrizada por abertura de adaptador. Testes de UI usam Testing Library e dados em memória apenas como fixture.
- ForegroundProvider aceita uma API compatível com GeolocationApi, mas nesta entrega usa navigator.geolocation. A conexão real com @capacitor/geolocation não foi possível. Rede usa eventos do navegador e tela usa Wake Lock; contratos para Network/Filesystem/Share/App existem, sem plugins concretos instalados.
- GPS padrão 10 s, tolerância 10%, precisão máxima 50 m; parada abaixo de 3 km/h por no mínimo 15 s, raio 25 m ampliado pela precisão, lacuna máxima 30 s. Todos são ajustáveis; ajustes ficam bloqueados durante a viagem.
- Cada fix é enfileirado e persistido antes de detecção/envio; encerrar aguarda a fila e invalida novos callbacks. A viagem é persistida antes de iniciar watchPosition para recuperar falhas de abertura do sensor.
- Demo acelera timestamps em um intervalo por segundo; não representa tempo real e fica restrita ao banco demo. Encerrar usa tempo não anterior ao último ponto fictício.
- Semáforos continuam candidatos até confirmação humana. A detecção por lote e incremental compartilham StopDetector; status e rótulos editados são preservados.
- Leaflet não estava no cache e npm estava bloqueado: mapa implementado com SVG Web Mercator e até nove tiles visíveis OSM, sem download em massa. É um desvio explícito de stack. Fallback local não inclui ruas e não bloqueia gravação.
- CSV contém BOM e dois arquivos; GeoJSON usa lon/lat. Se houver menos de dois pontos aceitos, geometry do trajeto é null para evitar LineString inválido. Operator_label e e-mail são excluídos das exportações.
- Sync usa linhas pendentes/erro como fila, sem tabela adicional; confirma IDs retornados e preserva alterações concorrentes. Dependências não confirmadas bloqueiam as tabelas seguintes. Dados locais sem proprietário recebem owner da sessão no payload remoto; revisar adoção antes de uso real.
- RLS usa profiles ativos, helpers security definer de leitura e nenhum DELETE/anon. Nenhum SQL foi aplicado remotamente. Docker/CLI locais bloqueados: lint SQL NÃO TESTADO.
- F8 foi tentada e permaneceu PARCIAL: cap add/sync sem CLI instalada; Java fora do PATH; SDK local existe, variáveis vazias. Não se gerou projeto Android artificial nem APK fictício. Ícone/splash fonte e configuração Capacitor existem.
- F9 executada como preparação de código e testes simulados, apesar do bloqueio nativo registrado. GPS bloqueado: NÃO IMPLEMENTADO; consulta de licença/major/data do candidato ao npm falhou com EACCES, portanto nenhum plugin foi selecionado.
- Git local opcional não foi inicializado; não houve push, instalação global, mudança de ambiente do sistema ou criação de serviço remoto.
`;
writeFileSync('docs/DECISOES.md',text);
