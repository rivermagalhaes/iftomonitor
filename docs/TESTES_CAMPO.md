# Roteiro atual v1.10 - tres celulares, um por onibus

- [ ] Atualizar por cima da versao anterior e verificar viagens antigas preservadas. Se nome v1.8 e veiculo divergiam, prevalece o nome v1.8.
- [ ] Sem preferencia: conferir campo unico Onibus, inicio desativado e mensagem para escolher o onibus.
- [ ] Escolher 01/02/03 uma vez por celular. Conferir nome no topo de Viagem e Inicio. Reabrir app e iniciar nova viagem sem escolher novamente.
- [ ] Testar Outro com texto livre; renomear pelo lapis em Configuracoes > Onibus. Viagens anteriores preservam nome.
- [ ] Iniciar, parar por 20-30 s, marcar manual dentro da automatica: uma so parada, selo de confirmacao manual, status anterior e duracao automatica preservados.
- [ ] Repetir marcando manual antes dos 15 s da deteccao automatica; depois de 30 s continua uma so parada.
- [ ] Manual isolada: chegada no toque e saida aberta. Movimento fecha apenas apos dois pontos acima do limite, com duracao positiva. Repetir encerrando sem movimento.
- [ ] Historico com duplicata antiga obvia: mesmo local a menos de 30 m e sobreposicao ou menos de 60 s. Conferir uma so parada no Historico, Inicio e exportacoes, mantendo dados locais.
- [ ] Exportar CSV/GeoJSON: uma parada fundida, detected_by=auto+manual; bus_label, route e app_version correspondem a viagem. UTC preservado e horas locais no fuso do celular (YYYY-MM-DD HH:mm:ss).
- [ ] Cabecalho exato: `stop_id,trip_id,bus_label,route,arrived_at,arrived_at_local,departed_at,departed_at_local,duration_s,latitude,longitude,status,label,detected_by,app_version`. Metadados antigos ausentes ficam vazios.
- [ ] Nome: ifto-monitor_<onibus>_<rota>_<AAAAMMDD-HHmm>_<id8>_stops.csv. Sem rota usa sem-rota; Demo conserva marcador demo.

Validacao fisica pendente de gerar o APK e executar no aparelho. Roteiros anteriores seguem como historico.

---

# Testes de campo — IFTO Monitor (roteiro atual v1.9)

O roteiro específico da v1.9 está na seção final; os roteiros anteriores abaixo permanecem como histórico.

Executar no aparelho Android após gerar o APK. Os testes automatizados não substituem esta validação.

- [ ] Instalar o APK por cima da versão atual (Play Protect → Mais detalhes → Instalar mesmo assim) e conceder localização “durante o uso”. Confirmar preservação das viagens existentes.
- [ ] Percorrer pelo menos 300 m, com uma parada de aproximadamente 40 s. Conferir exatamente uma parada, duração entre 35 e 45 s, linha do trajeto e distância coerente (±10%).
- [ ] Conferir que a tela permanece ligada durante a gravação.
- [ ] Exportar CSV e GeoJSON e abrir os arquivos pela tela de compartilhar.
- [ ] Conferir cabeçalhos sem sobreposição nas telas Início, Viagem, Histórico, Detalhe da viagem, Ajustes, Login/Onboarding e Consentimento; conferir também a margem inferior e o modo Demo.
- [ ] Conferir ações: candidata oferece Confirmar/Descartar/Renomear; confirmada oferece Renomear/Voltar para candidata; descartada oferece Restaurar.
- [ ] Conferir mapa de trajeto curto, início verde, fim vermelho e paradas numeradas. Desligar a internet e conferir linha e lista de coordenadas.
- [ ] Sem nuvem configurada, conferir botão desabilitado “Nuvem não configurada” e cartão “Registros salvos no aparelho”.
- [ ] Abrir o modo Demo com paradas de exemplo e conferir que seus dados não se misturam com o Campo local.
- [ ] Conferir ícone adaptativo na tela inicial e no seletor de aplicativos do aparelho.

## GPS em segundo plano v1.6

