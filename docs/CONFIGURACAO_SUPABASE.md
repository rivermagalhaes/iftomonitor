# Configuração Supabase — PARCIAL

Nenhum projeto remoto foi criado e nenhuma migration foi aplicada em servidor. Autenticação e sincronização reais: NÃO TESTADO. A suíte de sync usa cliente simulado. O lint SQL local não pôde ser executado: Docker negou acesso ao pipe e a CLI instalada falhou ao escrever sua telemetria fora do workspace. As políticas precisam ser validadas antes de produção.

## Preparação administrativa futura

Um administrador autorizado deve criar um projeto de teste no Supabase e revisar `supabase/migrations/0001_init.sql`. Aplicar primeiro em ambiente descartável, conferir sintaxe, executar ensaios de RLS e só então planejar migração institucional. Não executar em produção como parte de uma instalação do app.

O SQL cria profiles, app_meta, vehicles, trips, gps_points e stops. UUIDs são gerados pelo cliente. Pontos têm unicidade (trip_id,seq) e índices por viagem/horário; viagens têm índice por proprietário/início; paradas têm índice por viagem. O servidor só aceita source gps; dados demo nunca são enviados.

Todas as tabelas têm RLS, sem privilégios anon. Coletor ativo pode inserir, selecionar e atualizar suas linhas; pontos/paradas seguem a propriedade da viagem. Coordenador ativo pode selecionar tudo, sem edição administrativa pelo aplicativo. Não existem policies ou grants de DELETE para authenticated. Profiles só é administrado fora do aplicativo; as funções de consulta de perfil são security definer com search_path fixo, evitando recursão da política de profiles.

Depois que o usuário existir em Authentication, o administrador deve criar sua linha em profiles, com o mesmo UUID, papel coletor ou coordenador e active=true. Não há aprovação automática por domínio de e-mail. Testar: sem profile, profile inativo, coletor A tentando ler/alterar B, troca de owner em update, coordenador lendo e tentativa de delete. Todos os casos indevidos precisam ser negados pelo servidor, independentemente da interface.

## Cliente e login

Copiar `.env.example` para `.env` e preencher apenas VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY públicas. Manter `.env` fora do Git. O cliente só é criado atrás de isSupabaseConfigured e usa PKCE e sessão persistida. Sem configuração, os botões informam Nuvem não configurada, sem simular autenticação.

Em Authentication → URL Configuration → Redirect URLs, cadastrar a URL HTTPS de teste e `br.edu.ifto.monitor://auth/callback`. O modelo de intent-filter está em scripts/android-manifest.xml e o binding do evento App em src/config/native.ts. O listener já é inicializado no Android; o intent-filter do esquema ainda precisa ser aplicado e validado antes de ativar nuvem.

No Android, revisar redirectUrl antes de habilitar autenticação: a configuração final precisa usar o esquema nativo também quando a WebView servir a página como https://localhost. O binding já usa o plugin App e restaura a sessão após troca do código. Redirect e intent-filter continuam pendentes de validação.

O envio padrão de e-mail do Supabase tem limites e restrições; conferir os limites exibidos no painel e a documentação oficial vigente, configurar SMTP institucional para ensaios com vários participantes e testar entregabilidade. Não prometer volume ou prazo com o serviço padrão. Para Google, configurar OAuth no projeto Google e no provedor Supabase, registrar os redirects exigidos e testar separadamente. O botão não torna OAuth configurado automaticamente.

## Sincronização preparada

SyncService exige internet e sessão válida, bloqueia demo, envia somente viagens finished e respeita dependências veículos → viagens → pontos → paradas. Os lotes têm até 500 linhas; upsert usa id; somente os IDs retornados ficam synced. Erros guardam attempts, last_error e next_retry_at, com 5 s, 30 s, 5 min e máximo de 30 min. Alterações locais ocorridas durante o envio não são confirmadas indevidamente.

A abertura, reconexão, encerramento e o botão manual acionam o serviço. Ele não promete execução com app encerrado. Registros de campo com owner nulo são enviados com o usuário da sessão como proprietário; isso exige revisão do processo de adoção de dados antes de sincronização real. Os registros locais não mudam de banco.

Limitações: autenticação offline ainda consulta profile na restauração e precisa de tratamento adicional para histórico autenticado sem rede; o app usa o mesmo banco real no dispositivo, sem separação local por usuário; troca de contas e adoção de dados precisam ser validadas. Usar campo local e exportação enquanto essa etapa não estiver aprovada.


## Rotas e eventos v1.7

O modelo aditivo e o plano de acesso estão em [ROTAS_SUPABASE.md](ROTAS_SUPABASE.md). A proposta não foi aplicada; envio de rotas e correção administrativa na nuvem continuam pendentes de implementação e validação.
