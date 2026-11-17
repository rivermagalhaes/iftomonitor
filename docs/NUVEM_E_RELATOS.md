# Nuvem e relatos — 2.0.0

## Diagnóstico e mapeamento
O banco local mantém vehicles, routes, trips, gps_points, stops e app_meta. Eventos são objetos em trips.events. Nada é removido no envio.

| Local | Nuvem ifto_monitor |
|---|---|
| vehicles.label / trips.bus_label | trips.bus_label (snapshot) |
| routes.name / trips.route_name | trips.route_name; trigger resolve route_id remoto |
| trips.id, device_id, app_version, started_at, ended_at, status | mesmas colunas; horários ISO UTC |
| análise dos pontos | distance_m, duration_s, points_count, stops_count, gap_count, gap_total_s |
| demais campos da viagem e metadados locais dos pontos/paradas | trips.extra |
| gps_points | trip_points: trip_id, seq, recorded_at, latitude, longitude, accuracy_m, speed_mps, accepted, source, gap_before_s, suspect |
| stops | trip_stops: id, trip_id, arrived_at, departed_at, duration_s, latitude, longitude, status, label, detected_by |
| trips.events: type, at, details | trip_events: event_type, occurred_at, detail; app_version |

As migrações antigas 0001_init.sql e 0002_stop_manual_confirmation.sql usam public e pertencem ao fluxo antigo. Não as aplicar no projeto novo. O cliente novo usa exclusivamente ifto_monitor. IDs locais de rotas não são IDs remotos.

## Ativação manual, na ordem
1. Aplicar `20261117120000_ifto_monitor_cloud.sql` e depois `20261117130000_ifto_monitor_cloud_fix.sql`. Não aplicar migrações public do legado. O fix adiciona a capacidade de finalização e a função atômica de cota.
2. Em Settings → Data API → Exposed schemas, adicionar `ifto_monitor`.
3. Criar usuário com e-mail/senha em Authentication; inserir seu UUID em `ifto_monitor.admins(user_id)`.
4. Definir `IP_SALT` (segredo forte e estável) e `ALLOWED_ORIGIN` (origem do site). Ver functions/README.md.
5. Fazer deploy de submit-report (sem validação JWT no gateway) e purge-photos (com JWT); a segunda também valida usuário/admin internamente.
6. Copiar `.env.example` para `.env`, preencher URL e chave anon. Nunca usar service_role no app/site. Recompilar após alterar variáveis.
7. Importar este repositório na Vercel, configurar as mesmas VITE_*; vercel.json usa build:web e dist-web. Testar #/relatar e login #/painel. Não há analytics nem cookies de rastreamento; a sessão do admin fica no armazenamento local do Supabase Auth.
8. Gerar APK com o comando abaixo e executar o roteiro de TESTES_CAMPO.md nos três celulares. Não desinstalar nem limpar armazenamento dos aparelhos em coleta.
9. Semanalmente exportar CSV de relatos e de cada viagem (pontos, paradas, eventos) pelo painel, guardar com acesso restrito. Para backup integral de todas as tabelas, usar também exportação CSV do Table Editor Supabase (routes, buses, route_schedules, trips, trip_points, trip_stops, trip_events, reports, report_photos, report_rate, admins). Fotos precisam de backup separado do bucket privado. Para migrar a projeto próprio: pg_dump do schema ifto_monitor, backup do bucket e usuários Auth; restaurar no destino, reconciliar UUIDs Auth e políticas Storage, reaplicar grants, expor schema, configurar funções/segredos, trocar URL/chave e testar antes de encerrar origem. CSV do painel é operacional e não substitui dump/backup integral.

## Operação e recuperação
O modo sem VITE_* não cria cliente de nuvem. Gravação e exportação locais seguem disponíveis. A chave liga/desliga é persistida localmente. Nenhuma sincronização inicia enquanto houver gravação; verificações entre lotes interrompem o envio se uma gravação começar. As viagens são processadas em série, lotes de até 500. INSERT sem SELECT/ON CONFLICT respeita o acesso anon. Conflitos em lotes também são divididos: aceitar um 409 do lote inteiro perderia registros novos. Uma duplicata individual é sucesso. Erros isolados não impedem processar viagens seguintes. Recuo: 5 s, 30 s, 5 min e 30 min. Botão manual ignora o prazo de recuo. Marcas só são gravadas após todas as etapas; reenvio após falha parcial é seguro.

O contrato do piloto é append-only: edição local posterior ao envio não atualiza registros remotos existentes. Faça correções administrativas fora do fluxo de upload, mantendo backup. O campo extra preserva snapshots/metadados, sem dados de autenticação. Fotos são reencodadas em JPEG no navegador (até 1280 px, alvo 300 KB, teto 1 MB), sem EXIF. O Storage impõe MIME/tamanho; finalize verifica existência e metadados. O campo finalize_token é uma capacidade aleatória; não compartilhar respostas de create. O limite IP é UTC, com hash salgado, sem persistir IP bruto. Falha de upload mantém formulário para nova tentativa, podendo consumir outra unidade da cota e deixar um registro incompleto; a rotina de retenção remove fotos pendentes antigas.

## Verificação
Não foi aplicado SQL, feito deploy nem executado Gradle. Testes locais não comprovam RLS em servidor, entrega real de fotos, GPS físico ou funcionamento do APK em campo. Essas verificações fazem parte da ativação manual.


### QA da retomada (2026-11-17)
Typecheck, lint, 179 testes em 21 arquivos, build Android/web passaram, um comando por vez. Inclui migra??o real v3?v4 preservando dados e eventos, sem vari?veis de nuvem. Resultados em `docs/QA_V20_*.log`; altera??es pontuais em `docs/RELATORIO_FINAL.md`. A pasta recebida n?o cont?m `.git`, impedindo a auditoria do hist?rico/rastreamento pelo Git. Nenhum segredo foi adicionado e a busca local de padr?es de credenciais n?o encontrou ocorr?ncias.