- [ ] Iniciar a primeira viagem real e conferir a explicação sobre localização 'o tempo todo' e notificações. Testar Continuar e, em instalação/perfil de teste separado, Agora não: neste caso a viagem deve iniciar em primeiro plano com aviso amarelo persistente.
- [ ] Conceder localização 'o tempo todo' e notificações; conferir 'Gravando (segundo plano ativo)' e a notificação persistente IFTO Monitor / Gravando percurso do transporte escolar, com ícone monocromático do ônibus IF.
- [ ] Iniciar viagem, bloquear a tela, andar ou dirigir por 10 minutos com o celular no bolso, desbloquear e conferir se há pontos a cada ~10–20 s sem lacuna; repetir com o app 'Sem restrições' de bateria.
- [ ] Em Ajustes > Diagnóstico de GPS, conferir permissões de primeiro plano, segundo plano e notificações, provider, último recebimento e intervalo médio dos últimos 10 pontos. Repetir com a permissão de segundo plano negada.
- [ ] Reabrir o aplicativo com viagem ativa: conferir retomada do serviço sem pontos duplicados por timestamp. Encerrar a viagem e confirmar remoção da notificação e fim da coleta.
- [ ] Provocar perda de sinal por mais de 60 s; conferir selo Gravação incompleta, contagem e duração das lacunas, tracejado cinza e marcadores no mapa. A distância não deve incluir o salto.
- [ ] Exportar CSV e GeoJSON: conferir `gap_before_s`, `suspect` e features GeoJSON de tipo `gap`, separadas dos trechos contínuos.
- [ ] Rolar todas as telas, especialmente Detalhe da viagem: a faixa superior #F8FBF5 deve permanecer sólida sob o relógio e os ícones do Android, sem conteúdo passando por trás.
- [ ] Confirmar modo Demo isolado, logo IF no ônibus, exportação/compartilhamento e wake lock sem regressão.

Limitações: o provider nativo e o serviço foram implementados, mas o teste com tela bloqueada depende do APK e do aparelho. Negar permissões, restringir a bateria, forçar parada ou encerrar o processo pode interromper a coleta. O plugin usa registro nativo local para recuperar amostras quando a WebView é suspensa; isso não garante captura após encerramento forçado do app. Permanecem pendentes SQLite nativo da aplicação, login real e sincronização com Supabase.


## Gravação resiliente e rotas v1.7

- [ ] Antes de cada viagem real, conferir os quatro itens: localização o tempo todo, notificações, bateria Sem restrições e app fixado. Testar iniciar sem marcar. A opção Não mostrar de novo deve expirar em 24 h.
- [ ] Em Ajustes > Gravação confiável, seguir o guia Motorola/Android 14+; conferir que Abrir configurações do app abre os detalhes do IFTO Monitor.
- [ ] Bloquear a tela por 30 minutos com o celular no bolso, sem abrir o app, e verificar se não há lacuna. Repetir com bateria Sem restrições e app fixado, conforme opções disponíveis no aparelho.
- [ ] Com o app vivo, interromper o GPS/serviço em teste controlado por mais de 45 s. Conferir Último ponto há N s, Interrompida — reiniciando…, aviso amarelo fechável e botão Ver guia. Quando o GPS voltar, conferir eventos de interrupção/retomada e mesmo ID da viagem, sem duplicatas.
- [ ] Suspender e retomar a WebView com o serviço gravando: pontos no registro nativo devem ser importados sem falso reinício. Encerrar o processo e reabrir com viagem ativa: conferir app_restarted, aviso e retomada na mesma viagem.
- [ ] Verificar que um intervalo normal de 9–10 s não gera eventos de interrupção nem reinícios. Forçar falha de reinício: estado Parada em vermelho; nova tentativa após a espera, sem eventos duplicados do mesmo episódio.
- [ ] Escolher veículo e rota antes de iniciar; criar com Outra rota…; repetir no mesmo veículo e conferir última rota pré-selecionada. Iniciar sem rota também deve funcionar.
- [ ] Editar rota durante a viagem e no Detalhe: conferir nome atualizado em toda a viagem e eventos route_changed/route_edited. Renomear em Ajustes > Rotas deve corrigir viagens vinculadas; desativar deve manter o histórico.
- [ ] Filtrar Histórico por veículo e rota, conferir contagens, Sem rota nas viagens antigas e padrão Todas. Tentar nomes duplicados com acentos/caixa/espaços variados e nomes fora de 2–60 caracteres.
- [ ] Exportar CSV/GeoJSON: colunas trip_id,bus_label,route, rota no nome do arquivo, eventos no CSV selecionável _eventos.csv e properties.events/route/route_id no GeoJSON. Conferir gap_before_s e features gap da v1.6 preservados.
- [ ] Atualizar APK por cima do anterior e confirmar preservação de todas as viagens/pontos/paradas, migração Sem rota e isolamento do Demo. Rolar telas novas e existentes para conferir a faixa fixa da barra de status.

