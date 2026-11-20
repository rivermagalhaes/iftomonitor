# Changelog

## 1.8.0 - 2026-11-16

- Hora local adicional em CSV/GeoJSON e nomes de arquivo; UTC preservado.
- Nome persistente do ônibus e snapshots bus_label/app_version por viagem; IndexedDB v3 preserva dados antigos.
- CSV de pontos com 16 colunas fixas; CSV de eventos selecionável com todos os tipos persistidos e detalhe JSON.
- Compartilhamento conjunto, fallback para destino sem suporte a múltiplos arquivos e eventos recolhidos abaixo do mapa.
- Pausa/retomada com eventos; GPS/permissões e reinícios do vigia registrados, com duração sem pontos.
- Paradas configuráveis em 10/15/20/30 s; indicador Gravação confiável e guia.
- Versão única no package.json; Android versionName 1.8.0 e versionCode 10800. Sem Gradle nesta tarefa.

## 2.1.0 - 2026-11-20

- Pontualidade: chegada ao campus (até 08:00), saída (17:00) e retorno (até 19:00) em horário de Fortaleza; tabela observada por proximidade; CSVs de pontualidade e de tabela observada.
- Configurações > Referências de horário (campus, raio, horários, tolerâncias) com restaurar padrões.
- Turno por viagem (automático/manhã/tarde-noite/ignorar) e aviso ao finalizar viagem sem rota.
- Painel web: aba Pontualidade (somente leitura). Android versionName 2.1.0, versionCode 21000.

## 2.2.0 - 2026-11-20

- **Dois modos no mesmo APK**: *Aluno* (só relata; nunca usa GPS, serviço em segundo plano nem bateria) e *Monitor* (tudo o que existia). Assistente de primeiro uso: termos (aceite por versão), escolha de modo, código do monitor (hash SHA-256; código inicial em `docs/MODOS.md`) e etapas de permissão (localização o tempo todo, avisos, uso contínuo via diálogo oficial). Quem já tem viagens salvas entra como monitor sem código. Ver `docs/MODOS.md`.
- `trip_started` grava `batteryExempt`, `locationAlways` e `notifications` no `detail` (sem mudar o schema). "Iniciar viagem" reabre só a etapa pendente.
- Removida a interface manual de bateria (indicador "Gravação confiável", seção em Configurações, guia e rota).
- **Relato rápido** (app Aluno e web `#/relatar`, mesmo componente): 3 telas, checklist de 51 itens em 7 seções (`src/shared/reportChecklist.ts`), até 2 fotos, linha estruturada no início de `message` (contrato da Edge Function inalterado). Fila offline no app. Ver `docs/RELATOS.md`.
- Painel: etiquetas por urgência, filtros, aba *Resumo*, exportação CSV dos relatos.
- **Velocímetro** na tela Viagem, excessos calculados dos pontos (≥ 80 e ≥ 100 km/h), detalhe no Histórico, CSVs e aba *Velocidade* no painel. Ver `docs/VELOCIDADE.md`.
- Decisões simples: o código do monitor é só barreira de uso; "urgente" = ao menos um item U; CSVs novos usam `;` e decimais com vírgula; a linha estruturada é limitada a 400 caracteres (o app impede marcar mais itens) para caber em 500 com o comentário.
- Android versionName 2.2.0, versionCode 22000; permissões `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` e `CAMERA`; `@capacitor/camera`.

## 2.2.1 - 2026-11-20

