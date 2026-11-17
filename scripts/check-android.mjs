import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
const opts={encoding:'utf8',shell:process.platform==='win32',env:{...process.env,npm_config_offline:'true',npm_config_cache:process.cwd()+'/node_modules/.npm-cache'}};
for(const [command,args] of [['node',['-v']],['npm',['-v']],['java',['-version']],['npx',['--no','cap','add','android']],['npx',['--no','cap','sync','android']]]){const p=spawnSync(command,args,opts);console.log('$',command,...args,'\n'+(p.stdout||'')+(p.stderr||''),'exit:',p.status);}
console.log('ANDROID_HOME:',process.env.ANDROID_HOME||'(vazio)','ANDROID_SDK_ROOT:',process.env.ANDROID_SDK_ROOT||'(vazio)');console.log('SDK local:',existsSync(process.env.LOCALAPPDATA+'/Android/Sdk'),'adb.exe:',existsSync(process.env.LOCALAPPDATA+'/Android/Sdk/platform-tools/adb.exe'));console.log('Gradle Wrapper:',existsSync('android/gradlew.bat'),'APK:',existsSync('android/app/build/outputs/apk/debug/app-debug.apk'));
const jdk='C:/Program Files/Eclipse Adoptium/jdk-21.0.13.9-hotspot/bin/java.exe';
if(existsSync(jdk)){const java=spawnSync(jdk,['-version'],{encoding:'utf8'});console.log('Java por caminho absoluto:',java.stdout,java.stderr,'exit:',java.status);}
const adb=process.env.LOCALAPPDATA+'/Android/Sdk/platform-tools/adb.exe';
if(existsSync(adb)){const result=spawnSync(adb,['version'],{encoding:'utf8'});console.log(result.stdout,result.stderr);}