Limite importante: o vigia JS só executa enquanto o processo/WebView está vivo. Não há garantia de aviso ou reinício com o processo morto; a recuperação ocorre ao reabrir. Ausência de pontos é indício, não prova de que o Android matou o serviço: perda de sinal também pode acionar a recuperação. Dados ausentes continuam como lacunas, sem inventar percurso.


## Roteiro v1.8 - exportação confiável (16/11/2026)

- [ ] Instalar por cima, preservando dados. Abrir viagens antigas: bus_label e app_version vazios, pontos e rotas preservados. Não desinstalar durante a coleta.
- [ ] Em cada um dos três aparelhos, definir Nome do ônibus em Ajustes: Ônibus 01, 02 ou 03. Testar Outro e texto livre, fechar/reabrir e conferir persistência.
- [ ] Conferir nome na tela inicial e no checklist. Em instalação sem nome, Iniciar viagem deve exigir a escolha antes de começar.
- [ ] Abrir guia Gravação confiável; permitir localização precisa o tempo todo e notificações; configurar e confirmar bateria sem restrições. Indicador OK apenas com os três requisitos; sem confirmação deve mostrar atenção.
- [ ] Escolher rota Serrano (ou a rota real), iniciar, pausar, retomar, bloquear a tela e percorrer o trajeto. Reabrir o app no meio: a viagem, bus_label, device_id e app_version devem permanecer iguais.
- [ ] Testar perda/recuperação GPS, alteração de permissão e interrupção suficiente para acionar o vigia; conferir evento watchdog_restarted com seconds_without_points no detail. Pausa intencional não deve reiniciar o GPS.
- [ ] Mudar rota durante coleta e corrigir depois no Histórico: conferir route_changed/route_edited.
- [ ] Encerrar, abrir Detalhe, expandir Eventos abaixo do mapa; conferir hora local e tipos de início/fim/pausa/retomada e demais ocorrências.
- [ ] Selecionar CSV de pontos + CSV de eventos + GeoJSON, Exportar selecionados e compartilhar no WhatsApp/Drive. Confirmar entrega conjunta; destino sem suporte deve permitir envios individuais e liberar a tela. Cancelar deve apenas mostrar o erro/cancelamento.
- [ ] Conferir cabeçalhos exatos no README; 16 colunas de pontos inclusive bus_label/route/app_version vazios em legado. Testar nomes com vírgula e aspas.
- [ ] Com aparelho em UTC-3, `2026-11-16T10:35:32.689Z` deve aparecer como `2026-11-16 07:35:32` em recorded_at_local; UTC original deve permanecer idêntico. Arquivo deve usar 20261116-0735, nome do ônibus, rota e ID curto; eventos terminam em _eventos.csv.
- [ ] Conferir GeoJSON started_at_local/ended_at_local, bus_label e app_version. Detalhe/Histórico continuam em hora local.
- [ ] Com viagem encerrada, mudar duração mínima de parada para 10/15/20/30 s; iniciar novas coletas para comparar. A ~10 s entre pontos, 15 s exige amostra em ~20 s; não há interpolação para inventar pontos.
- [ ] Conferir ícone/logo, verde IF e safe-area com rolagem. Coleta física e WhatsApp continuam dependentes deste roteiro no aparelho.