- Corrigido: Ajustes do monitor não tinha "Mudar para modo Aluno" (nunca foi implementado na 2.2.0, apesar de constar em `docs/MODOS.md`). Agora há o botão (com confirmação; bloqueado com viagem em andamento) e, no aluno, "Entrar como monitor" com código. Engrenagem nas telas do aluno.
- Corrigido: "Trocar modo de operação" (Ajustes) levava à tela de login antiga. Removido; login/demonstração desativados por `AUTH_LOGIN_ENABLED=false`; monitor novo entra no modo campo local automaticamente. Um celular que ficou em modo demonstração passa a campo local.
- Bolinha do topo agora é um indicador com significado (cinza/verde/amarelo/vermelho). Antes era sempre vermelha, sem significado.
- Auditoria: removidos os últimos textos sobre bateria (guia em Diagnóstico de GPS, mensagem de prontidão e texto da etapa). Versão/Nuvem subiram para o topo de Ajustes.
- Android versionName 2.2.1, versionCode 22001. Os testes que dependiam da tela de login ligam `VITE_AUTH_LOGIN_ENABLED`.
- **Formulário do aluno em uma tela** (app e `#/relatar`): ônibus, 8 pílulas "Mais comuns", 7 categorias em acordeão e barra fixa (Tirar foto, Descrever, Enviar relato). Removidos o fluxo de 3 etapas, a tela "Quase pronto" e os seletores de rota, "Quando foi?" e lotação. A linha estruturada deixa de levar `rota` e `lotacao` (aceitos se existirem); a rota será inferida pelas viagens GPS. Ver `docs/RELATOS.md`.
- Modo Aluno sem bolinha de status. Velocímetro conferido na tela Viagem (teste).
- Envio de relatos: o 400 do APK 2.2.0 vem da Edge Function (que usa 400 "Não foi possível enviar" também para falhas internas/de banco; não foi possível reproduzir pelo payload, que passa nas regras). O app passou a mostrar o motivo real, guardar o HTTP no relato e não reenviar 4xx em loop. Corrigido: comentário acima do limite deixava o texto > 500 e era recusado; agora é truncado. Contrato em `docs/RELATOS.md`.

## 2.3.0 - 2026-11-20

- **App único e simples, sem modos**: removidos Aluno/Monitor, código do monitor (e seu hash), "Mudar para modo Aluno", "Entrar como monitor", bloqueios de troca, `appMode`, `ModeContext`, `monitorCode` e os testes correspondentes. Ver `docs/USO.md` (antigo `MODOS.md`).
- **Primeiro uso**: termos (v2.3) e **cadastro rápido** (nome e e-mail, sem senha, só local). Ajustes: editar cadastro e "Trocar usuário" (não apaga viagens nem relatos). Usuário vai à nuvem em `extra.user` (viagem) e `u=`/`n=` (relato), sem mudar SQL.
- **Início** com dois botões gigantes (Iniciar viagem, Relatar problema); barra Início/Relatar/Histórico; Histórico com abas Viagens, Meus relatos e Relatórios (decisão: "Meus relatos" virou aba própria para não perder a lista local). `t.finish` agora é "Finalizar viagem".
- **Permissões só no primeiro Iniciar viagem** (assistente curto); depois só a etapa pendente. Quem só relata nunca vê pedido de permissão.
- **Relatar durante a viagem**: ônibus e rota preenchidos e `trip=`/`loc=` na linha; "Voltar ao início" no sucesso. Linha estruturada com `u`, `n`, `trip`, `loc` dentro do limite de 500 (comentário truncado primeiro, depois campos opcionais; problemas nunca perdidos).
- **Navegação**: cabeçalho fixo "← Voltar" no formulário e nas telas internas; "Descartar este relato?"; botão voltar do Android por rotas (minimiza no Início sem parar a gravação).
- Painel: usuário e filtro por usuário (relatos e viagens); CSV de relatos com `usuario_nome`, `usuario_email`, `trip_id_curto`, `latitude`, `longitude`.
- Decisões simples: o celular que ficou em "modo demonstração" cai no modo campo local; as chaves locais antigas (`ifto_app_mode`, `ifto_monitor_setup_done`) são ignoradas; o assistente de permissões usa um indicador local `ifto_trip_setup_done`.
- Android versionName 2.3.0, versionCode 23000.
