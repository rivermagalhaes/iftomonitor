# PROMPT v1.7 — Gravação resiliente (Android derruba o serviço) e Rota da viagem — IFTO Monitor

Execução única, de ponta a ponta, sem parar para pedir confirmação.

## 0. REGRAS

- Projeto único: `C:\dev\ifto-monitor`. Sem cópias, sem pastas paralelas, sem arquivos fora dos caminhos que o projeto já usa.
- Seu sandbox não tem rede e não roda Gradle. Rode apenas: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npx cap sync android`. NÃO instale pacotes novos. Use somente o que já está em `package.json` (inclui `@capgo/background-geolocation`, `@capacitor/app`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/network`). Leia os tipos em `node_modules/@capgo/background-geolocation` para saber o que o plugin oferece (por exemplo `openSettings`, estado do serviço, eventos).
- Não altere: permissões do AndroidManifest já existentes, paleta, logotipo, lacunas de sinal (v1.6), detecção de paradas. Exportação e banco só mudam como descrito nas seções 2 e 4 (migrações idempotentes, sem perder nenhum dado existente).
- Idioma: português do Brasil.

## 1. O QUE ACONTECEU NO CAMPO (15/11/2026)

Na viagem "Ônibus 02" o Android derrubou a gravação nos primeiros minutos (último ponto 20:37:11 UTC; próximo só 20:58:25 UTC, lacuna de 1.274 s, ~16 km de percurso sem pontos). O usuário percebeu, parou e reiniciou a gravação; depois disso a gravação foi contínua por 37 minutos, um ponto a cada 9–10 s. Ou seja: a gravação em segundo plano FUNCIONA, mas o Android (Motorola) mata o serviço quando o app está com restrição de bateria, e o app não percebe nem avisa. Para a coleta nos ônibus, o app precisa (a) reduzir a chance de ser morto, (b) detectar quando foi morto e (c) avisar o motorista/pesquisador e se recuperar sozinho.

## 2. DETECÇÃO DE INTERRUPÇÃO E RECUPERAÇÃO AUTOMÁTICA

- **Vigia (watchdog) na camada JS enquanto o app estiver vivo:** a cada 15 s, se houver viagem ativa e o último ponto recebido for mais antigo que max(45 s, 3 × intervalo), considerar o serviço interrompido: (1) registrar um evento `recording_interrupted` com horário do último ponto e horário da detecção; (2) tentar reiniciar o serviço do plugin sem criar nova viagem e sem duplicar pontos; (3) mostrar o aviso da seção 3.
- **Ao voltar do segundo plano** (evento de retomada do `@capacitor/app` e `visibilitychange`): fazer a mesma checagem imediatamente. Se o serviço morreu enquanto o app estava fechado, o primeiro ponto novo aparece com `gap_before_s` (já suportado pela v1.6) e o evento é registrado.
- **Reabrir o app com viagem ativa** (processo morto pelo Android): detectar a viagem em andamento no banco, religar o serviço, registrar `app_restarted` e exibir o aviso.
- Eventos guardados com a viagem (campo `events` no registro da viagem; migração de banco sem perder dados existentes): `{type, at, details}`. Exportação: incluir em ambos os formatos — no CSV como colunas de resumo da viagem não são necessárias; no GeoJSON, `properties.events` na feature da viagem. No Detalhe da viagem, listar "Eventos da gravação" com hora e tipo em português ("Gravação interrompida às 17:37", "Gravação retomada às 17:58").

## 3. AVISOS E ORIENTAÇÃO AO USUÁRIO

- **Banner de interrupção** na tela Viagem (e ao reabrir o app): amarelo, fechável, texto: "A gravação ficou parada das HH:MM às HH:MM. O Android pode estar limitando o app. Veja o guia de bateria." com botão "Ver guia".
- **Guia de bateria** (tela em Ajustes > "Gravação confiável"), passo a passo em português para Motorola/Android 14+:
  1. Configurações > Apps > IFTO Monitor > Bateria > "Sem restrições".
  2. Configurações > Apps > IFTO Monitor > Permissões > Localização > "Permitir o tempo todo" (com localização precisa).
  3. Permitir notificações do app (a notificação fixa "Gravando percurso" não pode ser dispensada).
  4. Abrir os apps recentes e fixar/trancar o IFTO Monitor (ícone do app no topo do cartão > "Manter aberto").
  5. Desativar a economia de bateria do sistema durante a coleta.
  Botão "Abrir configurações do app" usando a função do plugin ou do `@capacitor/app` se existir; se não existir, mostrar só o texto.
- **Lista de verificação antes de iniciar cada viagem real** (tela curta, pulável com "Já configurei, iniciar"): quatro itens com caixas de seleção (localização o tempo todo, notificações, bateria sem restrições, app fixado). Guardar a escolha "não mostrar de novo" só por 24 h, depois pergunta de novo.
- Indicador na tela Viagem: "Gravando (segundo plano ativo)" verde; "Interrompida — reiniciando…" amarelo; "Parada" vermelho. Mostrar também "Último ponto há N s".

## 4. ROTA DA VIAGEM (escolher ao iniciar e editar depois)

Contexto: ao iniciar a viagem (Ônibus 01, 02 ou 03) o aluno/pesquisador precisa informar a rota que está fazendo (ex.: Jardim Paulista, Pouso Alegre, Serrano). Depois, o coordenador precisa poder corrigir a rota no histórico.

