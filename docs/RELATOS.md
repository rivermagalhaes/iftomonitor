# Relatos de alunos (v2.2.0)

O aluno responde um formulário rápido de 3 telas (app no modo Aluno e página web `#/relatar`, **o mesmo componente**: `src/shared/QuickReport.tsx`). Nada de digitação obrigatória.

## Contrato com a nuvem (inalterado)

Edge Function `submit-report` (`create` → envio das fotos → `finalize`). Campos: `bus_label`, `route_name`, `category`, `message` (≤ 500 caracteres), `photos` (≤ 2, ≤ 1 MB, JPEG/PNG/WebP), `honeypot` vazio. A coluna `category` aceita só 8 valores (`atraso`, `quebra`, `superlotacao`, `parada_nao_feita`, `desvio`, `limpeza_conservacao`, `seguranca`, `outro`).

## Linha estruturada (início do campo `message`)

```
[v1|bus=02|rota=Pouso Alegre|sentido=ida|quando=agora|lotacao=cheio|problemas=pneu_furado,sem_cinto,superlotado] comentário do aluno
```

| Campo | Valores |
|---|---|
| `v1` | `CHECKLIST_VERSION` |
| `bus` | número do ônibus (`01`, `02`, `03`) ou `nao_sei` |
| `rota` | nome da rota ou `nao_sei` |
| `sentido` | `ida` (indo para o IFTO), `volta` (voltando do IFTO); omitido se o aluno desmarcar |
| `quando` | `agora`, `manha`, `noite`, `outro_dia` |
| `lotacao` | `poucos`, `metade`, `cheio`, `superlotado`; omitido se não informado |
| `problemas` | ids do checklist, separados por vírgula, na ordem do checklist |

- Relatos antigos (sem a linha) continuam normais; o painel só não mostra etiquetas.
- O texto todo cabe em 500 caracteres: a linha é limitada a 400 (o app impede marcar mais itens) e o comentário usa o restante.
- `category` = categoria do **item de maior urgência** (U > A > N; empate: o primeiro na ordem do checklist), conforme a tabela abaixo. `route_name` fica vazio quando a rota é "Não sei".
- Leitura/escrita: `src/shared/reportForm.ts` (`buildStructuredLine`, `parseStructuredLine`).

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
- **Exportar CSV** `ifto-monitor_relatos_<periodo>.csv` (UTF-8 com BOM, separador `;`): `data_local`, `onibus`, `rota`, `sentido`, `quando`, `lotacao`, `urgente` (0/1), `n_problemas`, uma coluna 0/1 por id do checklist, `problemas` (rótulos separados por `;`), `comentario`, `n_fotos`.

## Fila offline (app)

Sem internet, o relato fica "Pendente" no aparelho (inclusive as fotos) e é reenviado ao voltar a conexão ou ao abrir o app. Relatos recusados pelo servidor ficam "Falhou" e só são reenviados por toque em "Reenviar".
