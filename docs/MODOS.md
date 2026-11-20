# Modos do aplicativo (v2.2.0)

O mesmo APK é instalado por todos os alunos e pelos celulares de coleta nos ônibus. Na primeira abertura:

1. **Termos de uso e privacidade** (checkbox "Li e concordo"). Guarda localmente o aceite, a data/hora e a versão dos termos (`TERMS_VERSION` em `src/services/appMode.ts`). Mudar a versão pede novo aceite. Texto em `src/config/terms.ts`.
2. **Como você vai usar o app?**
   - **Sou aluno** → vai direto para *Relatar*. Nenhuma permissão de localização, bateria ou notificação é pedida; o app não cria o `Monitor`, não usa GPS nem serviço em segundo plano.
   - **Sou monitor (coleta do ônibus)** → pede o **Código do monitor**. Código errado volta à escolha de modo.
3. **Etapas do monitor** (um botão grande por etapa): *Permitir localização* (em Android 11+, se for só "durante o uso", abre as permissões do app com "Escolha Permitir o tempo todo" e reavalia ao voltar), *Permitir avisos* (Android 13+), *Permitir uso contínuo* (diálogo oficial `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`), *Tudo pronto*.
   - Negou algo? Pode continuar. Ao tocar em **Iniciar viagem**, o app reabre **somente** a etapa pendente (um diálogo do sistema).
   - `batteryExempt`, `locationAlways` e `notifications` (booleanos) são gravados no `detail` do evento `trip_started`.

**Aluno**: barra inferior só com *Relatar* e *Meus relatos*. **Monitor**: Início, Viagem, Histórico, Pontualidade e sincronização, como antes.

## Migração

Quem já tem o app com viagens salvas no banco local (os 3 celulares de coleta) entra como **monitor** automaticamente, sem digitar o código. Vê os termos novos uma vez e as etapas de permissão pendentes. Nenhum dado é apagado.

## Código do monitor

Código inicial: `IFTO2026`. O código **não** está em texto puro no código-fonte: guarda-se só o SHA-256 de `salt + código` em `src/config/monitorCode.ts` (`MONITOR_SALT`, `MONITOR_CODE_HASH`). É uma barreira de uso (impede o aluno de abrir o modo de coleta por engano), não segurança forte: quem tem o APK pode tentar adivinhar o código.

### Trocar o código

1. Gere o hash (troque `NOVOCODIGO`):

   ```
   node -e "console.log(require('crypto').createHash('sha256').update('ifto-monitor/2.2/monitor|NOVOCODIGO').digest('hex'))"
   ```

   O texto antes de `NOVOCODIGO` é o valor de `MONITOR_SALT` (mantenha igual, ou troque nos dois lugares).
2. Cole o resultado em `MONITOR_CODE_HASH` (`src/config/monitorCode.ts`).
3. Gere o APK de novo. O código novo vale para quem tentar entrar em modo monitor depois disso; quem já está em modo monitor continua.
4. Atualize o teste `tests/v22-modes.test.tsx` (usa `IFTO2026`) e esta página.

## Troca de modo

*Ajustes* (aluno) → **Entrar como monitor** pede o código do monitor. De monitor para aluno não há código: em *Ajustes* há o botão **Mudar para modo Aluno** (com confirmação). A troca é bloqueada se houver viagem em andamento ("Finalize a viagem antes de mudar de modo.") e não apaga viagens, CSVs, nuvem nem o aceite dos termos. Em *Ajustes* do aluno há versão, termos e **Entrar como monitor** (pede o código; errado = continua aluno). O ícone de engrenagem fica no topo de todas as telas.

## Relatos e `ALLOWED_ORIGIN`

O app Capacitor envia relatos à Edge Function `submit-report` a partir da origem `https://localhost`. Ao restringir `ALLOWED_ORIGIN` da função, inclua `https://localhost` **além** do domínio da Vercel (a função não foi alterada nesta versão).

## Android

- Plugin local `BatteryOptimization` (`android/app/src/main/java/br/edu/ifto/monitor/BatteryOptimizationPlugin.java`, registrado em `MainActivity`), wrapper em `src/plugins/batteryOptimization.ts`. Fallback: `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`.
- Permissões novas no manifesto: `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` e `CAMERA` (o script `scripts/check-android-manifest.mjs` valida as duas).
- Fotos: `@capacitor/camera` (câmera ou galeria), reduzidas para JPEG, lado maior 1280 px, ≤ 1 MB.

## Entrada do monitor e login antigo (v2.2.1)

- A tela antiga ("Entrar com e-mail", "Continuar com Google", "Modo demonstração", "Modo campo local") está desativada por `AUTH_LOGIN_ENABLED = false` (`src/config/auth.ts`); o código de autenticação continua no projeto. O monitor entra sozinho no modo campo local (os termos aceitos no primeiro uso valem como ciência). O antigo botão "Trocar modo de operação" (que levava a essa tela) foi removido.

## Indicador de status (bolinha no topo)

Cinza = parado · verde = gravando viagem · amarelo = há viagens (ou relatos, no aluno) pendentes de envio · vermelho = erro real (sem permissão de localização durante a viagem, falha de sincronização, ou relato recusado). Toque/leitor de tela mostram o significado (`src/lib/status.ts`).
