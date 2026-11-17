# PROMPT MESTRE — IFTO MONITOR v1.1 (execução única, ponta a ponta)

Você é um engenheiro de software sênior (React, TypeScript, Capacitor, SQLite, Android, geolocalização, offline-first). Implemente a **Prioridade 1** do IFTO Monitor em **uma única sessão, sem parar para pedir confirmação**. Decisões técnicas rotineiras são suas: tome-as e registre cada uma em uma linha em `docs/DECISOES.md`.

Projeto de ensino: *Desenvolvimento de uma Aplicação de Baixo Custo para Monitoramento de Rotas e Horários do Transporte Escolar* — IFTO, Campus Paraíso do Tocantins. Coordenador: Prof. Dr. River Souza Magalhães. Testes em campo em 14/11/2026; início previsto da coleta experimental nos ônibus em 16/11/2026.

---

## 0. REGRAS DE OPERAÇÃO (valem para tudo)

1. **Uma única pasta.** O diretório de trabalho atual é a raiz do projeto. Se já houver projeto aqui, trabalhe nele. Se não houver, crie o projeto direto nesta raiz, sem subpasta nova. Nunca crie cópias, pastas paralelas, versões `_v2`/`_novo` ou arquivos soltos fora da estrutura da seção 17.
2. **Bloqueio não interrompe.** Se algo travar (ferramenta ausente, plugin incompatível, SDK ausente), registre em `docs/PENDENCIAS.md` e continue com o restante. Só interrompa a sessão se o `npm install` básico for impossível.
3. **Não instale nada global.** Não instale JDK, Android Studio ou Android SDK, não aceite licenças em nome do usuário e não altere variáveis de ambiente do sistema. Se faltar, documente o que falta.
4. **Nada contra serviços externos reais.** Não crie projeto Supabase, não aplique migrations em servidor remoto, não faça `git push`, não peça nem grave credenciais. Use somente `.env.example` com placeholders.
5. **Chaves.** O app só pode conter a URL e a `anon key` do Supabase. Nunca `service_role`. `.env` fica no `.gitignore`.
6. **Vocabulário de status (obrigatório em todo relatório e documento):** `PRONTO` (verificado por comando executado nesta sessão), `PARCIAL`, `NÃO TESTADO` (exige celular, GPS real ou internet real) e `NÃO IMPLEMENTADO`. É proibido escrever "pronto" sem ter rodado a verificação correspondente. O agente não consegue observar GPS real nem tela bloqueada, então esses itens nunca recebem `PRONTO`.
7. **Idioma.** Interface e documentação em português do Brasil. Código, nomes de variáveis, tabelas e colunas em inglês. Todos os textos da interface ficam centralizados em `src/i18n/pt-BR.ts`.
8. **Git (opcional, local).** Se não houver repositório, rode `git init` e faça um commit local por fase. Nunca faça push.
9. **Prioridade.** Conclua e verifique toda a Prioridade 1 antes de tocar em qualquer item da Prioridade 2. Itens P2 e P3 só entram como o "preparar" descrito na seção 2.

---

## 1. ENTRADAS ESPERADAS NA PASTA

- `referencia/` — protótipo visual aprovado (HTML, imagens ou capturas), se existir. **Leia tudo ali antes de escrever qualquer tela.**
- `.env` — se existir, use-o. Se não existir, o app deve funcionar sem ele (seção 5).

Se `referencia/` **não existir**, construa as telas a partir da seção 3 e registre no relatório final: *"Fidelidade ao protótipo: NÃO VERIFICADA — protótipo não encontrado na pasta."* Nunca invente um redesenho para compensar.

---

## 2. ESCOPO

| Prioridade | Item | O que fazer nesta sessão |
|---|---|---|
| **P1** | Interface aprovada, navegação, modo demonstração | Implementar e testar |
| **P1** | Modo campo local, GPS real com app aberto, SQLite/IndexedDB | Implementar e testar |
| **P1** | Início e encerramento de viagem, recuperação após fechamento | Implementar e testar |
| **P1** | Detecção de paradas (com testes unitários), mapa, histórico, detalhe | Implementar e testar |
| **P1** | Exportação CSV e GeoJSON | Implementar e testar |
| **P1** | APK debug | Gerar se o ambiente permitir (seção 14) |
| **P1** | Documentação (seção 16) | Escrever |
| **P2** | Login mágico real (Supabase Auth + deep link) | **Preparar:** código do cliente atrás de `isSupabaseConfigured()`, deep link no Android, tela de login funcional. Sem credenciais, o login mostra "Nuvem não configurada" |
| **P2** | Sincronização com Supabase | **Preparar:** migrations SQL com RLS em `supabase/migrations/`, colunas `sync_status`, serviço de sync implementado e testado com cliente simulado (mock) |
| **P2** | GPS com tela bloqueada | **Preparar:** interface `LocationProvider` com uma implementação de segundo plano **só se** o plugin passar nos critérios da seção 8.3. Caso contrário, `NÃO IMPLEMENTADO` documentado |
| **P3** | Rotas, estatística de horários, painel admin, múltiplos veículos | Não implementar. Apenas listar em `docs/PENDENCIAS.md` |

