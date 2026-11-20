# Pontualidade (v2.1.0)

A pontualidade é calculada **no aparelho e no painel**, a partir dos pontos de GPS já gravados. Não há SQL nem migration nova.

## Fonte da verdade (negócio)

A empresa não informou horário de cada ponto. Os únicos horários firmes são relativos ao campus (IFTO Paraíso do Tocantins):

- **Manhã (cidade → campus):** o ônibus deve **chegar** ao campus até **08:00**.
- **Tarde/noite (campus → cidade → campus):** o ônibus **sai** do campus às **17:00** e deve **voltar** ao campus até **19:00**.

Paradas intermediárias não têm horário oficial. O app calcula o **horário observado** (mediana dos dias) para que, depois de 3–4 semanas, a secretaria possa oficializar uma tabela.

## Horários e fuso

Os instantes são gravados em UTC (`Z`). Toda regra de turno e comparação com 08:00/17:00/19:00 usa o horário **local de America/Fortaleza (UTC−3, sem horário de verão)**, via `src/lib/time.ts` (deslocamento fixo, não depende do fuso do celular). O prazo é sempre o do **dia local do início** da viagem.

## Definições exatas

Só entram pontos com `accepted = true`, em ordem de `recorded_at`.

1. **Dentro/fora:** `dentro(p) = distância(p, campus) ≤ raio` (haversine; padrão 150 m).
2. **Turno** (pela hora local de **início** da viagem, minuto inteiro, limites inclusivos): manhã `04:00–11:59`; tarde/noite `12:00–20:59`; fora disso `fora_de_turno`. Override manual por viagem: `auto | manha | noite | ignorar` (`ignorar` tira a viagem de qualquer cálculo).
3. **Manhã – chegada:** primeiro ponto dentro do raio que venha **depois** de ao menos um ponto fora. `folga = 08:00 − chegada` em minutos (arredondados; positivo = chegou antes).
   - `adiantado`: folga > 10 min · `no_limite`: 0 ≤ folga ≤ 10 · `atrasado`: folga < 0.
   - Nunca saiu de dentro → `sem_deslocamento`. Nunca entrou depois de sair → `nao_chegou`.
4. **Tarde/noite – saída:** último ponto dentro antes do primeiro ponto fora. A viagem deve começar dentro; senão `sem_saida_do_campus`. `desvio = saída − 17:00` (positivo = depois): `pontual` (|desvio| ≤ 5 min), `atrasada` (> +5), `antecipada` (< −5).
5. **Tarde/noite – retorno:** a **última** transição fora → dentro. `folga_retorno = 19:00 − retorno`, com os mesmos status da manhã. Nenhuma transição depois de sair → `nao_retornou`.
6. **Confiança:** `baixa` se algum intervalo entre pontos consecutivos for maior que 120 s em até 2 pontos ao redor do evento; senão `alta`. Viagens de confiança baixa mostram aviso e ficam fora do "pior caso" (mas entram nas demais estatísticas).
7. **Métricas:** duração (início → fim da viagem), distância (soma haversine dos pontos aceitos), nº de paradas e tempo parado (paradas `descartada` não contam).
8. **Agregado por rota + turno + período:** viagens válidas, % no horário (`adiantado` + `no_limite` na chegada/retorno; `pontual` na saída, mostrado à parte), folga mediana, pior folga e melhor folga. Ficam **fora** do agregado, mas listadas com o motivo: sem rota, fora de turno, ignorada, em andamento e viagem sem chegada/saída calculável.
9. **Tabela observada:** por rota + turno, as paradas (não descartadas) das viagens válidas são agrupadas **por proximidade** (≤ 50 m do centróide, algoritmo guloso por horário) — o nome não decide. Cada ponto mostra o nome mais frequente (ignorando "Parada manual"/"Parada detectada"), centróide, nº de viagens distintas, horário mediano, mais cedo, mais tarde e duração mediana. Só aparecem pontos com pelo menos 2 viagens, ordenados pelo horário mediano.

Sinal de `delta_min` nos CSVs: chegada/retorno = **folga** (positivo = antes do prazo); saída = **desvio** (positivo = depois das 17:00).

## Como ajustar campus e horários

**Ajustes → Referências de horário.** Dá para editar latitude/longitude, raio (30–500 m), os três horários (HH:MM), tolerância, margem de "adiantado", janelas de turno, mínimo de viagens e raio de agrupamento. Botões:

- **Usar minha posição atual como campus** (conferir antes de salvar);
- **Usar o ponto final da última viagem como campus**;
- **Restaurar padrões**.

Os valores ficam salvos no aparelho (`app_meta`). Padrões em `src/config/reference.ts`: campus `-10.20060, -48.90172`, raio 150 m.

No painel web, o campus pode ser sobrescrito por `VITE_CAMPUS_LAT`, `VITE_CAMPUS_LNG` e `VITE_CAMPUS_RADIUS_M` (ver `.env.example`; valores inválidos são ignorados).

## Telas

- **App:** aba/atalho **Pontualidade** (filtros de período, rota e turno; cards por rota+turno; barras de folga por dia; lista de viagens com chips; aba **Tabela observada**; exportação dos CSVs). O turno de cada viagem pode ser trocado em **Histórico → viagem → Turno (pontualidade)**.
- **Painel web:** `#/painel/pontualidade`, somente leitura, mesma autenticação de admin. Carrega viagens, pontos (`recorded_at, latitude, longitude, accepted`) e paradas por viagem em páginas de 1000, com indicador de progresso. Sem Supabase configurado mostra "Nuvem não configurada".
- **Aviso:** ao finalizar viagem sem rota, aparece "Viagem sem rota não entra no relatório de pontualidade. Escolha a rota em Histórico." com atalho; a finalização nunca é bloqueada.

## CSVs

- `ifto-monitor_pontualidade_<periodo>.csv`: `trip_id,bus_label,route,shift,start_local,event,event_time_local,target_time,delta_min,status,confidence,duration_min,distance_km,stops_count,stopped_min,app_version`. Viagens ignoradas, fora de turno ou em andamento saem com uma linha e o motivo em `status`.
- `ifto-monitor_tabela-observada_<rota>_<turno>.csv`: `route,shift,order,label,latitude,longitude,trips_count,median_time_local,earliest_time_local,latest_time_local,median_stop_duration_s`.

## Como ler a tabela observada

É o horário que o ônibus **de fato cumpre** (mediana dos dias), não o horário oficial. Use a faixa (mais cedo – mais tarde) para ver a variação e o número de viagens para saber o quanto confiar. Com poucas semanas de dados, valores com 2–3 viagens ainda são frágeis.

## Limites conhecidos

- O horário vem do GPS: lacunas de sinal perto do evento reduzem a confiança; a chegada é o primeiro ponto dentro do raio, que pode ocorrer alguns segundos depois da chegada real.
- A chegada depende de o ônibus ter estado fora do raio antes; viagens iniciadas já dentro do campus, na manhã, ficam `sem_deslocamento`.
- Se o ônibus voltar ao campus e sair de novo antes de a viagem ser finalizada, vale a última entrada.
- Paradas do ponto onde o ônibus fica dentro do campus (início/fim) entram na tabela como qualquer outra parada.
- O override de turno (`shift_override`) existe só no aparelho; o painel web não o recebe (não há mudança de SQL) e usa a inferência pelo horário de início.
- Pontos `accepted` nulos/falsos na nuvem são ignorados. Horário de verão não existe em Fortaleza; se isso mudar, ajustar `FORTALEZA_OFFSET_MIN`.