### 4.1 Modelo de dados
- Nova tabela `routes` (IndexedDB e esquema Supabase documentado): `id` (uuid), `name`, `active` (bool), `created_at`, `updated_at`, `sync_status`.
- Em `trips`: `route_id` (nullable) e `route_name` (texto, sempre preenchido junto com `route_id`, para o nome permanecer legível em exportações mesmo se a rota for desativada).
- Migração idempotente: viagens antigas ficam com rota vazia e aparecem como "Sem rota".
- Semear a tabela `routes` apenas quando estiver vazia, no modo Campo local: "Jardim Paulista", "Pouso Alegre", "Serrano" (editáveis, renomeáveis e desativáveis). O modo Demo usa o próprio banco isolado, com rotas de exemplo.

### 4.2 Tela Viagem (antes de iniciar)
- Depois de escolher o veículo (Ônibus 01/02/03), mostrar o campo "Rota" com as rotas ativas como botões grandes (chips) de seleção rápida, mais o botão "Outra rota…" que abre um campo de texto para criar uma rota nova na hora.
- Pré-selecionar a última rota usada naquele veículo (o usuário pode trocar com um toque).
- Iniciar sem rota é permitido ("Sem rota definida"), com aviso discreto "Você pode definir a rota depois no Histórico".
- Durante a viagem, botão "Editar rota" na tela Viagem: escolher outra rota ou criar nova. A mudança vale para a viagem inteira (`route_id`/`route_name` passam a ser a última escolha) e registra o evento `route_changed` com horário, rota anterior e nova (usa o mesmo campo `events` da seção 2).

### 4.3 Edição posterior (Histórico > Detalhe da viagem)
- Botão "Editar rota" no Detalhe da viagem: escolher da lista ou digitar nova rota. Ao salvar, atualizar `route_id`/`route_name`, registrar o evento `route_edited` (horário, rota anterior, rota nova), atualizar `updated_at` e voltar `sync_status` para pendente.
- Mostrar a rota no cabeçalho do cartão do detalhe e em cada cartão do Histórico (ex.: "Ônibus 02 · Serrano").

### 4.4 Histórico
- Filtros por veículo e por rota (chips), com contagem de viagens. "Todas" como padrão.

### 4.5 Ajustes > Rotas
- Lista de rotas com: adicionar, renomear, ativar/desativar. Não permitir excluir rota que tenha viagens (só desativar).
- Renomear uma rota atualiza `route_name` nas viagens vinculadas (é correção de grafia), mantendo `route_id`.
- Validação: nome com 2 a 60 caracteres; sem duplicar (ignorar maiúsculas, acentos e espaços nas pontas).

### 4.6 Exportação
- CSV: nova coluna `route` (nome da rota; vazio se não houver) em todas as linhas, logo depois de `trip_id`.
- GeoJSON: `properties.route` e `properties.route_id` na feature da viagem.
- Nome do arquivo exportado inclui a rota, sem acentos e com hífens: `ifto-monitor_Onibus-02_Serrano_20261115-1341_<id8>.csv`; sem rota, mantém o padrão atual.

### 4.7 Preparação para a nuvem
- Documentar em `docs/` o esquema Supabase da tabela `routes` e da coluna `trips.route_id` com políticas de acesso coerentes com o restante do plano (sem alterar nenhuma nuvem agora).

## 5. TESTES

0. Rotas: (a) criar rota na hora ao iniciar e ela aparece na lista; (b) a última rota por veículo vem pré-selecionada; (c) iniciar sem rota funciona; (d) trocar a rota durante a viagem registra `route_changed`; (e) editar no Detalhe registra `route_edited` e atualiza o Histórico; (f) renomear atualiza as viagens vinculadas; (g) rota com viagens não pode ser excluída, só desativada; (h) nome duplicado é recusado; (i) CSV tem a coluna `route` e o nome do arquivo traz o nome da rota; (j) GeoJSON traz `properties.route`; (k) migração mantém todas as viagens antigas ("Sem rota"); (l) o modo Demo continua isolado.

1. Viagem ativa, último ponto há 60 s → vigia marca interrupção, reinicia o serviço e registra `recording_interrupted`.
2. Retomada do app com último ponto antigo → mesma ação.
3. Reabrir com viagem ativa no banco → retoma sem criar nova viagem e sem duplicar pontos.
4. Evento aparece no GeoJSON (`properties.events`) e na tela de detalhe.
5. Sem viagem ativa, o vigia não faz nada.
6. Intervalo normal (10 s) nunca dispara o vigia.
7. Todos os testes anteriores continuam passando.

## 6. DOCUMENTAÇÃO E ENTREGA

- `docs/RELATORIO_FINAL.md`: seção "Gravação resiliente e rotas v1.7". `docs/TESTES_CAMPO.md`: acrescentar o roteiro "bloquear a tela por 30 minutos com o celular no bolso, sem abrir o app, e verificar se não há lacuna".
- Rodar lint, typecheck, test, build e cap sync; corrigir o que falhar.
- Relatório final curto, em português: arquivos alterados, resultado dos comandos, decisões e o que depende de teste no aparelho. Última linha: "Feche Chrome/Word/Edge, rode `wsl --shutdown` e depois `cd C:\dev\ifto-monitor; npm run android:apk`".