---

## 3. IDENTIDADE VISUAL (obrigatória)

Reproduza fielmente o protótipo aprovado. Não redesenhe, não mude a paleta, não troque o ícone.

### 3.1 Tokens (Tailwind `theme.extend.colors`)

| Token | Hex | Uso semântico |
|---|---|---|
| `brand` | `#79A83B` | Botões primários, quadrado da marca, item ativo da navegação |
| `brand-light` | `#A8CF66` | Chips, destaques suaves, trilhas e fundos de ícone |
| `brand-dark` | `#2E5328` | Títulos, textos fortes, card de monitoramento |
| `danger` | `#D83232` | Indicador "Gravando", botão Encerrar, offline, erros |
| `surface` | `#F8FBF5` | Fundo do app |
| `white` | `#FFFFFF` | Cards |

### 3.2 Marca

- Ícone `BusFront` do `lucide-react` (confirme que existe na versão instalada), em branco, centralizado em um quadrado `#79A83B` de cantos arredondados.
- Usar na tela de login, no cabeçalho e no ícone Android. Não usar outro modelo de ônibus.
- **Cabeçalho da marca (conforme o protótipo):** à esquerda, o quadrado `#79A83B` bem arredondado com o `BusFront` branco de traço fino; ao lado, o título **"IFTO Monitor"** grande, semibold, em `brand-dark`, e abaixo o subtítulo **"Transporte escolar inteligente"** menor, em verde (`brand`). No canto direito, um ponto `danger` (vermelho) como indicador de estado. O bloco fica sobre fundo `surface` com cantos amplamente arredondados.
- O verde `#79A83B` é chamado de **"Oliva aberto"** no protótipo. Paleta de referência exibida lá: Oliva aberto `#79A83B`, Verde claro `#A8CF66`, Vermelho `#D83232`, Fundo `#F8FBF5`.
- O ícone do ônibus é exclusivo da marca. Na navegação, se o protótipo não definir outra coisa: Início = `House`, Viagem = `Route`, Histórico = `History`.

### 3.3 Padrões de interface

- Mobile-first, cantos arredondados, cards brancos, espaçamento equilibrado, ícones discretos.
- Botões grandes: altura mínima de 48 px. Campos de texto com fonte de pelo menos 16 px.
- Fonte moderna **empacotada localmente** (por exemplo `@fontsource-variable/inter`). Nunca carregar fonte de CDN, porque o app precisa funcionar offline.
- Respeitar áreas seguras do Android (`viewport-fit=cover`, `env(safe-area-inset-*)`).
- Funcionar também no navegador (demonstração).

---

## 4. STACK E VERSÕES

Usar: React, Vite, TypeScript `strict`, Tailwind CSS, Lucide React, Capacitor Android, SQLite nativo, IndexedDB (navegador), Supabase JS, Leaflet + OpenStreetMap, React Router (`HashRouter`), Vitest + Testing Library + `fake-indexeddb`, ESLint. **Não usar Next.js.** Não escrever Kotlin próprio.

Antes de instalar, **verifique** (`node -v`, `npm view <pacote> version peerDependencies engines`):

- A versão do Node instalada atende ao Vite e à versão major do Capacitor escolhida.
- Todos os plugins Capacitor têm a mesma major do `@capacitor/core`.
- Escolha **uma** versão do Tailwind (v3 ou v4) e use a integração correta com o Vite.
- Fixe versões exatas no `package.json` (sem `^`) depois de a instalação funcionar.

Plugins Capacitor previstos (confirmar compatibilidade): `@capacitor/geolocation`, `@capacitor/network`, `@capacitor/keep-awake` (ou equivalente mantido), `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/app`, `@capacitor/assets` (dev) e um plugin SQLite (candidato: `@capacitor-community/sqlite`; valide licença e compatibilidade).

Registre em `docs/DECISOES.md` uma tabela com pacote, versão escolhida e motivo.

---

