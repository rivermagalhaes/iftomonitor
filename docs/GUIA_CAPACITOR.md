# Guia Capacitor

`capacitor.config.ts` usa appId `br.edu.ifto.monitor` e webDir `dist`. A plataforma `android/` já existe. As dependências core, android, CLI, App, Geolocation, Network, Filesystem e Share estão declaradas e instaladas; Leaflet também está instalado, embora o mapa atual continue em SVG com tiles OSM.

```powershell
# Atualiza a interface e a cópia nativa sem compilar Java.
npm run android:sync
# Abre a plataforma existente no Android Studio.
npm run android:open
# Executa todo o fluxo e verifica o APK.
npm run android:apk
```

ForegroundProvider seleciona Geolocation nativo por Capacitor.isNativePlatform; no navegador usa navigator.geolocation. Permissões são verificadas antes da criação da viagem. Network alimenta o indicador e a reconexão. App registra voltar e appUrlOpen, com remoção dos listeners; sair durante gravação exige confirmação. Filesystem salva em Cache com UTF-8; Share recebe URI e nome. No navegador a exportação usa Blob. Wake Lock web mantém a tela ativa quando disponível e avisa caso contrário.

Não remova ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION nem uses-feature GPS required=false do manifesto. O verificador de build bloqueia falta das permissões. Ícones adaptativos usam vector BusFront branco e fundo oliva; PNGs anteriores ficam como fallback abaixo da API 26. Splash usa #F8FBF5. O aspecto instalado ainda exige teste em aparelho.

IndexedDB é a persistência ativa também no WebView. SqliteRepository existe atrás de Repository, sem importação pelo aplicativo. Para ativação, consulte PENDENCIAS.md. Não há serviço Android em primeiro plano para GPS com tela bloqueada.

Mudanças em React exigem build, sync, geração e reinstalação do APK. Sync bem-sucedido verifica cópia e registro de plugins, não prova funcionamento físico. Gradle e aparelho não foram executados nesta sessão.
