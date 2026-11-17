# Guia dos alunos — PARCIAL

O objetivo é aprender a registrar e avaliar o percurso do veículo. O aplicativo não identifica estudantes. Leia o termo de ciência com o professor antes de coletar qualquer dado real. Há versão web e projeto Android; as correções atuais precisam de novo APK e repetição dos testes no celular.

## Preparar o computador

Abra um terminal na pasta que contém package.json. Não crie outro projeto dentro desta pasta.

```powershell
# Mostra a versão do JavaScript usado pelas ferramentas; foi usado Node 24.16.0.
node -v
# Instala as bibliotecas nas versões do arquivo de trava.
npm ci
# Abre o servidor de desenvolvimento e mostra o endereço a visitar.
npm run dev
```

Se a instalação mostrar EACCES de rede, o registro está bloqueado no ambiente; não tente instalar globalmente nem alterar permissões do sistema. ENOTCACHED significa que falta o arquivo para uma instalação offline. O professor deve providenciar acesso apropriado ao registro. O cache recuperado nesta sessão fica em node_modules e não faz parte do código.

## Explorar sem coletar GPS real

1. Clique em Modo demonstração. Verifique o banner de dados fictícios.
2. Abra Viagem e selecione um ônibus. Os números são identificadores provisórios, não nomes de rotas.
3. Inicie. A simulação produz pontos automaticamente; cada segundo avança um intervalo GPS no relógio fictício.
4. Clique em Simular parada e aguarde alguns segundos. Uma candidata deve aparecer. O mesmo botão volta a simular movimento.
5. Confirme, descarte ou renomeie a candidata. Um semáforo não vira parada oficial automaticamente.
6. Encerre e confirme. Abra Histórico, consulte a viagem e exporte CSV e GeoJSON.
7. Em Ajustes, troque para campo local somente após encerrar a demonstração.

## Coletar em campo

Preencha apenas apelido ou iniciais, aceite o termo revisado pela instituição e selecione o veículo. Autorize localização quando solicitado. Mantenha o aplicativo visível e a tela acesa; não há coleta confiável com tela bloqueada nesta entrega. Observe sinal e precisão. Pontos imprecisos continuam no arquivo bruto, mas não entram no traçado e nos cálculos.

Se houver viagem interrompida ao reabrir, escolha Retomar para continuar a mesma sequência ou Encerrar no último ponto. Não limpe os dados do aplicativo para resolver isso, pois os registros ficam localmente. Antes de trocar de aparelho, exporte os arquivos de pesquisa e entregue-os pelo canal definido pelo professor.

GPS real no celular não funciona abrindo o endereço HTTP do Vite pelo Wi-Fi. É necessário APK ou contexto HTTPS adequado. Para gerar o APK atualizado, use `npm run android:apk` no PowerShell fora do Codex e siga GUIA_INSTALACAO.md.

## Verificar alterações de código

```powershell
# Procura problemas de qualidade no TypeScript e nos testes.
npm run lint
# Confere se os tipos e chamadas são coerentes, sem gerar arquivos.
npm run typecheck
# Executa os testes; o contrato IndexedDB usa Chromium local.
npm run test
# Gera os arquivos que serão publicados ou copiados para Android.
npm run build
```

Uma tela desenhada não demonstra funcionamento de GPS. Testes simulados verificam regras, enquanto o roteiro Android registra o que foi observado no aparelho. Não preencher resultados inventados na tabela A–F.

Problemas comuns: permissão negada exige ajustar permissões no navegador/Android; Sem sinal exige aguardar uma posição válida em local adequado; mapa vazio sem internet mantém a grade e o trajeto; falha de banco exige preservar o aparelho e pedir auxílio antes de limpar dados; arquivos CSV podem exigir importação UTF-8 com separador vírgula no editor de planilhas.

Em demonstração, paradas também aparecem automaticamente, pendentes é zero e sincronização fica desativada. Após encerrar, Ajustes > Limpar dados de demonstração pede confirmação e apaga só o banco fictício.

No Android, CSV/GeoJSON abrem a folha de compartilhamento: escolha Drive, arquivos ou o canal definido pelo professor. CSV exporta pontos e paradas separadamente. Guarde ambos; IndexedDB no WebView é apagado ao limpar dados/desinstalar.
