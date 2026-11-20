# Relatos de alunos (v2.2.0)

Quem usa o app (ou a página web `#/relatar`, via QR) preenche **uma única tela** (o mesmo componente `src/shared/QuickReport.tsx`), com barra fixa no rodapé:

1. Título "Relatar problema" + contador "N marcados" e a faixa "Emergência agora? Ligue 190, 193 ou 192.".
2. **Ônibus** (01, 02, 03, Não sei), pré-marcado pelo QR (`?bus=`) ou pelo último usado.
3. **Mais comuns** (8 pílulas, campo `common` em `reportChecklist.ts`): Quebrou na estrada, Atrasou, Superlotado, Sem cinto, Não passou, Alta velocidade, Pneu furado, Muito quente. Mesmo estado da lista completa.
4. **Ver todos os problemas**: 7 categorias em acordeão com os 51 itens.
5. Barra fixa: **Tirar foto** (até 2), **Descrever** (até 500 caracteres) e **Enviar relato**. Sem marcação, o envio mostra "Marque pelo menos um problema.".

Automáticos: data/hora, sentido (ida antes do meio-dia, volta depois), `quando=agora`, honeypot.

## Contrato com a nuvem (inalterado)

Edge Function `submit-report`, duas chamadas `POST` em `/functions/v1/submit-report` (headers `apikey`, `Authorization: Bearer <chave>`, `Content-Type: application/json`):

1. `{ action: "create", bus_label, route_name, category, message, photos: [{mime_type, size_bytes}], honeypot: "" }` → `{ report_id, finalize_token, uploads: [{path, token}] }`.
2. Upload de cada foto na URL assinada (`ifto-reports`), depois `{ action: "finalize", report_id, finalize_token, paths }`.

Regras de `validateReport` (`supabase/functions/_shared/validate.ts`): `bus_label` 1–60 caracteres; `route_name` ≤ 80; `message` ≤ 500; textos sem `<` nem `>`; `category` ∈ {`atraso`, `quebra`, `superlotacao`, `parada_nao_feita`, `desvio`, `limpeza_conservacao`, `seguranca`, `outro`}; ≤ 2 fotos, `image/jpeg|png|webp`, 1 byte–1 MB; precisa de texto ou foto; `honeypot` vazio. A tabela ainda exige `message` ≤ 500 e texto ou foto (`reports_text_or_photo`).

**Atenção ao erro 400**: a função devolve **400 "Não foi possível enviar"** para qualquer falha que não seja de validação (inclusive erro de banco, como migração não aplicada ou função `consume_report_rate` ausente). Só as falhas de validação trazem mensagem própria. O app agora traduz: mensagens de validação ficam específicas; 400 genérico vira "O servidor recusou o relato (erro 400 sem detalhe). Provável problema de configuração da nuvem…", com o código HTTP guardado no relato e exibido em "Meus relatos". Se isso aparecer com payload válido, confira nos logs da função e se as migrações `20261117120000` e `20261117130000` (coluna `finalize_token` e função `consume_report_rate`) estão aplicadas no projeto.

O app valida com a mesma `validateReport` antes de enviar; o teste `tests/v221-contract.test.ts` replica as regras e cobre 1 ou vários problemas, urgentes, com e sem texto (inclusive comentário colado acima do limite, que é truncado — os problemas marcados nunca se perdem), 0/1/2 fotos e ônibus conhecido ou "Não sei". Erros 4xx marcam o relato como "Falhou" (sem reenvio automático; botão "Reenviar"); rede, 408 e 5xx ficam "Pendente" com reenvio automático.

## Linha estruturada (início do campo `message`)

```
[v1|u=maria@ifto.edu.br|n=Maria Silva|bus=02|sentido=ida|quando=agora|trip=ab12cd34|loc=-10.16735,-48.86950|problemas=pneu_furado,sem_cinto] texto do aluno
```

