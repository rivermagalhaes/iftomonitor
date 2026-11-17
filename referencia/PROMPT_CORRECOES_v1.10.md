# PROMPT v1.10 — IFTO Monitor — Um só campo de ônibus, paradas sem duplicata, CSV de paradas completo

Execute TODAS as seções abaixo, de 0 a 4, de ponta a ponta, SEM parar para pedir confirmação. Trabalhe SOMENTE dentro de `C:\dev\ifto-monitor` (sem cópias da pasta, sem pastas paralelas, sem arquivos fora dos caminhos que o projeto já usa). Não instale pacotes. Não rode Gradle (o usuário gera o APK). Ao final rode typecheck, lint (se existir), `npm test` e `npm run build` e corrija tudo até passar.

Contexto (coleta de campo, 3 celulares, um por ônibus; versão atual 1.9):
1. Na aba Viagem existem DUAS escolhas de ônibus: "Nome do ônibus" (v1.8: Ônibus 01/02/03/Outro) e "Selecione o veículo" (lista antiga de veículos, com lápis de edição). Podem ficar em ônibus diferentes, e não está claro qual vale na gravação.
2. Uma parada manual feita no meio de uma parada automática gera DUAS paradas no mesmo local (ex.: automática de 20 s e manual de 0 s a menos de 1 m).
3. O CSV de paradas não tem `bus_label`, `route` consistente nem `app_version`, e uma viagem exportada sem coluna de rota foi observada.

## 0. DIAGNÓSTICO RÁPIDO
Localize no código: a tela Viagem, o estado do "Nome do ônibus", a lista de veículos (`vehicles`), onde a viagem grava `bus_label`/`vehicle_id`, a detecção automática de paradas, a parada manual e a exportação de paradas. Registre no `docs/RELATORIO_FINAL.md` o que existia e o que mudou.

## 1. UM ÚNICO CAMPO DE ÔNIBUS
- Unifique em UMA escolha só na aba Viagem: "Ônibus" com Ônibus 01, Ônibus 02, Ônibus 03 e "Outro" (texto livre). Remova a lista antiga "Selecione o veículo" da tela de iniciar viagem.
- A escolha é persistente no celular (continua valendo nas próximas viagens) e é a que vai para `trips.bus_label` e para o `vehicle_id` interno. Mantenha compatibilidade: se a tabela de veículos ainda for usada em outras telas/exportações, o veículo interno é criado/selecionado automaticamente a partir do nome do ônibus; viagens antigas não mudam.
- Migração: se o celular tinha "Nome do ônibus" definido e um veículo diferente selecionado, vale o "Nome do ônibus" (v1.8).
- Se nenhum ônibus estiver escolhido, "Iniciar viagem" fica desativado com a mensagem "Escolha o ônibus antes de iniciar".
- O nome do ônibus aparece sempre no topo da Viagem e na tela inicial.
- A edição (lápis) da lista antiga passa a existir só em Configurações > Ônibus, para renomear "Outro".

## 2. PARADAS SEM DUPLICATA
- Ao criar uma parada manual, se já existir uma parada automática da mesma viagem com sobreposição de tempo (ou a menos de 60 s) e a menos de 30 m, FUNDA as duas numa só: mantém o intervalo e a duração da automática, `detected_by = auto+manual`, status inicial mantido, e marca "confirmada manualmente".
- Parada manual sem automática próxima: registra `arrived_at` ao tocar e completa `departed_at` quando o ônibus voltar a andar (velocidade acima do limite por 2 pontos seguidos) ou ao finalizar a viagem; nunca deixar duração 0 s por padrão.
- Aplique a mesma regra aos dados antigos apenas na EXPORTAÇÃO e no Histórico (agrupar visualmente duplicatas óbvias), sem apagar nada do banco local.
- A contagem de paradas (Início, Histórico, exportações) deve usar as paradas já fundidas.

## 3. CSV DE PARADAS COMPLETO
Cabeçalho fixo, nesta ordem, sempre completo mesmo com valores vazios:

`stop_id,trip_id,bus_label,route,arrived_at,arrived_at_local,departed_at,departed_at_local,duration_s,latitude,longitude,status,label,detected_by,app_version`

- `arrived_at_local` e `departed_at_local` no fuso do aparelho (`YYYY-MM-DD HH:mm:ss`), como nos demais CSVs; os horários em UTC permanecem.
- `bus_label`, `route` e `app_version` vêm da viagem. Atualize testes e docs.
- Garanta que o nome do arquivo de paradas siga o padrão dos outros (`ifto-monitor_<ônibus>_<rota>_<AAAAMMDD-HHmm>_<id8>_stops.csv`) e que a rota "sem rota" use o slug `sem-rota`.

## 4. TESTES, DOCS E VERSÃO
- Testes Vitest: escolha única de ônibus e migração; "Iniciar viagem" desativado sem ônibus; fusão de parada manual dentro de automática; parada manual isolada com saída completada depois; cabeçalho exato do CSV de paradas; horas locais; nome do arquivo.
- Atualize `docs/RELATORIO_FINAL.md` e `docs/TESTES_CAMPO.md` (roteiro: escolher o ônibus uma vez, iniciar, marcar parada manual dentro de uma parada automática e conferir que sai uma só).
- Versão **1.10**: package.json, `versionName` e `versionCode` do Android (sem rodar Gradle).
- Ao final, mostre o resumo (arquivos alterados, nº de testes) e diga em uma linha: "Pronto para gerar o APK: wsl --shutdown; cd C:\dev\ifto-monitor; npm run android:apk".
