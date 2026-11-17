# Tentativa de APK debug — 14/11/2026

Status: PARCIAL. JAVA_HOME, ANDROID_HOME e ANDROID_SDK_ROOT definidos somente no shell da tentativa, conforme os caminhos fornecidos. Não houve alteração de variáveis do sistema.

- JAVA_HOME: `C:/Program Files/Eclipse Adoptium/jdk-21.0.13.9-hotspot`.
- ANDROID_HOME e ANDROID_SDK_ROOT: `C:/Users/river/AppData/Local/Android/Sdk`.
- Java executado: OpenJDK Temurin 21.0.13+9.
- `android/local.properties` criado com `sdk.dir=C:/Users/river/AppData/Local/Android/Sdk`; permanece ignorado pelo Git.
- A pasta android contém apenas essa configuração local; não é um projeto Capacitor gerado.

A tentativa de instalar `@capacitor/core@7`, `@capacitor/android@7` e `@capacitor/cli@7` localmente falhou com `EACCES` ao acessar `https://registry.npmjs.org/@capacitor%2fandroid`. A consulta de CLI também retornou EACCES. Nenhum desses pacotes foi encontrado no cache npm. O package.json não foi alterado pela instalação malsucedida.

O bloqueio atual não é ausência de Java ou SDK: é a indisponibilidade das dependências Capacitor necessárias para gerar o projeto e seu Gradle Wrapper. Sem `android/gradlew.bat`, `assembleDebug` não pode ser executado pelo Wrapper do projeto. Não foi utilizado projeto ou APK de outro aplicativo.

APK: NÃO IMPLEMENTADO — geração bloqueada. Caminho esperado, ainda inexistente: `C:/Users/river/dev/ifto-monitor/android/app/build/outputs/apk/debug/app-debug.apk`.
