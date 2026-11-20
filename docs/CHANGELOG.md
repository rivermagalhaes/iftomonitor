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
