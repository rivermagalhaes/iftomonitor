# PROMPT v1.6 — GPS em segundo plano, lacunas de sinal e paradas (IFTO Monitor)

Execução única, de ponta a ponta, sem parar para pedir confirmação.

## 0. REGRAS

- Projeto único: `C:\dev\ifto-monitor`. Sem cópias, sem pastas paralelas, sem arquivos fora dos caminhos que o projeto já usa.
- Seu sandbox não tem rede e não roda Gradle. Rode apenas: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npx cap sync android`. O pacote `@capgo/background-geolocation` JÁ FOI INSTALADO pelo usuário (confira em `package.json` e `node_modules/@capgo/background-geolocation`). Se NÃO estiver instalado, pare a seção 1 e registre isso no relatório, mas execute as seções 2 a 5 normalmente.
- Nunca remova do AndroidManifest as permissões de localização já existentes.
- Mantenha: identidade visual atual (verde #2F9E41, logotipo IF no ônibus), modo Demo isolado, modo Campo local, exportação CSV/GeoJSON, wake lock, safe-area.
- Idioma: português do Brasil.

## 1. PROBLEMA ENCONTRADO NO TESTE DE CAMPO (15/11/2026)

Uma viagem real de carro mostrou que o GPS PAROU quando a tela do celular foi bloqueada:
- Último ponto às 13:51:16 UTC; próximo ponto só às 14:29:16 UTC (38 minutos sem nenhum ponto), 53 km adiante.
- Depois, nova lacuna de 11 minutos (14:29:25 → 14:40:08).
- Pontos só voltaram quando o app foi reaberto.
Para os ônibus (coleta a partir de 16/11/2026) o celular ficará bloqueado no bolso. É OBRIGATÓRIO gravar com a tela apagada.

### 1.1 Provider nativo com serviço em primeiro plano
- Usar o plugin `@capgo/background-geolocation` (versão major 8, compatível com Capacitor 8). LEIA o README e os tipos em `node_modules/@capgo/background-geolocation` e use a API exatamente como documentada (start/stop, opções como `backgroundMessage`, `backgroundTitle`, `requestPermissions`, `distanceFilter`, e o formato do callback de localização).
- Criar um novo provider de GPS (seguindo a abstração de providers que o projeto já tem) chamado `BackgroundNativeProvider`, usado automaticamente no Android nativo quando a viagem real está ativa. Manter o provider atual (`@capacitor/geolocation` / navegador) como fallback na web e nos testes, e o provider simulado no modo Demo.
- Notificação persistente do serviço: título "IFTO Monitor", texto "Gravando percurso do transporte escolar". Ícone: o ícone do app (monocromático) já existente.
- Parâmetros: intervalo de coleta de 10 s (quando o plugin permitir configurar; caso contrário, o que ele oferecer, registrando a decisão), maior precisão disponível, sem filtro de distância mínima.
- Iniciar o serviço ao iniciar a viagem; parar ao finalizar ou cancelar. Se o app for reaberto com viagem ativa, retomar a ligação com o serviço sem duplicar pontos (deduplicar por timestamp).
- Todo ponto recebido continua passando pelo mesmo pipeline atual (filtro de precisão ≤ 50 m, campo `accepted`, `source`, `device_id`, persistência no IndexedDB).
- Se o plugin entregar pontos acumulados em lote ao voltar do segundo plano, gravar todos na ordem do timestamp.

### 1.2 Permissões e manifesto
- Garantir no AndroidManifest (diretamente ou via merge do plugin; confirme no manifesto mesclado quando existir em `android/app/build/intermediates` — se o build ainda não rodou, declare explicitamente): `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`.
- Atualizar `scripts/check-android-manifest.mjs` para FALHAR o build se faltar qualquer uma dessas permissões, e imprimir "Manifesto: permissões de localização e segundo plano presentes" quando OK.

### 1.3 Fluxo de permissão e orientação ao usuário
- Ao iniciar a primeira viagem real, mostrar tela explicativa em português: "Para gravar com a tela bloqueada, permita a localização 'o tempo todo' e as notificações." Botões: "Continuar" e "Agora não".
- Se a permissão de segundo plano for negada, ainda iniciar a viagem (a gravação funciona com o app aberto), mas mostrar aviso amarelo persistente na tela Viagem: "Gravação em segundo plano desativada. Mantenha o app aberto ou permita 'o tempo todo' nos Ajustes do Android."
- Em Ajustes > "Diagnóstico de GPS" (criar se não existir): estado das permissões (primeiro plano / segundo plano / notificação), hora do último ponto recebido, intervalo médio dos últimos 10 pontos, provider em uso (nativo em segundo plano / navegador / simulado) e orientação sobre economia de bateria: "Em Configurações do Android > Apps > IFTO Monitor > Bateria, escolha 'Sem restrições'" (aparelhos Motorola e outros podem encerrar o app em segundo plano).
- Na tela Viagem, indicador de estado: "Gravando (segundo plano ativo)" em verde, ou "Gravando (somente com o app aberto)" em amarelo.

## 2. LACUNAS DE SINAL (não inventar percurso)

- Definir lacuna: intervalo entre dois pontos consecutivos ACEITOS maior que max(60 s, 3 × intervalo configurado).
- Distância total: NUNCA somar o salto entre pontos separados por uma lacuna. Somar apenas trechos contínuos.
- Mapa: desenhar a trilha em segmentos contínuos (verde #2F9E41, espessura 4). Entre segmentos separados por lacuna, desenhar linha tracejada cinza fina com o texto/legenda "Sem sinal por mm:ss". Marcador de início e fim da lacuna.
- Resumo da viagem: acrescentar "Lacunas de sinal: N (total mm:ss)". Se N > 0, mostrar selo amarelo "Gravação incompleta".
- Exportação: incluir nos arquivos o campo/coluna `gap_before_s` (segundos desde o ponto anterior quando for maior que o limite; vazio caso contrário) no CSV, e a propriedade correspondente no GeoJSON; as lacunas no GeoJSON viram uma feature `LineString` com `properties.type = "gap"`, separada da trilha.
- Velocidade implausível: se a velocidade média entre dois pontos aceitos exceder 200 km/h, marcar o ponto com `suspect = true` (não descartar) e não somar a distância desse trecho.

## 3. PARADAS: PONTOS "CONGELADOS" DE BAIXA PRECISÃO

Dado real: parada de ~95 s (13:49:14 a 13:50:49 UTC) em que o GPS devolveu 7 pontos com coordenadas idênticas à última posição boa e precisão de ~330 m; o filtro corretamente os rejeitou, mas a parada ficou curta (cerca de 17 s) porque só contaram os pontos aceitos.
- Regra nova no detector: pontos rejeitados por precisão cujas coordenadas sejam IDÊNTICAS às do último ponto aceito, com velocidade 0, contam como continuação da parada em andamento (estendem o fim da parada), marcados internamente como `stationary_extended`. Nunca iniciam uma parada sozinhos e nunca estendem uma parada se as coordenadas diferirem do último ponto aceito.
- Manter os demais parâmetros (velocidade < 3 km/h, mínimo 15 s, raio 25 m ou a precisão, precisão máxima 50 m).
- Teste com fixture real anonimizada (deslocar todas as coordenadas por um deslocamento constante, mantendo os tempos): sequência em movimento até 13:48:59, 7 pontos congelados de baixa precisão de 13:49:14 a 13:50:14, 2 pontos aceitos parados às 13:50:32 e 13:50:49, e movimento às 13:50:58. Esperado: exatamente 1 parada, com duração entre 85 s e 100 s.
- Teste: pontos rejeitados com coordenadas DIFERENTES do último aceito não estendem a parada.

## 4. TESTES ADICIONAIS

1. Lacuna de 38 min com salto de 53 km: a distância total NÃO inclui o salto; o resumo mostra 1 lacuna; o GeoJSON tem a feature `gap`.
2. Lacuna menor que o limite (ex.: 45 s com intervalo de 10 s) não conta como lacuna.
3. Velocidade implausível marca `suspect` e não soma distância.
4. Retomada de viagem ativa: reabrir o app com a viagem em andamento não duplica pontos (mesmo timestamp).
5. Provider nativo indisponível (web/Demo): usa o fallback sem erro.
6. Os 63 testes existentes continuam passando.

## 5. DOCUMENTAÇÃO E ENTREGA

- Atualizar `docs/RELATORIO_FINAL.md` com a seção "GPS em segundo plano v1.6" (o que foi feito, o plugin usado, limitações) e `docs/TESTES_CAMPO.md` com o teste: "Iniciar viagem, bloquear a tela, andar ou dirigir por 10 minutos com o celular no bolso, desbloquear e conferir se há pontos a cada ~10–20 s sem lacuna; repetir com o app 'Sem restrições' de bateria".
- Rodar `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npx cap sync android` e corrigir o que falhar.
- Relatório final curto, em português: arquivos alterados, resultado de cada comando, decisões tomadas, o que depende de teste no aparelho. Última linha: "Feche Chrome/Word/Edge, rode `wsl --shutdown` e depois `cd C:\dev\ifto-monitor; npm run android:apk`".