| Campo | Valores |
|---|---|
| `v1` | `CHECKLIST_VERSION` |
| `u` | **opcional**: e-mail do usuário do app (até 60 caracteres); omitido na página web (QR) |
| `n` | **opcional**: nome do usuário (até 30 caracteres) |
| `bus` | número do ônibus (`01`, `02`, `03`) ou `nao_sei` |
| `rota` | **opcional** (só se houver, p. ex. durante a viagem): nome da rota ou `nao_sei` |
| `sentido` | `ida` (antes do meio-dia) ou `volta`; omitido se não houver |
| `quando` | `agora` (fixo no formulário em uma tela) |
| `trip` | **opcional**: 8 primeiros caracteres do id da viagem em andamento |
| `loc` | **opcional**: último ponto da viagem, `lat,lon` com 5 casas; fora da viagem não é coletado |
| `lotacao` | **opcional**, legado (`poucos`, `metade`, `cheio`, `superlotado`) |
| `problemas` | ids do checklist, separados por vírgula, na ordem do checklist |

- **Limite de 500 caracteres** (Edge Function): a linha é limitada a **400**. Os campos opcionais entram por prioridade (`trip`, `loc`, `u`, `n`, `rota`, `lotacao`) só enquanto couberem; o app impede marcar tantos itens que `v1`, `bus`, `quando` e `problemas` passem de 400; o **comentário é sempre o primeiro a ser truncado** e os problemas marcados nunca se perdem.
- O leitor (`parseStructuredLine`) aceita linhas com ou sem qualquer campo opcional e relatos antigos (sem linha, ou `v1` com `rota`/`lotacao`); no painel e no CSV as colunas ausentes ficam vazias.
- **Rota**: será inferida depois, cruzando ônibus e horário do relato com as viagens GPS (`trips.bus_label` e período). `route_name` vai vazio ao servidor quando não há viagem.
- `category` = categoria do **item de maior urgência** (U > A > N; empate: o primeiro na ordem do checklist), conforme a tabela abaixo.
- Relatos antigos (sem a linha) continuam normais; o painel só não mostra etiquetas.

## Checklist (versão 1 — 51 itens, 7 seções)

Fonte única: `src/shared/reportChecklist.ts`. Ids são permanentes (nunca renomear, só adicionar); rótulos podem mudar. U = urgente, A = alta, N = normal. "Relato urgente" = tem ao menos um item U.

**Seção 1 — Quebra e problemas mecânicos**

| id | Rótulo | Urgência | Categoria enviada |
|---|---|---|---|
| `quebrou_parou` | Ônibus quebrou / parou na estrada | U | `quebra` |
| `pneu_furado` | Pneu furado | A | `quebra` |
| `motor_parou` | Motor parou / perdeu força | A | `quebra` |
| `superaquecimento_fumaca` | Superaquecimento ou fumaça | U | `quebra` |
| `freio_problema` | Problema nos freios | U | `quebra` |
| `nao_pegou` | Ônibus não ligou / bateria | A | `quebra` |
| `sem_combustivel` | Ficou sem combustível | A | `quebra` |
| `vazamento` | Vazamento (óleo, água ou combustível) | A | `quebra` |
| `porta_defeito` | Porta não abre ou não fecha direito | A | `quebra` |
| `barulho_mau_estado` | Barulho estranho ou ônibus em mau estado geral | N | `quebra` |

**Seção 2 — Horário e itinerário**

| id | Rótulo | Urgência | Categoria enviada |
|---|---|---|---|
| `nao_passou` | Ônibus não passou | A | `atraso` |
| `atraso_15` | Atrasou mais de 15 minutos | N | `atraso` |
| `atraso_30` | Atrasou mais de 30 minutos | A | `atraso` |
| `passou_adiantado` | Passou adiantado (perdi o ônibus) | A | `atraso` |
| `trajeto_alterado` | Mudou o trajeto | A | `desvio` |
| `nao_parou_ponto` | Não parou no meu ponto | A | `parada_nao_feita` |
| `nao_esperou` | Não esperou os alunos | N | `parada_nao_feita` |
| `chegou_tarde_campus` | Chegou ao campus depois das 08:00 | A | `atraso` |
| `volta_nao_saiu_17h` | Ônibus da volta não saiu às 17:00 | A | `atraso` |
| `volta_nao_chegou_19h` | Ônibus da volta não chegou até 19:00 | A | `atraso` |
| `deixou_ponto_errado` | Deixou aluno em ponto errado | A | `parada_nao_feita` |

**Seção 3 — Segurança**

