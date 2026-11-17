# PROMPT DE CORREÇÕES v1.3 — IFTO Monitor (execução única, ponta a ponta)

## 0. REGRAS (valem para tudo)

- Projeto único: `C:\dev\ifto-monitor`. Não crie cópias, pastas paralelas nem arquivos fora dos caminhos que o projeto já usa.
- Execute TODAS as seções, de 1 a 5, em sequência, **sem parar para pedir confirmação**. Decida pelo critério mais seguro e registre a decisão no relatório final.
- Seu sandbox não tem rede e não executa Gradle. NÃO rode `npm install` nem Gradle. Rode somente: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `npx cap sync android`. O usuário gera o APK depois, em um PowerShell normal, com `npm run android:apk`.
- NUNCA remova do `android/app/src/main/AndroidManifest.xml` as permissões `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` e o `uses-feature` de GPS.
- Idioma da interface e dos documentos: português do Brasil. Mantenha a identidade visual (#79A83B, #A8CF66, #2E5328, #D83232, #F8FBF5) e a navegação Início / Viagem / Histórico.
- Não quebre nada que já funciona: GPS real, exportação CSV/GeoJSON via Filesystem + Share, wake lock, modo Demo isolado, modo Campo local.

## 1. CORREÇÕES DE INTERFACE (encontradas no teste de campo de 14/11/2026)

### 1.1 Área segura (safe-area) em TODAS as telas
Problema: o título "Detalhe da viagem" aparece sobreposto à barra de status do Android (relógio e ícones). A tela Início está correta.
- Garanta `viewport-fit=cover` no `index.html`.
- Crie (ou reaproveite, se já existir) um único componente de layout de página com `padding-top: max(env(safe-area-inset-top), 12px)` e `padding-bottom` que respeite a barra de navegação inferior e `env(safe-area-inset-bottom)`.
- Faça uma varredura em TODAS as rotas (Início, Viagem, Histórico, Detalhe da viagem, Ajustes, Login/Onboarding, Consentimento) e passe todas pelo mesmo layout. Nenhuma tela pode ter `<h1>` ou cabeçalho fora dele.
- Teste automatizado: o layout de página aplica o padding de safe-area; todas as rotas usam o layout.

### 1.2 Botões das paradas por status
Problema: uma parada **Confirmada** continua exibindo Confirmar e Descartar.
- Candidata: Confirmar, Descartar, Renomear.
- Confirmada: Renomear e "Voltar para candidata" (sem Confirmar/Descartar).
- Descartada: Restaurar.
- Manter o selo de status. Testes para cada estado.

### 1.3 Mapa do detalhe da viagem
Problema: com trajeto curto o mapa abre no nível do bairro e a linha do trajeto não aparece.
- Ajustar o enquadramento com `fitBounds` (padding 32 px, `maxZoom` 18). Com um único ponto ou todos os pontos a menos de 30 m, usar zoom 17 centrado no trajeto.
- Desenhar SEMPRE a polilinha do trajeto (cor #79A83B, espessura 4) quando houver 2 ou mais pontos aceitos, marcador de início (verde), de fim (vermelho) e as paradas (marcadores numerados; confirmada em verde escuro, candidata em verde claro).
- Manter o fallback de mapa quando o OSM estiver indisponível (lista de coordenadas).

### 1.4 Banner e contadores de sincronização
Problema: ao tocar em "Sincronizar agora" aparece um banner vermelho fixo, parecendo erro, e o contador "Registros pendentes de sincronização" (43) confunde, porque a nuvem ainda não existe.
- Quando a nuvem não está configurada: o botão "Sincronizar agora" fica desabilitado com o texto "Nuvem não configurada" e NÃO dispara erro.
- Se mesmo assim houver aviso, use estilo informativo neutro (fundo #EDF3E6, texto #2E5328), com botão de fechar (X) e desaparecimento automático em 8 s. Texto: "Nuvem ainda não configurada. Seus dados estão salvos neste aparelho e podem ser exportados em CSV ou GeoJSON."
- Vermelho (#D83232) é reservado a falhas reais.
- No modo Campo local, renomear o terceiro cartão para "Registros salvos no aparelho". Em modo com nuvem configurada, mantém "Pendentes de sincronização".

## 2. DETECÇÃO DE PARADAS (reforço e testes)

Não mude os parâmetros já definidos (velocidade < 3 km/h, mínimo 15 s, raio 25 m ou a precisão, precisão máxima 50 m, intervalo máximo entre pontos de 3× o intervalo de GPS, mínimo 60 s).
- Adicionar testes com trilhas sintéticas:
  1. Caminhada de 300 m a 1,2 m/s com uma parada de 40 s no meio → exatamente 1 parada, de duração entre 35 s e 45 s, e a distância total coerente (±10%).
  2. Parada de 40 s com ruído de GPS de ±8 m → continua 1 parada só (sem dividir).
  3. Duas paradas separadas por mais de 100 m → 2 paradas.
  4. Pontos com precisão pior que 50 m são ignorados e não geram parada.
  5. Buraco de sinal de 70 s no meio de uma parada → não quebra em duas paradas se o local é o mesmo.
- Paradas manuais: registrar com duração 0 s e vinculadas ao ponto GPS mais próximo no tempo; nunca duplicar duas manuais com menos de 5 s de diferença.

## 3. ROBUSTEZ DO BUILD ANDROID (a máquina do usuário tem pouca memória virtual)

- Em `scripts/build-apk.mjs`, antes de chamar o Gradle:
  1. Garantir, de forma idempotente (sem duplicar linhas), que `android/gradle.properties` contenha:
     ```
     org.gradle.jvmargs=-Xmx1536m -Dfile.encoding=UTF-8
     org.gradle.daemon=false
     org.gradle.workers.max=2
     kotlin.compiler.execution.strategy=in-process
     kotlin.daemon.jvmargs=-Xmx1024m
     ```
     (se já existir uma linha com a mesma chave, substituir o valor).
  2. No Windows, consultar a memória virtual livre (`powershell -NoProfile -Command "(Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory"`). Se estiver abaixo de 3 GB, imprimir um aviso claro em português ("Memória virtual baixa: feche Chrome, Word e Edge e rode `wsl --shutdown`") e continuar mesmo assim.
  3. Apagar arquivos `hs_err_pid*.log` antigos em `android/`.
- Se o Gradle falhar, imprimir as últimas 40 linhas do log e o caminho do arquivo de log completo.
- Adicionar `hs_err_pid*.log` ao `.gitignore`.
- Ao final, o script continua verificando o APK (caminho, tamanho em bytes, data) e rodando `scripts/check-android-manifest.mjs`.
- Verificar que o `check-android-manifest` falha o build se faltar qualquer permissão de localização.

## 4. DOCUMENTAÇÃO

Atualizar nos locais que o projeto já usa (sem criar pastas novas):
- `docs/RELATORIO_FINAL.md`: acrescentar a seção "Correções v1.3" com o que foi feito e o que continua pendente.
- `CHANGELOG` (se existir; se não existir, no próprio relatório): versão 1.3.
- `docs/TESTES_CAMPO.md` (se não existir, criar em `docs/`): checklist de campo com os itens abaixo.

Checklist de campo a documentar:
1. Instalar o APK por cima (Play Protect → Mais detalhes → Instalar mesmo assim) e conceder localização "durante o uso".
2. Percurso de 300 m ou mais com uma parada de ~40 s: conferir 1 parada, linha do trajeto no mapa e distância coerente.
3. Tela permanece ligada durante a gravação.
4. Exportar CSV e GeoJSON e abrir pela tela de compartilhar.
5. Cabeçalhos sem sobreposição em todas as telas.
6. Modo Demo abre com paradas de exemplo e não mistura dados com o Campo local.
7. Limitação conhecida: com a tela bloqueada o GPS pode pausar (serviço em primeiro plano nativo fica para a próxima fase).

## 5. QUALIDADE E ENTREGA

Rodar, nesta ordem, e corrigir tudo o que falhar até ficar verde: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npx cap sync android`. Os 47 testes existentes devem continuar passando, mais os novos.

Relatório final, curto e em português, com:
1. Lista objetiva do que foi corrigido (seções 1 a 3), arquivo por arquivo.
2. Resultado de cada comando da seção 5 (ok/falhou).
3. Decisões que você tomou sozinho.
4. O que continua pendente (SQLite nativo, GPS com tela bloqueada, login real e sincronização com Supabase, ícone adaptativo a verificar no aparelho).
5. Instrução final para o usuário, em uma linha: "Feche Chrome/Word/Edge, rode `wsl --shutdown` e depois `cd C:\dev\ifto-monitor; npm run android:apk`".
