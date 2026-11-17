# Testes Android — fechamento v1.2

## Observado pelo usuário em 14/11/2026

- Primeira viagem de campo de aproximadamente 2 h: **0 pontos**. Causa: APK sem permissões de localização no manifesto. Corrigido adicionando as permissões.
- Após a correção, teste A: app aberto, celular parado aproximadamente 2 min 25 s; **8 pontos**, mapa OpenStreetMap exibiu a posição, precisão aproximadamente **20 m**. Paradas divididas. Correção do algoritmo em 1.2 implementada; **NÃO TESTADO em campo** até novo teste.
- CSV/GeoJSON não funcionou no Android. Integração Filesystem/Share corrigida em 1.1; **NÃO TESTADO em campo**.
- B, C, D, E, F: **NÃO TESTADO**. Resultados observados em branco abaixo.

O agente não observou aparelho nem gerou APK nesta sessão. Resultados unitários não substituem os ensaios físicos.

Antes de começar: usar um aparelho de teste, termo institucional revisado e autorização adequada; identificar o veículo sem nomes de estudantes; conferir bateria, espaço livre e data/hora; usar campo local, nunca demonstração. Registrar modelo, Android, versão do app, apelido e condições do ensaio em folha separada. Exportar os arquivos ao fim; preservar os originais.

| Teste | Pré-condições | Passos | Resultado esperado | Resultado observado |
|---|---|---|---|---|
| A — GPS com app aberto (repetir após atualização) | APK atualizado; localização e permissão disponíveis; campo local com consentimento | Selecionar veículo; iniciar; manter tela visível; percorrer trecho seguro por 5 minutos; observar precisão; encerrar; exportar | Só há pontos após iniciar; intervalo padrão de aproximadamente 10 s; precisão >50 m preservada como rejeitada; tela acesa; viagem encerrada no histórico | |
| B — GPS sem internet | A realizado; dados móveis e Wi-Fi desligados, mantendo localização disponível | Iniciar viagem; deslocar por 5 minutos; observar fallback do mapa; encerrar; exportar | Coleta e armazenamento continuam; grade local mantém trajeto; nenhum envio requerido; sem coordenadas inventadas em falta de sinal | |
| C — Tela bloqueada | GPS em segundo plano NÃO IMPLEMENTADO | Após futuro plugin aprovado e build validado, iniciar e bloquear por 5 minutos; desbloquear e inspecionar timestamps | Nesta versão não há garantia de coleta bloqueada; registrar lacunas reais. Em implementação futura, exigir serviço de localização e notificação persistente antes de considerar aprovado | |
| D — Retorno da conexão | Nuvem de teste configurada; profile ativo; sessão válida; viagem finalizada pendente | Coletar offline; encerrar; reconectar; usar Sincronizar agora; consultar registros no servidor autorizado | Envio na ordem veículos/viagens/pontos/paradas; mesmos UUID sem duplicações; somente IDs confirmados ficam synced; gravação não bloqueada | |
| E — Fechar e reabrir | Viagem recording com pontos já salvos | Anotar último seq; fechar o app pelo sistema; reabrir; escolher Retomar; gerar novos pontos; repetir e escolher Encerrar no último ponto | Diálogo de recuperação; Retomar preserva id e continua seq; encerramento recuperado usa timestamp do último ponto e ended_reason recovered; nenhum ponto fora de viagem | |
| F — Parada e retomada | Trecho seguro de parada; GPS com precisão aceitável | Iniciar; parar pelo menos 60 s; mover novamente; observar candidata; confirmar/descartar/renomear; encerrar; exportar | Uma candidata apesar do jitter; duração mínima 15 s; movimento confirmado por dois pontos fecha grupo; lacuna maior que o máximo (mínimo 60 s e 3 × intervalo) separa grupos; nenhum ponto oficial sem confirmação | |

Se o aparelho oferecer apenas localização aproximada, observar como accuracy_m varia e verificar exclusão dos pontos acima do limite. Para permissão permanentemente negada, abrir Ajustes do Android; a interface orienta esse caminho, sem alterar configurações automaticamente.

Critério de falha: ponto fictício no modo real, duplicação de seq, mistura entre bancos, perda de registros já persistidos, coleta sem viagem autorizada ou exportação com identificação de estudante. Interromper o ensaio e preservar dados e horário do problema para análise.

HTTP pelo IP do servidor Vite não fornece contexto seguro para GPS no celular. Esses testes devem usar APK integrado ou uma implantação HTTPS de teste para os itens exclusivamente web, registrando explicitamente a diferença.