| id | Rótulo | Urgência | Categoria enviada |
|---|---|---|---|
| `sem_cinto` | Sem cinto de segurança (ou cinto quebrado) | A | `seguranca` |
| `superlotado` | Superlotado / gente em pé | A | `superlotacao` |
| `sem_lugar` | Aluno ficou sem lugar para sentar | N | `superlotacao` |
| `alta_velocidade` | Motorista em alta velocidade | A | `seguranca` |
| `freadas_curvas` | Freadas ou curvas bruscas | N | `seguranca` |
| `motorista_celular` | Motorista usando celular | A | `seguranca` |
| `desrespeito_transito` | Motorista desrespeitou o trânsito (sinal, ultrapassagem perigosa) | A | `seguranca` |
| `motorista_alcool` | Suspeita de motorista alcoolizado | U | `seguranca` |
| `saida_emergencia` | Saída de emergência bloqueada ou sem extintor | A | `seguranca` |
| `acidente_colisao` | Acidente ou colisão | U | `seguranca` |
| `estrada_ruim` | Estrada em mau estado (buracos, lama, poeira) | N | `seguranca` |
| `trecho_perigoso` | Ponte ou trecho perigoso | A | `seguranca` |

**Seção 4 — Conforto e conservação**

| id | Rótulo | Urgência | Categoria enviada |
|---|---|---|---|
| `muito_quente` | Muito quente / sem ventilação | N | `limpeza_conservacao` |
| `janela_defeito` | Janela quebrada ou que não abre | N | `limpeza_conservacao` |
| `banco_quebrado` | Banco quebrado ou solto | N | `limpeza_conservacao` |
| `onibus_sujo` | Ônibus sujo | N | `limpeza_conservacao` |
| `mau_cheiro` | Mau cheiro | N | `limpeza_conservacao` |
| `goteira` | Entra chuva / goteira | N | `limpeza_conservacao` |
| `sem_luz_interna` | Sem iluminação interna (à noite) | A | `limpeza_conservacao` |
| `som_alto` | Som ou barulho excessivo | N | `limpeza_conservacao` |

**Seção 5 — Motorista e convivência**

| id | Rótulo | Urgência | Categoria enviada |
|---|---|---|---|
| `motorista_desrespeito` | Motorista tratou mal ou foi desrespeitoso | A | `outro` |
| `briga_assedio` | Briga, bullying ou assédio dentro do ônibus | U | `seguranca` |
| `estranhos_onibus` | Pessoas estranhas ou não autorizadas no ônibus | A | `seguranca` |
| `sem_acessibilidade` | Sem acessibilidade (cadeirante / mobilidade reduzida) | A | `outro` |
| `cobranca_indevida` | Cobrança indevida | N | `outro` |

**Seção 6 — Pontos de parada**

| id | Rótulo | Urgência | Categoria enviada |
|---|---|---|---|
| `ponto_sem_abrigo` | Ponto sem abrigo (sol e chuva) | N | `outro` |
| `ponto_perigoso` | Ponto perigoso (beira de pista, escuro) | A | `seguranca` |
| `ponto_sem_sinalizacao` | Ponto sem sinalização | N | `outro` |

**Seção 7 — Outros**

| id | Rótulo | Urgência | Categoria enviada |
|---|---|---|---|
| `elogio` | Quero elogiar (tudo certo hoje) | N | `outro` |
| `outro` | Outro problema (explique no campo opcional) | N | `outro` |

## Painel (`#/painel`)

- **Relatos**: etiquetas coloridas por urgência (U vermelho, A laranja, N cinza), ônibus, rota, sentido, quando, fotos; filtros por ônibus, rota, sentido, seção, urgência e período; urgentes no topo.
- **Resumo**: ranking por problema, por ônibus, por rota, por semana (segunda-feira), % de urgentes e problemas mais frequentes por ônibus.
- **Exportar CSV** `ifto-monitor_relatos_<periodo>.csv` (UTF-8 com BOM, separador `;`): `data_local`, `onibus`, `rota`, `sentido`, `quando`, `lotacao`, `urgente` (0/1), `n_problemas`, uma coluna 0/1 por id do checklist, `problemas` (rótulos separados por `;`), `comentario`, `n_fotos`, `usuario_nome`, `usuario_email`, `trip_id_curto`, `latitude`, `longitude` (as cinco últimas vazias quando ausentes).

## Fila offline (app)

Sem internet, o relato fica "Pendente" no aparelho (inclusive as fotos) e é reenviado ao voltar a conexão ou ao abrir o app. Relatos recusados pelo servidor ficam "Falhou" e só são reenviados por toque em "Reenviar".
