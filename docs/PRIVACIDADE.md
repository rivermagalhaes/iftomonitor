# Privacidade — PARCIAL

**RASCUNHO A SER REVISADO PELA INSTITUIÇÃO.** Este documento não substitui análise institucional de LGPD, participação de menores, autorizações dos responsáveis ou comitê de ética, se aplicável. Antes de coleta experimental, a instituição precisa definir e aprovar responsáveis, base apropriada, prazo de retenção, canal de contato e protocolo de acesso/eliminação. Esses detalhes não foram inventados pelo aplicativo.

## Finalidade e dados

O estudo busca avaliar percursos e horários do transporte escolar. Registra localização do veículo, precisão, velocidade quando disponível, horários GPS e de recebimento, veículo escolhido, paradas candidatas e confirmadas, apelido do operador e consentimento. Um UUID aleatório pseudônimo identifica a instalação; não usa IMEI, serial ou outro identificador físico.

A geolocalização só é iniciada após autorização do operador e início de viagem. O botão Encerrar viagem interrompe a captura. Recuperar uma viagem não inicia o GPS automaticamente: o operador escolhe Retomar. Um registro GPS impreciso é mantido como dado bruto rejeitado; não participa dos cálculos de percurso e paradas.

Não há cadastro de estudantes, mapa público ou transmissão pública ao vivo. Não escrever nomes de estudantes em apelidos, rótulos ou paradas. O operador pode usar iniciais. Evitar outros dados pessoais nos campos livres.

## Armazenamento e acesso

Na versão web e no Android, as viagens ficam no IndexedDB do navegador/WebView. Limpar dados do app ou desinstalar apaga esse banco; exportar é a cópia de segurança. Demonstração e campo têm bancos diferentes. A camada SQLite existe e tem contrato testado no computador, mas sua integração nativa permanece PARCIAL e NÃO TESTADO em aparelho. O navegador pode remover dados sob pressão de armazenamento ou por limpeza manual; exportar segundo o protocolo institucional.

As exportações incluem coordenadas sensíveis e horários, mas não incluem e-mail, operator_label ou identificador de estudante. O device_id continua pseudônimo, não torna o trajeto anônimo. Proteger arquivos e aparelho e compartilhar somente pelo canal institucional designado.

A preparação Supabase usa RLS e perfis ativos; não há chave administrativa no app. Não foi aplicado SQL remoto ou testada sincronização real. Antes de ativar nuvem, validar as políticas com usuários de teste e revisar o tratamento de registros locais sem proprietário. O aplicativo não oferece exclusão de viagens nesta versão; solicitações devem seguir procedimento institucional a definir, sem prometer remoção automática.

## Modelo de termo curto

Este projeto do IFTO monitora o veículo para estudar rotas e horários do transporte escolar. São coletados localização, precisão, velocidade e horários apenas durante uma viagem iniciada por você. Toque em Encerrar viagem para parar a coleta. Os dados ficam neste aparelho e, quando configurado e autorizado, poderão ser acessados pela equipe responsável do IFTO. Não registre nomes de estudantes. A participação de menores exige autorização do responsável conforme a LGPD. Este termo é um rascunho a ser revisado pela instituição.

O texto exibido está centralizado em `src/i18n/pt-BR.ts`. Ao aceitar em campo local, são persistidos consent_version, consent_accepted_at e operator_label no banco real. A instituição deve revisar e versionar o termo antes de substituir este modelo. A demonstração não representa consentimento para uma coleta real.

No Android, exportações são escritas no cache do app e entregues ao compartilhamento do sistema; o destino escolhido passa a manter sua própria cópia. Limpar o cache pode remover os arquivos temporários. A limpeza em Ajustes está restrita à demonstração e exige confirmação.
