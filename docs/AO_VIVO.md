# Acompanhamento ao vivo (v2.4.0)

Painel web → **Ao vivo** (`#/painel/ao-vivo`), só para o administrador logado. Mostra no mapa (Leaflet + OpenStreetMap, sem chave de API, centrado no campus) cada ônibus com viagem em andamento.

## O que aparece
- Marcador por ônibus com rótulo (Ônibus 01/02/03 · km/h), rota, última posição e "atualizado há X s/min". Cores da velocidade: verde < 80, amarelo 80–99, vermelho ≥ 100 km/h (`SPEED_WARN_KMH`/`SPEED_HIGH_KMH`).
- **Sem sinal**: se a última posição tiver mais de 2 min, o marcador fica cinza com "sem sinal desde HH:MM" (horário de Fortaleza).
- Rastro dos últimos 30 minutos como linha; lista ao lado (ou abaixo, no celular) com atalho para centralizar o mapa em cada ônibus.
- Atualiza sozinho a cada 10 s; botão "Atualizar agora" e horário da última atualização. Sem viagens: "Nenhum ônibus em viagem agora.". Se uma leitura for bloqueada, o erro real do servidor aparece na tela.

## Como funciona (e limites)
- O app envia os pontos pendentes a cada ~15 s **durante a viagem**, quando há internet (sem novo GPS: só o que já é gravado). Sem internet continua gravando e o envio retoma ao voltar o sinal. O que aparece no painel tem, portanto, **10–25 s de atraso** e **depende do sinal do celular**.
- **Viagem "sombra"** (por causa do RLS): o celular só tem permissão de INSERT (sem UPDATE) no Supabase. Por isso a viagem em andamento vai como uma linha própria (`status = 'live'`, `ended_at` nulo, id derivado do da viagem, `extra.live_of`) com seus pontos. Ao finalizar, a viagem real é enviada inteira como sempre (com `extra.live_id`) e o painel passa a esconder a sombra. As abas Pontualidade, Velocidade e Visão geral ignoram viagens `live`. Os pontos ficam gravados duas vezes (sombra + viagem real); a sombra pode ser apagada pelo admin quando quiser.
- Se o celular nunca finalizar/sincronizar a viagem real, a sombra continua aparecendo por até 12 h (cinza, "sem sinal desde …").
- Relatos ligados à viagem podem apontar para a sombra (`reports.trip_id`).

## Permissões (RLS) necessárias — sem alterar SQL
Já existentes: `trips_anon_insert`, `points_anon_insert` (celular) e `trips_admin_select`, `points_admin_select` (admin). Se a aba mostrar "permission denied", falta uma dessas políticas/grants no projeto Supabase (a migração `20261117120000_ifto_monitor_cloud.sql` as cria). Uma melhoria futura seria uma política de UPDATE para o celular (`ended_at`), o que dispensaria a viagem sombra; não foi feita porque não se altera o SQL aqui.