## 5. MODOS DE OPERAÇÃO (decisão de arquitetura)

O prompt exige login real, mas a P1 não inclui Supabase configurado. Para o teste de campo não depender de internet nem de credenciais, o app tem **três modos**, cada um com seu próprio banco:

| Modo | Quando | Login | Banco | Sincroniza |
|---|---|---|---|---|
| **Demonstração** | Sempre disponível | Não | `ifto_monitor_demo` (separado) | Nunca |
| **Campo local** | `VITE_ALLOW_LOCAL_FIELD_MODE=true` (padrão no `.env.example` durante os testes) | Não. Exige apelido do operador + aceite do termo | `ifto_monitor` | Quando houver nuvem configurada (P2) |
| **Autenticado** | Supabase configurado e sessão válida | Link mágico (e Google se configurado) | `ifto_monitor` | Sim (P2) |

Regras:

- **Isolamento total:** o modo demonstração usa banco com nome diferente e jamais lê, grava ou sincroniza dados reais. Banner fixo e visível em todas as telas: **"MODO DEMONSTRAÇÃO — dados fictícios"**. Arquivos exportados em demo levam `demo` no nome.
- **Campo local:** na primeira vez, tela de termo de ciência curto (texto da seção 12) + apelido do operador (pode ser iniciais; não pedir nome completo). Guardar `consent_version` e `consent_accepted_at`. Registros ficam com `owner_user_id = NULL` e `operator_label` preenchido.
- **Em produção** basta `VITE_ALLOW_LOCAL_FIELD_MODE=false` para exigir login.
- **Login:** campo de e-mail institucional, botão "Entrar com e-mail" (verde), botão secundário "Continuar com Google" e indicador de conexão. Sem Supabase configurado, o botão de e-mail e o Google mostram indisponibilidade clara. Google só funciona com OAuth configurado. A primeira autenticação exige internet. Persistir a sessão para acesso offline ao histórico local. **Não simular login real.**
- Abaixo do card de login, dois links discretos: "Modo demonstração" e (se habilitado) "Modo campo local".

---

## 6. TELAS E NAVEGAÇÃO

Navegação inferior fixa com **3 itens: Início, Viagem, Histórico.** Sem outros menus. Telas auxiliares (detalhe da viagem, termo, ajustes) abrem por dentro das 3 abas, com botão voltar.

Todos os números vêm do banco local do modo atual. Nenhum valor fixo no modo real.

### 6.1 Início
- Saudação "Olá, {apelido/primeiro nome}" (se o protótipo definir outro texto, o protótipo prevalece).
- Indicador online/offline (use `@capacitor/network`; `navigator.onLine` sozinho não é confiável).
- Card verde de monitoramento e botão **"Iniciar nova viagem"** (leva à aba Viagem).
- Card de **viagem em andamento** (se houver): tempo decorrido, pontos e paradas **dessa viagem**, ao vivo.
- Três indicadores do banco local do modo atual: **pontos GPS**, **paradas**, **registros pendentes de sincronização**.
- Acesso ao histórico.
- Ícone de engrenagem no cabeçalho abre **Ajustes** (intervalo de GPS, precisão máxima, parâmetros de parada, versão do app, "ver termo de ciência"). Não é aba nova.

### 6.2 Viagem
**Sem viagem ativa:** seleção de veículo por botões grandes (Ônibus 01, 02, 03: identificadores provisórios, não rotas). Lápis para renomear o veículo (altera `vehicles.label`; viagens antigas mantêm o rótulo original em `vehicle_label_snapshot`). Botão **"Iniciar viagem"**. Nenhuma rota é exigida.

Ao iniciar, nesta ordem: (1) confirmar que há autorização (modo campo com termo aceito, ou usuário autenticado); (2) solicitar permissões; (3) gerar UUID da viagem; (4) gravar `started_at` UTC; (5) iniciar a captura; (6) persistir localmente.

**Com viagem ativa:** ponto vermelho pulsante com **"Gravando"**, cronômetro, contadores, precisão do último ponto, estado do GPS ("Sinal OK", "Sem sinal", "Precisão baixa"), mapa ao vivo, lista de paradas com **Confirmar / Descartar / Renomear**, botão **"Marcar parada agora"** (parada manual), e botão vermelho **"Encerrar viagem"** com diálogo de confirmação.

Ao encerrar: fechar parada aberta, gravar `ended_at`, status `finished`, abrir o detalhe da viagem.

