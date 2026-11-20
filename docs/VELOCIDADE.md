# Velocímetro e excessos de velocidade (v2.2.0)

Motivo: já foi flagrado ônibus acima de 100 km/h na BR-153. O app mostra a velocidade na tela e os excessos ficam como evidência.

## O que aparece

- **Viagem (em andamento)**: número grande em km/h (velocidade do GPS × 3,6), média curta dos últimos 3 pontos para não "pular", e "Máx. na viagem: N km/h". Mostra **—** se a precisão do último ponto for pior que 20 m, se não houver velocidade ou se o ponto tiver mais de 30 s; mostra **0** abaixo de 3 km/h.
- **Cores** (só visual, sem som, sem exigir toque): verde abaixo de 80, amarelo "Atenção" a partir de 80, vermelho "Velocidade alta" a partir de 100.
- **Histórico → detalhe da viagem**: velocidade máxima, média em movimento (≥ 3 km/h), minutos acima de 80 e de 100 km/h, lista de excessos (hora local, duração, vmax) com "Abrir no mapa" (Google Maps).
- **CSV** (UTF-8 com BOM, separador `;`, decimais com vírgula): pela tela *Pontualidade* ("Exportar CSV de velocidade") e pelo detalhe da viagem. Gera dois arquivos:
  - `ifto-monitor_velocidade_<periodo>.csv`: uma linha por episódio e limite — `trip_id, onibus, rota, data_local, inicio_local, fim_local, duracao_s, vmax_kmh, vmedia_kmh, limite_kmh_usado (80 ou 100), latitude, longitude, app_version`. Um excesso ≥ 100 também aparece como ≥ 80 (linhas separadas).
  - `ifto-monitor_velocidade-resumo_<periodo>.csv`: uma linha por viagem — `vmax_kmh, vmedia_movimento_kmh, min_acima_80, min_acima_100, n_episodios (≥ 80), n_episodios_100`.
- **Painel web** `#/painel/velocidade`: ranking de velocidade máxima por ônibus e por rota, episódios ≥ 100 km/h (data, ônibus, rota, vmax, duração, "Ver no mapa") e exportação no mesmo formato. Leitura de admin dos pontos na nuvem.

## Como os excessos são calculados

Nada é gravado a mais: os episódios são **calculados dos pontos** (`speed_mps` já fica em cada ponto), em `src/lib/speed.ts`, usado pelo app e pelo painel.

- **Episódio** = sequência de pelo menos 2 pontos consecutivos com precisão ≤ 20 m e velocidade ≥ limite, sustentada por ≥ 10 s. Ponto de precisão ruim ou intervalo > 45 s entre pontos interrompe a sequência. Registra início, fim, duração, vmax, média e coordenadas do ponto de máxima.
- Se `speed_mps` vier vazio, a velocidade é **estimada** pela distância/tempo entre pontos consecutivos.
- **Saltos de GPS** são descartados: velocidade > 160 km/h, e ponto que destoa dos dois vizinhos com aceleração impossível (> 2 m/s² nos dois sentidos).

## Limitações

- GPS de celular tem erro; a velocidade pode oscilar sob árvores, em trechos encobertos ou com sinal fraco. Pontos ruins são ignorados, então um excesso curto pode não aparecer.
- Com intervalo de 10 s entre pontos, picos de poucos segundos não são vistos.
- **O limite legal depende da sinalização de cada trecho.** Os valores 80 e 100 km/h são **referências do projeto**, não o limite legal; use o registro como indício a ser conferido, não como autuação.

## Como mudar os limites

Em `src/config/reference.ts`: `SPEED_WARN_KMH` (80), `SPEED_HIGH_KMH` (100), `SPEED_MAX_ACCURACY_M` (20) e `SPEED_EPISODE_MIN_S` (10). O painel e o app leem os mesmos valores (gere o app e o site de novo).
