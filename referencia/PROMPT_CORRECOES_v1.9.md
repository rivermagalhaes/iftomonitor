# PROMPT v1.9 — IFTO Monitor — Aviso de gravação em segundo plano (condicional)

Execute TODAS as seções abaixo, de 0 a 3, de ponta a ponta, SEM parar para pedir confirmação. Trabalhe SOMENTE dentro de `C:\dev\ifto-monitor` (sem cópias da pasta, sem pastas paralelas, sem arquivos fora dos caminhos que o projeto já usa). Não instale pacotes. Não rode Gradle (o usuário gera o APK). Ao final rode typecheck, lint (se existir), `npm test` e `npm run build` e corrija tudo até passar.

Problema: na tela "Viagem" aparece SEMPRE o texto "A localização é necessária para registrar o percurso durante uma viagem. Confira o estado de gravação: com segundo plano desativado, mantenha o aplicativo aberto e a tela acesa. Nenhuma localização é coletada fora da viagem." Isso confunde o motorista: o app grava em segundo plano com a tela apagada quando as permissões estão corretas.

## 0. LOCALIZAR
Encontre o componente/tela que mostra esse texto e a lógica já existente de estado de gravação (permissão de localização, serviço em primeiro plano, notificações, bateria, checklist "Gravação confiável"). Reaproveite essa lógica; não duplique.

## 1. AVISO CONDICIONAL
Troque o texto fixo por um bloco que reflete o estado REAL, reavaliado ao abrir a tela e ao voltar do segundo plano do app:
- **OK** (localização "o tempo todo" concedida, serviço em primeiro plano disponível, notificações permitidas, bateria sem restrição quando for possível detectar): faixa verde "Gravação em segundo plano ativa. Pode apagar a tela." Não mostrar o aviso antigo.
- **Só "durante o uso"** (sem segundo plano): faixa amarela "Segundo plano desativado: mantenha o app aberto e a tela acesa, ou permita a localização 'o tempo todo'." com botão que abre as configurações do app.
- **Bateria restrita ou notificações bloqueadas** (quando detectável): faixa amarela explicando o ajuste, com botão para o guia "Gravação confiável".
- **Localização negada**: faixa vermelha com botão para permitir.
- Em todos os casos, manter a frase "Nenhuma localização é coletada fora da viagem."
- O botão "Iniciar viagem" continua funcionando nos estados amarelo e verde; no vermelho continua pedindo a permissão (comportamento atual).
- Manter visual verde IF, safe-area e acessibilidade (texto legível, contraste suficiente, não depender só da cor: incluir ícone e texto).

## 2. TESTES
Testes Vitest para os 4 estados (OK, só durante o uso, bateria/notificação, negada), incluindo reavaliação ao voltar do segundo plano e a presença da frase de privacidade em todos.

## 3. DOCS E VERSÃO
- Atualize `docs/RELATORIO_FINAL.md` e `docs/TESTES_CAMPO.md` (roteiro: conferir a faixa verde com permissões corretas; retirar a permissão "o tempo todo" e conferir a faixa amarela).
- Versão **1.9**: package.json, `versionName` e `versionCode` do Android (sem rodar Gradle).
- Ao final, mostre o resumo (arquivos alterados, nº de testes) e diga em uma linha: "Pronto para gerar o APK: wsl --shutdown; cd C:\dev\ifto-monitor; npm run android:apk".
