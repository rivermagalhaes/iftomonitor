// Usa somente variáveis do processo; não altera o ambiente do Windows.
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
const env={...process.env,JAVA_HOME:'C:/Program Files/Eclipse Adoptium/jdk-21.0.13.9-hotspot',ANDROID_HOME:'C:/Users/river/AppData/Local/Android/Sdk',ANDROID_SDK_ROOT:'C:/Users/river/AppData/Local/Android/Sdk',npm_config_cache:join(process.cwd(),'.npm-cache'),npm_config_fetch_retries:'0',npm_config_fetch_timeout:'15000'};
env.PATH=env.JAVA_HOME+'/bin;'+env.ANDROID_HOME+'/platform-tools;'+env.PATH;
mkdirSync('android',{recursive:true});writeFileSync('android/local.properties','sdk.dir='+env.ANDROID_HOME+'\n');
const npm=join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const npx=join(dirname(process.execPath),'node_modules/npm/bin/npx-cli.js');
let log='JAVA_HOME='+env.JAVA_HOME+'\nANDROID_HOME='+env.ANDROID_HOME+'\nANDROID_SDK_ROOT='+env.ANDROID_SDK_ROOT+'\n';
function run(label,command,args,options={}){const result=spawnSync(command,args,{env,encoding:'utf8',maxBuffer:8*1024*1024,...options});const output='$ '+label+'\n'+(result.stdout||'')+(result.stderr||'')+(result.error?result.error.message+'\n':'')+'exit: '+result.status+'\n\n';log+=output;console.log(output);return result.status;}
run('java -version',env.JAVA_HOME+'/bin/java.exe',['-version']);
run('npm install --save-dev --save-exact @capacitor/cli@7 @capacitor/assets --cache .npm-cache',process.execPath,[npm,'install','--save-dev','--save-exact','@capacitor/cli@7','@capacitor/assets','--cache','.npm-cache','--fetch-retries=0','--fetch-timeout=15000','--no-audit','--no-fund']);
run('npm run build',process.execPath,[npm,'run','build']);
run('npx --no cap add android',process.execPath,[npx,'--no','cap','add','android']);
run('npx --no cap sync android',process.execPath,[npx,'--no','cap','sync','android']);
if(existsSync('android/gradlew.bat'))run('gradlew.bat assembleDebug','cmd.exe',['/d','/c','gradlew.bat','assembleDebug'],{cwd:'android'});
else log+='$ android/gradlew.bat assembleDebug\nNÃO EXECUTADO: Gradle Wrapper ausente; projeto Capacitor não gerado.\n\n';
log+='APK existe: '+existsSync('android/app/build/outputs/apk/debug/app-debug.apk')+'\n';
writeFileSync('docs/TENTATIVA_CAPACITOR_REDE.txt',log);
