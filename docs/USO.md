# Uso do aplicativo (v2.3.0)

Um app **único e colaborativo**: qualquer pessoa que entra no ônibus instala o app, se cadastra em 20 segundos e pode **iniciar a viagem** (gravar o percurso) e **relatar problemas** com checklist e foto. Não existe "modo Aluno", "modo Monitor", código de monitor nem escolha de perfil.

## Primeiro uso (uma vez)

1. **Termos de uso e privacidade** ("Li e concordo" → Continuar). Guarda o aceite, a data/hora e a versão (`TERMS_VERSION` em `src/services/profile.ts`); mudar a versão pede novo aceite. Texto em `src/config/terms.ts`.
2. **Cadastro rápido**: Nome e E-mail (validação simples de formato). Sem senha, sem confirmação por e-mail, sem Supabase Auth; fica só no aparelho e funciona offline.
3. Em **Ajustes** o usuário edita nome/e-mail ou toca **Trocar usuário** (apaga só o cadastro; viagens, relatos, CSVs, nuvem e termos ficam).

O usuário aparece na nuvem sem mudar SQL: nas viagens em `extra.user = { name, email }`; nos relatos na linha estruturada (`u=` e `n=`; ver `docs/RELATOS.md`).

## Telas

- **Início**: dois botões grandes — **Iniciar viagem** (verde; vira "Viagem em andamento") e **Relatar problema** (laranja) — a última viagem, itens pendentes e "Sincronizar agora". Barra inferior: **Início, Relatar, Histórico**. Engrenagem (Ajustes) no topo.
- **Histórico**: abas **Viagens**, **Meus relatos** e **Relatórios** (Pontualidade, tabela observada e CSVs de pontualidade e velocidade).
- **Iniciar viagem**: ônibus (01, 02, 03, Outro) e rota (lembram a última escolha) e o botão grande. Durante a viagem: velocímetro, velocidade máxima, tempo, distância, "Marcar parada agora", **Relatar problema** e **Finalizar viagem** (esta fica sempre visível no cartão fixo no topo).
- **Relatar problema**: formulário em uma tela (ver `docs/RELATOS.md`) com cabeçalho fixo **← Voltar**. Com algo preenchido, voltar pergunta "Descartar este relato?". Durante uma viagem, ônibus e rota já vêm preenchidos e o relato leva `trip=` e `loc=`.

## Permissões (só na viagem)

Quem só relata nunca é incomodado. No **primeiro** "Iniciar viagem" abre um assistente curto, um botão por etapa: localização "o tempo todo" (no Android 11+, se for só "durante o uso", abre as permissões do app com "Escolha Permitir o tempo todo" e reavalia ao voltar), avisos (Android 13+) e uso contínuo (diálogo oficial `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`). Negou algo? Nas próximas viagens o app reabre **somente** a etapa pendente. `batteryExempt`, `locationAlways` e `notifications` vão no `detail` do evento `trip_started`. Fora de viagem, nenhuma localização é coletada.

## Navegação (sem becos)

- Telas internas têm **← Voltar** fixo no topo.
- Botão voltar do Android: cada tela pode tratar (formulário com dados pergunta "Descartar"); senão vai à tela pai (Relatar/Histórico/Ajustes/Viagem → Início; detalhe da viagem → Histórico; Rotas e Termos → Ajustes); no **Início minimiza o app** sem encerrar a gravação (`src/app/backHandler.ts`).
- A tela antiga de login ("Entrar com e-mail", Google, "Modo demonstração", "Modo campo local") está desativada por `AUTH_LOGIN_ENABLED = false` (`src/config/auth.ts`); o código fica no projeto. O app entra sozinho no modo campo local interno.

## Acompanhamento ao vivo

Durante a viagem o app envia a posição a cada ~15 s (com internet); o administrador acompanha em `#/painel/ao-vivo` (ver `docs/AO_VIVO.md`). Nenhuma tela nova para quem usa o app.

## Migração (celulares que já usavam o app)

Todos os dados locais ficam (viagens, pontos, paradas, eventos, CSVs, nuvem). Só é preciso aceitar os termos novos e fazer o cadastro uma vez. As chaves antigas de modo e de código são ignoradas.

## Indicador de status (bolinha no topo)

Cinza = parado · verde = gravando viagem · amarelo = viagens pendentes de envio · vermelho = erro real (sem permissão de localização durante a viagem ou falha de sincronização). Toque/leitor de tela mostram o significado (`src/lib/status.ts`).

## Várias pessoas no mesmo ônibus

Nada bloqueia gravações simultâneas: várias pessoas podem gravar o mesmo ônibus ao mesmo tempo, gerando várias viagens. **A análise deve agrupar por ônibus e horário** (e, se preciso, escolher a viagem de melhor qualidade ou o usuário). O painel mostra e filtra por usuário.

## Relatos e `ALLOWED_ORIGIN`

O app Capacitor envia relatos à Edge Function `submit-report` a partir da origem `https://localhost`. Ao restringir `ALLOWED_ORIGIN` da função, inclua `https://localhost` **além** do domínio da Vercel.

## Android

- Plugin local `BatteryOptimization` (`android/app/src/main/java/br/edu/ifto/monitor/BatteryOptimizationPlugin.java`, registrado em `MainActivity`), wrapper em `src/plugins/batteryOptimization.ts`. Fallback: `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`.
- Permissões do manifesto: localização, serviço em primeiro plano, notificações, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` e `CAMERA` (validadas por `scripts/check-android-manifest.mjs`).
- Fotos: `@capacitor/camera` (câmera ou galeria), JPEG, lado maior 1280 px, ≤ 1 MB.
