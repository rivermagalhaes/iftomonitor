# PROMPT v2.0 — IFTO Monitor — Nuvem (envio das viagens) + Relatos dos alunos (texto e foto) + Painel

Execute TODAS as partes abaixo, na ordem (0, A, B, C, D, E), de ponta a ponta, SEM parar para pedir confirmação. Trabalhe SOMENTE dentro de `C:\dev\ifto-monitor` (sem cópias da pasta, sem pastas paralelas, sem arquivos fora dos caminhos do projeto). Não rode Gradle (o usuário gera o APK). Não aplique SQL em servidor nenhum e não faça deploy: apenas deixe tudo pronto no repositório. Você não tem rede: os pacotes `@supabase/supabase-js`, `qrcode` e `@types/qrcode` JÁ foram instalados pelo usuário; se faltarem em `node_modules`, declare-os em `package.json` e avise no resumo final, sem travar o resto. Ao final rode typecheck, lint (se existir), `npm test`, `npm run build` e `npm run build:web`, e corrija tudo até passar.

## CONTEXTO
- App Android offline-first (React/Vite/TS strict/Tailwind/Capacitor), versão atual 1.10.0, 152 testes, IndexedDB local, identidade verde IF (#2F9E41; não alterar logo, ícone, paleta nem safe-area). Hoje a tela inicial mostra "Nuvem não configurada" e o Histórico mostra "Pendente".
- Coleta real em curso: 3 celulares, um por ônibus. Dados locais NUNCA podem ser apagados nem corrompidos por causa da nuvem.
- Banco: Supabase (plano grátis), schema isolado **`ifto_monitor`**, já definido em `supabase/migrations/20261117120000_ifto_monitor_cloud.sql` (o usuário aplica no servidor; NÃO edite esse arquivo; qualquer ajuste necessário vai em um NOVO arquivo `supabase/migrations/20261117130000_ifto_monitor_cloud_fix.sql`, idempotente). Tabelas: `routes`, `buses`, `route_schedules`, `trips`, `trip_points`, `trip_stops`, `trip_events`, `reports`, `report_photos`, `report_rate`, `admins`; bucket privado `ifto-reports`. Regras: celulares (anon) só INSEREM em `trips/trip_points/trip_stops/trip_events`; alunos NÃO acessam `reports` direto (só pela Edge Function); admin autenticado (linha em `ifto_monitor.admins`) lê e modera tudo; anon lê só `routes` e `buses` ativos. Chaves únicas: `trip_points(trip_id, seq)` e `trip_events(trip_id, event_type, occurred_at)`; `trips.id` e `trip_stops.id` vêm do celular.
- O cliente Supabase usa `createClient(url, anonKey, { db: { schema: 'ifto_monitor' } })`. Variáveis em `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); crie `.env.example`, garanta `.env*` no `.gitignore`. Nunca use `service_role` no front-end nem no app.
- Se existir migração criada na v1.10 em `supabase/migrations/` que conflite (tabelas em `public`), NÃO apague: documente em `docs/NUVEM_E_RELATOS.md` e faça o cliente de nuvem usar apenas o schema `ifto_monitor`.

## PARTE 0 — DIAGNÓSTICO
Mapeie o modelo local (trips, points, stops, events, routes, buses) e como cada campo se encaixa nas colunas do SQL (campos sem coluna vão em `trips.extra` / `trip_events.detail`). Registre o mapeamento em `docs/NUVEM_E_RELATOS.md`.

## PARTE A — ENVIO DAS VIAGENS (app Android)
1. Serviço de sincronização (`src/services/cloudSync*`), desligado se as variáveis de ambiente não existirem (nesse caso a tela mostra "Nuvem não configurada" e tudo segue como hoje).
2. Marcação local de pendência por registro (migração do IndexedDB com versão nova, sem perder dados): campo `synced_at` em viagens, pontos, paradas e eventos; viagens antigas entram como pendentes.
3. Só sincroniza viagens **finalizadas**. Nunca durante a gravação (não interferir no GPS nem no vigia). Gatilhos: ao abrir o app, ao voltar a internet (Capacitor Network), ao finalizar uma viagem e pelo botão "Sincronizar agora".
4. Ordem por viagem: `trips` → `trip_points` (lotes de 500) → `trip_stops` → `trip_events`. Convertendo para o formato do SQL (horário em ISO UTC, `bus_label`, `route_name`, `device_id`, `app_version`, agregados: distância, duração, nº de pontos/paradas/lacunas).
5. Idempotência sem depender de ON CONFLICT: erro de duplicidade (HTTP 409 / código 23505) conta como sucesso; se um lote falhar, divida ao meio recursivamente até isolar o registro problemático; registre o erro da viagem e siga para as próximas. Reenvio sempre seguro. Retentativa com recuo exponencial; nunca em laço apertado.
6. Depois do envio completo, marque `synced_at` localmente. **Não apague nenhum dado local.**
7. Interface: no lugar do cartão "Nuvem não configurada", mostrar estado real: "Tudo sincronizado" (com hora), "N viagens pendentes", "Sem internet", "Erro ao enviar (tentar de novo)", e botão "Sincronizar agora". No Histórico, status por viagem: Pendente / Enviada / Erro. Em Configurações: liga/desliga da nuvem e hora da última sincronização.
8. Testes Vitest: fila e marcação de pendência, duplicidade como sucesso, divisão de lote, retentativa, nunca enviar viagem em andamento, comportamento sem variáveis de ambiente, migração do IndexedDB preservando dados.

## PARTE B — EDGE FUNCTIONS (código no repositório; o deploy é feito depois)
Em `supabase/functions/`:
1. `_shared/validate.ts`: validação pura em TypeScript (sem APIs do Deno), reutilizável e testável no Vitest: categorias (`atraso, quebra, superlotacao, parada_nao_feita, desvio, limpeza_conservacao, seguranca, outro`), texto até 500 caracteres (sem HTML; normalizar espaços), no máximo 2 fotos, MIME `image/jpeg|png|webp`, tamanho de cada foto até 1 MB, `bus_label` obrigatório (até 60), `route_name` opcional (até 80), campo-isca (honeypot) que deve vir vazio. Exige texto OU foto.
2. `submit-report/index.ts` (Deno, CORS liberado para o domínio configurável por `ALLOWED_ORIGIN`, padrão `*` no piloto), duas ações em JSON:
   - `create`: valida; calcula `ip_hash` = SHA-256 de (IP + `IP_SALT`); limite de 10 relatos por `ip_hash` por dia em `report_rate` (HTTP 429 acima disso); insere em `reports` e `report_photos` (com `uploaded=false`) usando `service_role` (`createClient` com `db.schema = 'ifto_monitor'`); tenta ligar `trip_id` (viagem do mesmo ônibus em andamento agora ou terminada nas últimas 3 horas, melhor esforço); gera URLs assinadas de upload (`createSignedUploadUrl`) para o bucket `ifto-reports` com caminho `AAAA/MM/<report_id>/<uuid>.<ext>`; devolve `{report_id, uploads:[{path, token}]}`.
   - `finalize`: recebe `report_id` e os caminhos enviados; confere no storage que existem e marca `uploaded=true`; ajusta `photo_count`; fotos que não subiram são removidas da tabela.
   Nenhuma resposta devolve dados de outros relatos.
3. `purge-photos/index.ts`: exige JWT de admin (valida com `ifto_monitor.is_admin()` usando o token do chamador); recebe `{days}` (padrão 90); apaga do storage e da tabela as fotos mais antigas que `days` com `keep=false`; devolve a contagem.
4. `supabase/functions/README.md` com variáveis (`IP_SALT`, `ALLOWED_ORIGIN`) e os comandos de deploy.
5. Testes Vitest da validação (casos válidos e inválidos, limites, honeypot).

## PARTE C — SITE WEB (formulário do aluno + painel), no mesmo repositório
Estrutura: pasta `web/` dentro do projeto raiz, **um único** `package.json`. Segundo build do Vite com `vite.config.web.ts` (entrada `web/index.html`, saída `dist-web`), script `build:web` e `dev:web`; `vercel.json` com `buildCommand: npm run build:web` e `outputDirectory: dist-web`. Roteamento simples por hash (`#/relatar`, `#/painel/...`), sem biblioteca nova. O APK NÃO inclui o código do site; o site NÃO inclui o código do app. Identidade verde IF, mobile-first, acessível, em português.

### C1 — Formulário do aluno (`#/relatar`, sem login)
- Aceita `?bus=Ônibus 01` (o QR de cada ônibus já preenche e trava o campo ônibus); sem parâmetro, mostra a lista de ônibus ativos (leitura anon de `buses`). Rota: lista de rotas ativas + "Não sei".
- Passos curtos: tipo do problema (botões grandes) → **Escrever** (campo até 500 caracteres com contador) e/ou **Foto** (botão "Tirar foto" com `<input type="file" accept="image/*" capture="environment">`, até 2) → Enviar.
- Aviso fixo e visível junto das fotos: "Fotografe só o ônibus (bancos, pneus, lataria, lotação). Não fotografe pessoas." Aviso de privacidade: "O relato é anônimo."
- Compressão no navegador antes de enviar: redimensionar para no máximo 1280 px no maior lado e reencodar em JPEG qualidade ~0,8 via canvas (isso remove EXIF/GPS), alvo ≤ 300 KB e teto de 1 MB; função pura e testável.
- Envio: chama `submit-report` (`create`), sobe cada foto com `uploadToSignedUrl`, chama `finalize`. Estados claros: enviando, sucesso ("Relato enviado, obrigado"), erro de rede (permitir tentar de novo sem perder o que foi digitado), limite diário (429) com mensagem amigável. Campo-isca oculto. Desabilitar o botão durante o envio.
- Sem cookies de rastreamento, sem analytics, sem pedir nome, e-mail ou telefone.

### C2 — Painel (`#/painel`, login obrigatório)
- Login com Supabase Auth (e-mail e senha). Depois de entrar, confirma que o usuário é admin (consulta a própria linha em `admins`); se não for, mostra "Sem permissão" e sai.
- **Relatos**: lista com filtros (status, ônibus, rota, categoria, período), miniaturas das fotos via URL assinada (1 hora), detalhe com texto, fotos ampliáveis, viagem relacionada (link), botões Visto / Resolvido / Descartado (grava `reviewed_at` e `reviewed_by`), nota interna, marcar foto como "guardar" (`keep`), botão "Limpar fotos antigas (90 dias)" (chama `purge-photos` e mostra quantas apagou), exportar CSV dos relatos.
- **Viagens**: lista por rota e ônibus (data, duração, km, pontos, paradas, lacunas, versão do app), filtros por período; detalhe com mapa Leaflet/OSM (polilinha dos pontos, linhas tracejadas nas lacunas, marcadores das paradas) e lista de eventos; exportar CSV no mesmo formato do app v1.10.
- **Resumo**: contagem de viagens por rota (hoje e na semana), relatos novos, viagens com lacunas.
- **QR codes** (`#/painel/qrcodes`): gera um QR por ônibus ativo apontando para `<origem do site>/#/relatar?bus=<rótulo>`, com botão de imprimir (página de impressão limpa, um QR grande por ônibus com o nome embaixo) e baixar PNG.
- Nunca usar `service_role` no navegador; tudo passa pelo RLS.
- Testes Vitest das funções puras do site (compressão: dimensões e limites; montagem do payload; URL do QR; filtros; geração do CSV).

## PARTE D — DOCUMENTAÇÃO E VERSÃO
- Crie `docs/NUVEM_E_RELATOS.md` com o passo a passo de ativação, nesta ordem: (1) aplicar o SQL; (2) adicionar `ifto_monitor` em "Exposed schemas"; (3) criar o usuário admin em Authentication e inserir em `ifto_monitor.admins`; (4) definir os segredos `IP_SALT` e `ALLOWED_ORIGIN`; (5) fazer deploy das duas Edge Functions; (6) criar `.env` com URL e chave anon; (7) deploy do site na Vercel; (8) gerar o APK e testar; (9) rotina de backup semanal (exportar as tabelas em CSV pelo painel) e plano de saída para um projeto próprio (dump/restore do schema).
- Atualize `docs/RELATORIO_FINAL.md` e `docs/TESTES_CAMPO.md` (roteiro: finalizar uma viagem com internet e ver "Tudo sincronizado"; sem internet e ver "pendente"; enviar um relato com texto e foto pelo formulário; ver no painel; moderar; apagar fotos antigas).
- Versão **2.0.0**: package.json, `versionName` e `versionCode` (20000) do Android, sem rodar Gradle.

## PARTE E — QA FINAL
- Rode typecheck, lint, `npm test`, `npm run build` e `npm run build:web`.
- Confirme que o APK continua funcionando 100% offline e sem variáveis de ambiente.
- Confirme que nenhum segredo foi gravado no repositório.
- Resumo final curto: arquivos criados e alterados, nº de testes, pendências manuais do usuário e, em uma linha: "Pronto para gerar o APK: wsl --shutdown; cd C:\dev\ifto-monitor; npm run android:apk".