## v1.9 — Aviso condicional de gravação (NÃO TESTADO em aparelho)

Repetir com APK 1.9.0 (versionCode 10900). Os itens abaixo são roteiro, não resultados observados.

- [ ] Abrir Viagem com localização precisa “o tempo todo”, notificações permitidas e serviço disponível. Em Gravação confiável, conferir bateria “Sem restrições” e confirmar a opção. Conferir faixa verde: “Gravação em segundo plano ativa. Pode apagar a tela.” O texto fixo antigo não deve aparecer.
- [ ] Iniciar viagem, conferir serviço/notificação ativos e faixa verde; apagar a tela, percorrer um trecho seguro e conferir pontos após retornar. Não interpretar o teste automatizado como prova física.
- [ ] Nos ajustes do Android, retirar “o tempo todo” e deixar “durante o uso”. Voltar ao app: deve aparecer faixa amarela orientando manter aberto/tela acesa e permitindo abrir configurações. Repetir saindo/voltando da tela Viagem.
- [ ] Restaurar “o tempo todo” e voltar ao app; conferir atualização sem reiniciar. Durante viagem, aguardar a reconciliação existente do serviço.
- [ ] Bloquear notificações: conferir amarelo e botão “Gravação confiável”. Restaurar e retornar ao app.
- [ ] Alterar bateria para restrita. Como o plugin atual não detecta essa configuração automaticamente, desmarcar a confirmação no guia. Conferir amarelo pedindo conferência, sem alegar detecção automática. Restaurar “Sem restrições” e confirmar novamente.
- [ ] Negar localização: conferir vermelho e botão “Permitir localização”. Testar a solicitação existente, inclusive orientação do Android se a permissão estiver permanentemente negada. O botão Iniciar viagem mantém seu fluxo de permissão/checklist.
- [ ] Em todas as cores conferir: “Nenhuma localização é coletada fora da viagem.” Conferir ícone, leitura com TalkBack, contraste e safe-area.
- [ ] Amarelo e verde não devem impedir Iniciar viagem (continuam valendo nome do ônibus, seleção e checklist). Demo deve informar simulação, sem prometer GPS real. Gravação pausada/serviço indisponível não deve exibir verde.

Resultado observado no aparelho: NÃO TESTADO nesta sessão.


## Versão 2.0.0 — nuvem e relatos
Implementados envio anon no schema ifto_monitor, IndexedDB v4 preservando registros, funções submit-report/purge-photos, site separado e painel com login admin. Android versionCode 20000; Gradle não executado. Ativação manual: docs/NUVEM_E_RELATOS.md.

Roteiro de aceite nos aparelhos:
- Com internet, finalizar viagem e conferir Tudo sincronizado, hora e Enviada no Histórico.
- Sem internet, gravar/finalizar/exportar viagem; conferir pendência. Reconectar e verificar envio sem duplicar. Durante gravação não deve enviar.
- Desligar nuvem e reiniciar; dados permanecem. Compilar sem VITE_* e verificar gravação offline e Nuvem não configurada.
- Abrir QR de cada ônibus, enviar texto e foto, verificar aviso de privacidade e confirmação.
- Entrar como admin, filtrar relato, abrir foto, moderar, salvar nota, marcar guardar e conferir viagem relacionada.
- Limpar fotos antigas: conferir contagem e preservação de keep=true. Exportar CSV e abrir QR impresso.
- Testar usuário sem admin, limite de 10 relatos/dia, falha de rede com texto/fotos preservados e reenvio de viagem parcialmente enviada.


### QA local da retomada (2026-11-17)
Typecheck, lint, 179 testes e ambos os builds passaram sequencialmente. Migra??o v3?v4 validada em IndexedDB real no Chromium. Aceite f?sico permanece N?O TESTADO nesta sess?o: executar o roteiro acima no APK, incluindo modo avi?o sem configura??o de nuvem e preserva??o dos dados j? coletados. Logs: `docs/QA_V20_*.log`.