### 6.3 Histórico
Lista de viagens (mais recentes primeiro). Cada item: data, veículo, início e fim, duração, distância estimada, nº de pontos, nº de paradas, situação de sincronização. Toque abre o **detalhe**: resumo, mapa com trajeto, paradas (com Confirmar/Descartar/Renomear) e botões **Exportar CSV** e **Exportar GeoJSON**. Não há exclusão de viagens nesta versão.

### 6.4 Comportamentos transversais
- Botão voltar do Android (`@capacitor/app`): navega para trás; durante gravação, nunca fecha o app sem confirmação.
- **Recuperação:** ao abrir o app, se existir viagem `recording` sem captura ativa, mostrar diálogo "Viagem interrompida encontrada" com **Retomar** (mesma viagem, `seq` continua) ou **Encerrar no último ponto** (`ended_at` = horário do último ponto, `ended_reason = 'recovered'`).
- Estados de erro com mensagem clara e ação: permissão negada, permissão negada permanentemente (orientar a abrir Ajustes do Android), GPS desligado, banco indisponível, falha de exportação.

---

## 7. MODELO DE DADOS

Uma camada de persistência abstrata (`src/data/`): interfaces de repositório + dois adaptadores (SQLite nativo; IndexedDB via `idb` ou Dexie). **As telas nunca acessam o banco diretamente.** Escreva uma **suíte de testes de contrato** única, parametrizada por adaptador.

Todos os IDs são UUID gerados no cliente. Datas em ISO 8601 UTC. Coordenadas em graus decimais (WGS84). Registrar no banco **antes** de qualquer envio.

| Tabela | Campos principais |
|---|---|
| `app_meta` | `key`, `value` (guarda `device_id` pseudônimo aleatório gerado na 1ª execução, `schema_version`, `consent_version`, `consent_accepted_at`). **Nunca usar IMEI, serial ou identificador de hardware.** |
| `vehicles` | `id`, `label`, `active`, `created_at`, `updated_at`, `sync_status` (semeia Ônibus 01, 02, 03) |
| `trips` | `id`, `vehicle_id`, `vehicle_label_snapshot`, `owner_user_id` (nulo no modo campo), `operator_label`, `status` (`recording`/`finished`), `started_at`, `ended_at`, `ended_reason` (`user`/`recovered`), `device_id`, `created_at`, `updated_at`, `sync_status` |
| `gps_points` | `id`, `trip_id`, `seq` (único por viagem), `latitude`, `longitude`, `accuracy_m`, `speed_mps` (nulo se indisponível), `recorded_at` (timestamp do GPS), `received_at` (relógio do aparelho), `device_id`, `source` (`gps`/`demo`), `accepted` (boolean), `sync_status` |
| `stops` | `id`, `trip_id`, `arrived_at`, `departed_at` (nulo enquanto aberta), `duration_s`, `latitude`, `longitude`, `avg_accuracy_m`, `status` (`candidata`/`confirmada`/`descartada`), `label`, `detected_by` (`auto`/`manual`), `created_at`, `updated_at`, `sync_status` |

- `sync_status` ∈ `pending` / `synced` / `error`, mais `sync_attempts` e `last_error` onde fizer sentido. A "fila de sincronização" **é** o conjunto de linhas com `sync_status != 'synced'`. Sem tabela de fila separada.
- "Registros pendentes" = soma das linhas `pending` das tabelas acima.
- Contagens e totais são calculados por consulta, nunca armazenados.
- `localStorage` só para preferências de interface e sessão do Supabase. **Nunca para trajetos.**
- Migração de esquema versionada (`schema_version`) desde o início.

---

## 8. GPS REAL

### 8.1 Interface
Crie `LocationProvider` (`start(config)`, `stop()`, eventos `onFix`, `onError`, `onStatus`) com implementações:
- `ForegroundProvider` (P1): `@capacitor/geolocation` com `watchPosition` e alta precisão.
- `SimulatedProvider` (demonstração).
- `BackgroundProvider` (P2, condicional; seção 8.3).

### 8.2 Coleta em primeiro plano (P1)
- Intervalo configurável, **padrão 10 s**. Como `watchPosition` pode emitir mais rápido, aceite no máximo um ponto por intervalo (tolerância de 10%).
- Manter a tela acesa durante a gravação (`keep-awake`), com aviso na interface. Isso garante o teste A com o app aberto.
- Gravar **cada ponto imediatamente** no banco. Perder internet jamais interrompe nada.
- **Nunca inventar coordenadas.** Sem sinal, não há ponto; a lacuna fica visível nos horários.
- Ponto com `accuracy_m` acima do limite (padrão **50 m**, configurável) é gravado com `accepted = false` (preserva o dado bruto) e **excluído** de distância, mapa de trajeto e detecção de paradas.
- `recorded_at` vem do timestamp do GPS; `received_at` do relógio do aparelho (o relógio pode estar errado, por isso os dois).
- Erros `PERMISSION_DENIED`, `POSITION_UNAVAILABLE` e `TIMEOUT` atualizam o estado exibido, sem encerrar a viagem.

