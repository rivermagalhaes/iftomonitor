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
