# PROMPT v1.8 — IFTO Monitor — Exportação confiável (CSV com hora local, nome do ônibus, rota, eventos, versão)

Execute TODAS as seções abaixo, de 0 a 6, de ponta a ponta, SEM parar para pedir confirmação. Trabalhe SOMENTE dentro de `C:\dev\ifto-monitor` (não crie cópias da pasta, nem pastas paralelas, nem arquivos fora dos caminhos que o projeto já usa). Não instale pacotes. Não rode Gradle (o usuário gera o APK). Rode `npm run typecheck`, `npm run lint` (se existir), `npm test` e `npm run build` ao final e corrija tudo até passar.

Contexto: coleta real de campo começou em 16/11/2026 com 3 celulares (Ônibus 01, 02, 03). Os CSVs atuais têm só horário UTC (`recorded_at` com `Z`), o `device_id` muda ao reinstalar o app, não há `route` no cabeçalho do CSV e os eventos de interrupção não saem na exportação. Fuso do usuário: America/Fortaleza (UTC−3). Mantenha o `recorded_at` em UTC como está (não alterar a fonte de verdade).

## 0. DIAGNÓSTICO RÁPIDO (antes de codar)
- Confirme no código se já existem: tabela `routes`, `trips.route_id/route_name`, seleção de rota ao iniciar viagem, vigia (watchdog) e eventos `recording_interrupted` / `app_restarted` / `route_changed` / `route_edited`. Liste no `docs/RELATORIO_FINAL.md` o que já existia e o que foi implementado agora. Se algo da v1.7 estiver faltando ou quebrado, implemente/corrija nesta versão.
- Descubra de onde vem a versão do app (package.json / Capacitor / `versionName` do Android) e use uma única fonte.

## 1. HORA LOCAL NA EXPORTAÇÃO
- Adicione a coluna `recorded_at_local` ao CSV (formato `YYYY-MM-DD HH:mm:ss`, calculada no fuso do aparelho com `Intl`/`Date`, sem biblioteca nova). Mantenha `recorded_at` em UTC.
- Também em GeoJSON: `properties.started_at_local` e `ended_at_local`.
- O nome do arquivo exportado deve usar a hora LOCAL (ex.: `ifto-monitor_Onibus-01_Serrano_20261116-0735_73ac0f2b.csv`), já com o nome do ônibus e o slug da rota (seção 2 e 3).
- Na tela Histórico/Detalhe, todos os horários continuam em hora local; confira e corrija qualquer um que esteja em UTC.

## 2. NOME FIXO DO ÔNIBUS
- Em Configurações, adicione o campo "Nome do ônibus" (lista: Ônibus 01, Ônibus 02, Ônibus 03, mais opção "Outro" com texto livre). Guarde em armazenamento persistente do app (o mesmo usado para configurações) e exiba no topo da tela inicial e no checklist antes da viagem.
- Se o nome do ônibus não estiver definido, a tela de iniciar viagem pede para escolher antes de começar (rápido, um toque).
- Grave `bus_label` em cada viagem (coluna nova em `trips`, com migração do IndexedDB; viagens antigas ficam com `bus_label` vazio).
- Exporte `bus_label` no CSV (logo depois de `trip_id`), no GeoJSON (`properties.bus_label`) e no nome do arquivo. Mantenha também `device_id` no CSV.

## 3. COLUNAS FIXAS DO CSV
Cabeçalho final, nesta ordem exata, SEMPRE completo mesmo com valores vazios:

`trip_id,bus_label,route,seq,recorded_at,recorded_at_local,latitude,longitude,accuracy_m,speed_mps,accepted,source,device_id,gap_before_s,suspect,app_version`

- `route` = nome da rota da viagem (vazio se não escolhida; nunca omitir a coluna).
- `app_version` = versão do app que gravou a viagem (gravar no início da viagem e exportar em todas as linhas; viagens antigas = vazio).
- Atualize testes, README/docs e qualquer leitor de CSV interno para o novo cabeçalho. Escape correto de vírgulas e aspas nos campos de texto.

## 4. EVENTOS EXPORTÁVEIS
- No Detalhe da viagem, o botão de exportar passa a oferecer: CSV de pontos, GeoJSON, e **CSV de eventos** (`ifto-monitor_<ônibus>_<rota>_<AAAAMMDD-HHmm>_<id8>_eventos.csv`).
- Colunas do CSV de eventos: `trip_id,bus_label,route,event_type,occurred_at,occurred_at_local,detail,app_version`.
- Inclua todos os eventos da viagem: início, fim, pausa, retomada, `recording_interrupted`, `app_restarted`, `route_changed`, `route_edited`, perda/recuperação de sinal GPS, permissão alterada, e reinício do serviço pelo vigia (com o tempo sem pontos em `detail`).
- No Detalhe da viagem, mostre uma lista simples "Eventos" (hora local + tipo) abaixo do mapa, recolhida por padrão.
- Ao compartilhar pelo WhatsApp (Share), envie os arquivos selecionados juntos quando o plugin permitir; senão, um por vez sem travar a tela.

## 5. PEQUENOS AJUSTES DE CAMPO
- Paradas: o intervalo entre pontos é de ~10 s e o critério é ≥15 s. Deixe a duração mínima de parada configurável em Configurações (padrão 15 s, opções 10/15/20/30 s) para podermos testar sem novo APK.
- Tela inicial: mostrar claramente "Gravação confiável: OK / atenção" (resultado do checklist de bateria, permissão de localização "o tempo todo" e notificação), com atalho para o guia.
- Conferir que a viagem sempre registra o `device_id` e o `app_version` mesmo quando o app é reiniciado no meio da viagem.
- Manter todos os ajustes de safe-area e o visual verde IF já aplicados; não alterar logo, ícone nem paleta.

## 6. TESTES, DOCS E QA
- Testes Vitest novos: cabeçalho exato do CSV; `recorded_at_local` correto para UTC−3 (ex.: `10:35:32.689Z` → `07:35:32`); `bus_label` e `route` presentes e vazios quando não definidos; escape de CSV; nome do arquivo com hora local, ônibus e rota; CSV de eventos com os tipos esperados; migração IndexedDB preservando viagens antigas; duração mínima de parada configurável.
- Atualize `docs/RELATORIO_FINAL.md`, `docs/TESTES_CAMPO.md` (inclua o roteiro: definir nome do ônibus, escolher rota, iniciar, exportar CSV + eventos, conferir hora local) e o changelog/versão para **1.8**.
- Aumente `versionCode` e `versionName` do Android para 1.8 (sem rodar Gradle).
- Ao final: rode typecheck, lint, testes e build; mostre o resumo (arquivos alterados, nº de testes passando) e diga em uma linha: "Pronto para gerar o APK: wsl --shutdown; cd C:\dev\ifto-monitor; npm run android:apk".