### 8.3 Tela bloqueada (P2 — só preparar)
Só tente depois que **todos** os portões da P1 passarem. Avalie plugins de GPS em segundo plano no npm e **escolha somente se**: (a) licença permissiva (MIT/Apache) ou sem custo de uso; (b) mesma major do Capacitor instalado; (c) manutenção recente (versão publicada nos últimos 12 meses); (d) suporte a serviço em primeiro plano do tipo localização no Android atual. Se passar: configure permissões (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`) e a notificação persistente "IFTO Monitor está gravando a viagem". Se falhar no build ou na avaliação, remova o plugin e documente. **Estado final no relatório: `NÃO TESTADO` (nunca `PRONTO`) até haver teste real em aparelho.** Se não for confiável, a coleta com app aberto continua sendo a entrega e a pendência fica documentada.

---

## 9. DETECÇÃO DE PARADAS

Implemente como função pura e testável: `detectStops(points, config)` e uma classe incremental `StopDetector.push(point)` que usa a mesma lógica (para parada ao vivo). Sem dependência de React ou banco.

**Parâmetros (todos configuráveis, valores padrão):**

| Parâmetro | Padrão |
|---|---|
| `stopSpeedKmh` | 3 |
| `stopMinDurationS` | 15 |
| `stopRadiusM` | 25 (raio efetivo = `max(stopRadiusM, accuracy_m do ponto)`) |
| `maxAccuracyM` | 50 |
| `maxGapS` | 3 × intervalo de GPS |

**Regras:**
1. Considerar apenas pontos `accepted`.
2. Velocidade = `speed_mps` do GPS quando disponível e ≥ 0; senão derivar de distância (Haversine) ÷ tempo desde o ponto aceito anterior; se nenhuma estiver disponível, a decisão usa só o deslocamento.
3. Um ponto é "parado" se a velocidade < `stopSpeedKmh` **e** a distância ao centroide do grupo atual ≤ raio efetivo.
4. A **chegada** é o horário do primeiro ponto parado do grupo; a **saída**, o horário do último ponto parado. `duration_s = saída − chegada`.
5. O grupo só vira parada **candidata** quando a duração atinge `stopMinDurationS`. Ao vivo, a parada é criada e fica aberta (`departed_at` nulo) até o movimento retomar (2 pontos consecutivos fora do raio ou acima da velocidade).
6. Lacuna maior que `maxGapS` entre pontos **encerra** o grupo (não une paradas separadas por falta de sinal).
7. Jitter do GPS dentro do raio **não** gera várias paradas.
8. Toda parada automática nasce `candidata`. **Semáforos e congestionamentos não são pontos oficiais**; só o usuário confirma.
9. Coordenadas da parada = centroide dos pontos do grupo.

**Testes unitários obrigatórios:** parada de 60 s → 1 parada; 10 s → nenhuma; jitter dentro do raio → 1 parada; saída e retomada; duas paradas separadas; lacuna de sinal; pontos imprecisos ignorados; velocidade ausente (fallback por distância); parada ainda aberta no fim da série; viagem só em movimento → nenhuma parada.

Distância estimada da viagem = soma de Haversine entre pontos `accepted` consecutivos (teste com valor conhecido).

---

## 10. MAPA

- Leaflet com tiles OpenStreetMap quando houver conexão. **Não prometer mapa offline** (sem cache/pacote de mapas). URL de tiles configurável por `VITE_TILE_URL`; manter a atribuição "© OpenStreetMap contributors"; não pré-baixar tiles em massa (política de uso do OSM).
- Exibir: trajeto, ponto inicial, ponto final, posição atual e paradas candidatas/confirmadas.
- Use `L.divIcon` ou ícones próprios (evita o bug dos ícones padrão do Leaflet com Vite).
- **Fallback sem tiles:** detecte falha de tiles (`tileerror`) ou ausência de rede e mostre uma superfície local simplificada (SVG que projeta os pontos na caixa delimitadora, com fundo `surface` e grade leve), mantendo trajeto, início, fim, posição atual e paradas. Aviso discreto: "Mapa de fundo indisponível sem internet".
- O mapa nunca bloqueia a gravação: falha de mapa não pode afetar a coleta.

---

## 11. HISTÓRICO E EXPORTAÇÃO

- **CSV** (UTF-8 com BOM, separador vírgula, ponto decimal, datas ISO 8601 UTC). Colunas de pontos: `trip_id, seq, recorded_at, latitude, longitude, accuracy_m, speed_mps, accepted, source, device_id`. Arquivo separado de paradas: `stop_id, trip_id, arrived_at, departed_at, duration_s, latitude, longitude, status, label, detected_by`. Escape correto de aspas e vírgulas.
- **GeoJSON** (RFC 7946, `[longitude, latitude]`): uma `FeatureCollection` com um `LineString` (pontos `accepted`) com propriedades da viagem e um `Point` por parada com suas propriedades.
- Nome do arquivo: `ifto-monitor_{veiculo}_{AAAAMMDD-HHmm}_{trip8}.{ext}` (com `demo` no modo demonstração).
- Navegador: download por Blob. Android: `@capacitor/filesystem` + `@capacitor/share`.
- Os arquivos **não** contêm e-mail, nome do operador, telefone nem identificador de estudante; apenas `device_id` pseudônimo.

---

## 12. PRIVACIDADE E SEGURANÇA

- Localização só é coletada durante viagem iniciada por usuário autorizado (termo aceito no modo campo, ou autenticado). Sem viagem ativa, nenhuma coleta.
- Indicador de gravação sempre visível e botão de encerrar sempre acessível.
- O app rastreia o **veículo**, não estudantes. Não há mapa público, compartilhamento de posição ao vivo nem identificação de estudantes. Não gravar nomes de estudantes.
- Termo de ciência curto (texto em `pt-BR.ts`): finalidade da coleta, o que é coletado, que a coleta só ocorre durante a viagem, como encerrar, quem acessa os dados, e que a participação de menores exige autorização do responsável conforme a LGPD.
- Criar `docs/PRIVACIDADE.md` com rascunho de orientações e modelo de termo, **marcado explicitamente como rascunho a ser revisado pela instituição** (LGPD, menores, comitê de ética se aplicável).
- Controle de acesso no backend: RLS (seção 13). Nenhuma chave administrativa no app.

---

## 13. SUPABASE E SINCRONIZAÇÃO (P2 — preparar, sem executar contra servidor)

**Migrations** em `supabase/migrations/0001_init.sql` (+ `supabase/README` curto no `CONFIGURACAO_SUPABASE.md`):
- Tabelas espelhando a seção 7 (mesmos UUID como chave primária), mais `profiles(id → auth.users, email, role ('coletor'|'coordenador'), active)`.
- Índices: `gps_points(trip_id, seq)` único, `gps_points(trip_id, recorded_at)`, `trips(owner_user_id, started_at)`, `stops(trip_id)`.
- **RLS ativa em todas as tabelas**, sem acesso `anon`. Coletor ativo: `insert/select/update` apenas das próprias linhas (`owner_user_id = auth.uid()` com `with check`). Coordenador ativo: `select` em tudo. Nenhum `delete`.
- Cadastro autorizado: usuário só opera se existir em `profiles` com `active = true`.
- Validar a sintaxe do SQL: se a CLI do Supabase/Docker local existir, rodar lint local; senão marcar `NÃO TESTADO`.

**Serviço de sync** (`src/sync/`), testado com cliente simulado:
1. Só roda com internet **e** sessão válida; nunca no modo demonstração.
2. Envia viagens `finished` e seus pontos e paradas, nesta ordem: veículos → viagens → pontos → paradas.
3. Lotes de 500, `upsert` por `id` (idempotente, sem duplicar).
4. Marca `synced` **somente** os IDs confirmados pelo servidor.
5. Falha: `error`, `sync_attempts + 1`, nova tentativa com recuo exponencial (5 s, 30 s, 5 min, máximo 30 min).
6. Gatilhos: abertura do app, retorno da conexão, fim de viagem e botão manual "Sincronizar agora" no card de pendentes.
7. Nunca bloqueia a gravação. **Não prometer sincronização com o app totalmente encerrado.**

**Auth (preparar):** Supabase Auth com PKCE e link mágico. Deep link Android com esquema `br.edu.ifto.monitor://auth/callback` (intent-filter no manifest + tratamento no `@capacitor/app`). Documentar no `CONFIGURACAO_SUPABASE.md` que essa URL deve ser cadastrada em *Authentication → URL Configuration → Redirect URLs*, o limite do SMTP padrão do Supabase e a configuração do OAuth do Google.

---

## 14. ANDROID E APK

- `appId`: `br.edu.ifto.monitor` · `appName`: `IFTO Monitor` · `webDir`: `dist`.
- Ícone adaptativo e splash: gere o ícone (ônibus branco `BusFront` sobre `#79A83B`) renderizando o SVG do Lucide para PNG e use `@capacitor/assets`. Nada de ícone padrão do Capacitor.
- Permissões no manifest: localização (fina e aproximada) e as demais exigidas pelos plugins instalados. Justificativa das permissões em português na interface, antes do pedido do sistema.
- **Verificação de ambiente (registrar no RELATORIO_FINAL):** `node -v`, `npm -v`, `java -version`, `ANDROID_HOME`/`ANDROID_SDK_ROOT`, existência de `adb`, e uso do Gradle Wrapper do projeto.
- Executar: `npm run build` → `npx cap add android` (se ainda não existir) → `npx cap sync android`.
- **Se Java e SDK estiverem disponíveis:** `gradlew assembleDebug` (`gradlew.bat` no Windows; script `scripts/build-apk.mjs` escolhe pelo sistema operacional). Confirme com `ls -l` que `android/app/build/outputs/apk/debug/app-debug.apk` existe e informe o caminho e o tamanho. **Não copie o APK para outras pastas.**
- **Se faltar algo:** não declare APK gerado. Documente exatamente o que falta e o caminho alternativo (`npm run android:open` e gerar pelo Android Studio).

**Scripts do `package.json`:** `dev`, `dev:host` (`vite --host`), `build`, `lint`, `typecheck`, `test`, `android:sync` (`build` + `cap sync android`), `android:open` (`cap open android`), `android:apk` (`build` + sync + `assembleDebug`).

**Importante para o roteiro de testes:** o navegador só libera geolocalização em contexto seguro (`localhost` ou HTTPS). Abrir o servidor Vite pelo IP da rede local no celular (HTTP) **não** fornece GPS real. Para teste de GPS no celular, use o APK. Documente isso nos guias.

---

## 15. TESTES

**Automatizados (executar e corrigir até passar):**
- Detecção de paradas e distância (seção 9).
- Suíte de contrato dos repositórios (IndexedDB com `fake-indexeddb`): criar viagem, gravar pontos, encerrar, persistência após reabrir, contagens, `sync_status`.
- Ciclo da viagem: iniciar, gravar, encerrar, recuperação de viagem interrompida (retomar e encerrar no último ponto).
- Exportação: CSV (escape, BOM, colunas) e GeoJSON (ordem `[lon, lat]`, validade).
- Isolamento demo × real (bancos distintos; demo nunca entra no sync).
- Sincronização com cliente simulado: lote, idempotência, falha com nova tentativa, confirma só os IDs reconhecidos.
- Interface (Testing Library): navegação Início → Viagem → Histórico → detalhe → voltar; fluxo demonstração completo (modo demo → selecionar ônibus → iniciar → percurso simulado → simular parada → encerrar → ver no histórico); botões e estados de erro principais (permissão negada, sem sinal).
- Geolocalização simulada para o `ForegroundProvider` (sem depender de GPS real).

**Não automatizáveis aqui → `NÃO TESTADO` + roteiro em `docs/TESTES_ANDROID.md`:**
A GPS com app aberto · B GPS sem internet · C GPS com tela bloqueada · D retorno da conexão · E encerramento e reabertura · F parada e retomada do movimento. Para cada teste: pré-condições, passos, resultado esperado e **coluna "Resultado observado" em branco** para os alunos preencherem. O agente **não** preenche resultados que não observou.

---

## 16. DOCUMENTAÇÃO

Escreva de verdade (não esqueletos), objetiva e sem inventar funcionalidades:

| Arquivo | Conteúdo |
|---|---|
| `README.md` (raiz) | O que é, modos, como rodar, scripts, estrutura |
| `.env.example` (raiz) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ALLOW_LOCAL_FIELD_MODE=true`, `VITE_TILE_URL`, `VITE_GPS_INTERVAL_MS=10000` (placeholders, nunca valores reais) |
| `docs/GUIA_INSTALACAO.md` | Node, Java, Android SDK, instalação do APK (`adb install -r`, ou cópia manual com "fontes desconhecidas"), depuração USB |
| `docs/GUIA_CAPACITOR.md` | Como Capacitor liga web e Android, `sync`, `open`, atualizar plugins |
| `docs/GUIA_ALUNOS.md` | Didático, passo a passo, **cada comando comentado** com explicação simples, problemas comuns |
| `docs/TESTES_ANDROID.md` | Roteiro A–F (seção 15) |
| `docs/CONFIGURACAO_SUPABASE.md` | Criar projeto, aplicar migrations, RLS, cadastrar `profiles`, redirect URLs, Google OAuth |
| `docs/PRIVACIDADE.md` | Rascunho da seção 12 |
| `docs/DECISOES.md` | Decisões técnicas e versões |
| `docs/PENDENCIAS.md` | Pendências reais (P2/P3 e bloqueios) |
| `docs/RELATORIO_FINAL.md` | Relatório da seção 19 |

---

## 17. ESTRUTURA DE PASTAS (única)

```
./
├─ README.md  .env.example  package.json  vite.config.ts  capacitor.config.ts  ...
├─ referencia/            (protótipo, somente leitura)
├─ src/
│  ├─ app/  (rotas, layout, navegação)   ├─ screens/   ├─ components/
│  ├─ data/ (interfaces, sqlite/, indexeddb/, migrations)
│  ├─ services/ (trip, location, stops, export, network, auth)
│  ├─ sync/     ├─ i18n/pt-BR.ts   ├─ config/   └─ lib/ (geo, time)
├─ tests/  (ou *.test.ts ao lado do código; escolha um padrão)
├─ supabase/migrations/
├─ scripts/  (build-apk.mjs etc.)
├─ android/  (gerado pelo Capacitor)
└─ docs/
```

---

## 18. FASES COM PORTÕES (execute na ordem)

Cada portão exige `npm run typecheck && npm run lint && npm run test` verdes antes de avançar. Corrija o que falhar; não avance com erro.

| Fase | Entrega | Portão |
|---|---|---|
| F0 | Verificar ambiente e versões (seções 4 e 14); ler `referencia/`; criar `docs/DECISOES.md` | Tabela de versões escrita |
| F1 | Projeto Vite + TS strict + Tailwind (tokens) + ESLint + Vitest; marca e layout base com navegação | Build e navegação testada |
| F2 | Camada de dados (contrato + IndexedDB + SQLite), `app_meta`, veículos semeados | Suíte de contrato verde |
| F3 | Modos (demo / campo local / login), termo, apelido | Isolamento demo × real testado |
| F4 | Viagem: `LocationProvider`, `ForegroundProvider`, `SimulatedProvider`, ciclo da viagem, recuperação | Testes do ciclo verdes |
| F5 | Detecção de paradas + distância (testes primeiro) | Testes de paradas verdes |
| F6 | Telas: Início, Viagem, Histórico, detalhe, Ajustes, mapa com fallback | Testes de interface verdes |
| F7 | Exportação CSV e GeoJSON | Testes de exportação verdes |
| F8 | Android: ícones, manifest, permissões, `cap sync`, tentativa de APK | Resultado real registrado |
| F9 | **P2 preparar:** sync (mock), migrations, deep link, avaliação do plugin de segundo plano | Itens marcados com status honesto |
| F10 | Documentação completa e verificação final | Seção 19 |

Se o tempo ou o ambiente apertarem, **corte a F9 inteira**, nunca a F1–F8.

---

## 19. ENTREGA FINAL

Execute nesta ordem e **cole as saídas reais**:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test` (informe total de testes, passados e falhos)
4. `npm run build`
5. Suba o servidor com `npm run dev:host` em segundo plano, confirme resposta HTTP 200 por `curl` e informe a URL local. Lembre que o GPS real não funciona via HTTP pela rede local.
6. APK: informe o caminho e o tamanho **só depois de confirmar o arquivo** com `ls`; senão, diga que não foi gerado e por quê.

Grave tudo em `docs/RELATORIO_FINAL.md` e apresente no chat um resumo curto com:

- **Tabela de funcionalidades** com status (`PRONTO` / `PARCIAL` / `NÃO TESTADO` / `NÃO IMPLEMENTADO`) e a evidência de cada uma.
- **Fidelidade ao protótipo** (verificada ou não, conforme seção 1).
- **Pendências reais** (inclua: GPS com tela bloqueada, login real, sync real, SQLite nativo em aparelho, testes A–F).
- **Decisões que o usuário deve conhecer** (modos da seção 5, parâmetros padrão, plugins escolhidos).
- **Comandos para instalar e testar no Android** (`adb devices`, `adb install -r <caminho>`, ou `npm run android:open`).

Não declare que algo está pronto sem a verificação correspondente executada nesta sessão.

**INICIE AGORA: F0 → F8 (Prioridade 1) em sequência, depois F9 se couber, depois F10.**
