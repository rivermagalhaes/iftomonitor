# Instalação e atualização — IFTO Monitor

Abra PowerShell em `C:\dev\ifto-monitor`. O projeto Android e as dependências Capacitor já existem. Não execute `cap add` novamente. Use Node compatível com o package-lock, JDK 21 e Android Studio com SDK e platform-tools instalados. Em uma instalação nova, com rede disponível, execute `npm ci`; nesta sessão não foram instalados pacotes.

## Gerar o APK no Windows

```powershell
# Confere o Node disponível.
node -v
# Compila web, sincroniza plugins e gera o APK debug com o Gradle Wrapper.
npm run android:apk
```

O script procura JAVA_HOME; se ausente, o JDK mais recente em `C:\Program Files\Eclipse Adoptium\jdk-*`. Procura ANDROID_HOME ou ANDROID_SDK_ROOT; sem essas variáveis, usa `%LOCALAPPDATA%\Android\Sdk`. Se faltar algo, ele encerra com orientação. Instale JDK 21 e os componentes do SDK pelo Android Studio, incluindo a plataforma solicitada por `android/variables.gradle`. Configure as variáveis no PowerShell se estiverem em caminhos diferentes:

```powershell
# Ajuste os caminhos para sua instalação. Só vale para este terminal.
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
# Repete toda a compilação e valida o ZIP do APK.
npm run android:apk
```

O script exige as permissões fina e aproximada no manifesto, executa build, sync e `assembleDebug --no-daemon`, e confere `classes.dex` e `AndroidManifest.xml` no ZIP final. Exibe caminho, tamanho e horário. A primeira execução do Gradle pode precisar baixar dependências e aceitar licenças pelo SDK Manager. O agente não executou Gradle nem gerou APK nesta sessão.

Se aparecer OutOfMemory ou daemon disappeared: feche navegador, Word e Edge; execute `wsl --shutdown` no PowerShell e repita `npm run android:apk`. O projeto limita a memória do Gradle a 1024 MB, desativa daemon e usa no máximo dois workers.

## Instalar no celular

Envie `android/app/build/outputs/apk/debug/app-debug.apk` por cabo, WhatsApp ou Google Drive. Abra no celular e permita instalação pela origem usada. Se o Play Protect apresentar aviso para este APK de desenvolvimento que você acabou de gerar, use a opção “Instalar mesmo assim”, quando disponível. Uma restrição institucional deve ser tratada pelo responsável pelo aparelho.

Instale por cima do app existente: mesma identificação e assinatura atualizam sem apagar dados. Se houver conflito de assinatura, não desinstale sem antes exportar as viagens, pois a desinstalação apaga o banco.

Por cabo: ative Opções do desenvolvedor (toque repetidamente em Número da versão nas informações do aparelho), ative Depuração USB, conecte e autorize o computador. Depois:

```powershell
# Confirma que o aparelho aparece como device, não unauthorized.
adb devices
# Atualiza preservando dados.
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Se adb não estiver no PATH, use `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`. No primeiro início, autorize localização precisa; com GPS desligado, ative-o antes de iniciar. Siga TESTES_ANDROID.md. Tela bloqueada ainda não tem suporte de gravação garantida.

## Navegador

`npm run dev` mostra a URL local. GPS web exige localhost ou HTTPS; HTTP pelo IP do computador no celular não é válido para testar GPS. Demonstração funciona sem GPS e nunca envia dados à nuvem.
