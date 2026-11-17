exec(Path('.tmp/implement.py').read_text().split("write('docs/NUVEM_E_RELATOS.md'")[0]) if False else None
from pathlib import Path
import json
def write(p,s): Path(p).write_text(s,encoding='utf-8')
def edit(p,a,b):
 s=Path(p).read_text(encoding='utf-8');assert a in s,(p,a);write(p,s.replace(a,b))
edit('src/services/auth.ts',"import { createClient, type SupabaseClient }", "import { createClient }")
edit('src/services/auth.ts','let client: SupabaseClient | null = null;',"const makeClient = () => createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, { db: { schema: 'ifto_monitor' }, auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });\nlet client: ReturnType<typeof makeClient> | null = null;")
s=Path('src/services/auth.ts').read_text(encoding='utf-8');a=s.index('return null; return client ??= createClient(');b=s.index('; }',a);s=s[:a]+'return null; return client ??= makeClient()'+s[b:];write('src/services/auth.ts',s)
edit('web/lib.ts',"client:import('@supabase/supabase-js').SupabaseClient", "client:import('@supabase/supabase-js').SupabaseClient<unknown,'ifto_monitor'>")
p=json.loads(Path('package.json').read_text());p['version']='2.0.0';p['scripts'].update({'build:web':'tsc --noEmit && vite build --config vite.config.web.ts --configLoader runner','dev:web':'vite --config vite.config.web.ts --configLoader runner','lint':'eslint src tests web supabase/functions/_shared/validate.ts'});write('package.json',json.dumps(p,ensure_ascii=False,indent=2)+'\n')
p=json.loads(Path('package-lock.json').read_text());p['version']='2.0.0';p['packages']['']['version']='2.0.0';write('package-lock.json',json.dumps(p,ensure_ascii=False,indent=2)+'\n')
edit('android/app/build.gradle','versionCode 11000','versionCode 20000')
p=json.loads(Path('tsconfig.json').read_text());p['include']+=['web','vite.config.web.ts','supabase/functions/_shared/validate.ts'];write('tsconfig.json',json.dumps(p,indent=2)+'\n')
edit('.gitignore','dist/','dist/\ndist-web/')
edit('src/data/repository.ts',"key: 'schema_version', value: '3'", "key: 'schema_version', value: '4'")
with Path('docs/NUVEM_E_RELATOS.md').open('a',encoding='utf-8') as f:f.write('''
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
''')
for p in ['docs/RELATORIO_FINAL.md','docs/TESTES_CAMPO.md']:
 with Path(p).open('a',encoding='utf-8') as f:f.write('''
\n## Versão 2.0.0 — nuvem e relatos
Implementados envio anon no schema ifto_monitor, IndexedDB v4 preservando registros, funções submit-report/purge-photos, site separado e painel com login admin. Android versionCode 20000; Gradle não executado. Ativação manual: docs/NUVEM_E_RELATOS.md.

Roteiro de aceite nos aparelhos:
- Com internet, finalizar viagem e conferir Tudo sincronizado, hora e Enviada no Histórico.
- Sem internet, gravar/finalizar/exportar viagem; conferir pendência. Reconectar e verificar envio sem duplicar. Durante gravação não deve enviar.
- Desligar nuvem e reiniciar; dados permanecem. Compilar sem VITE_* e verificar gravação offline e Nuvem não configurada.
- Abrir QR de cada ônibus, enviar texto e foto, verificar aviso de privacidade e confirmação.
- Entrar como admin, filtrar relato, abrir foto, moderar, salvar nota, marcar guardar e conferir viagem relacionada.
- Limpar fotos antigas: conferir contagem e preservação de keep=true. Exportar CSV e abrir QR impresso.
- Testar usuário sem admin, limite de 10 relatos/dia, falha de rede com texto/fotos preservados e reenvio de viagem parcialmente enviada.
''')
