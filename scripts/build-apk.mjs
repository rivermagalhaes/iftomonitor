import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { inflateRawSync } from 'node:zlib';
export function detectEnvironment(env = process.env, exists = existsSync, list = readdirSync) {
  let java = env.JAVA_HOME;
  const base = 'C:\\Program Files\\Eclipse Adoptium';
  if (!java && exists(base)) java = list(base).filter(n => /^jdk-/.test(n)).sort((a,b) => b.localeCompare(a, undefined, { numeric:true })).map(n => join(base,n)).find(p => exists(join(p,'bin','java.exe')));
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || (env.LOCALAPPDATA && join(env.LOCALAPPDATA,'Android','Sdk'));
  if (!java || !exists(join(java,'bin',process.platform === 'win32' ? 'java.exe' : 'java'))) throw new Error('JDK ausente. Instale JDK 21 e configure JAVA_HOME.');
  if (!sdk || !exists(join(sdk,'platform-tools'))) throw new Error('SDK Android ausente. Instale pelo Android Studio e configure ANDROID_HOME.');
  return { ...env, JAVA_HOME:java, ANDROID_HOME:sdk, ANDROID_SDK_ROOT:sdk };
}
export function verifyApk(buffer) {
  // Read the ZIP central directory and actually inflate required entries.
  if (buffer.length < 22) throw new Error('APK não é um ZIP válido.');
  let end = buffer.length - 22;
  while (end >= Math.max(0,buffer.length - 65557) && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0 || buffer.readUInt32LE(end) !== 0x06054b50) throw new Error('APK não é um ZIP válido.');
  let offset = buffer.readUInt32LE(end+16); const names = new Set();
  for (let i=0; i<buffer.readUInt16LE(end+10); i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Diretório ZIP inválido.');
    const nameLength=buffer.readUInt16LE(offset+28), name=buffer.toString('utf8',offset+46,offset+46+nameLength);
    if (name === 'classes.dex' || name === 'AndroidManifest.xml') {
      const local=buffer.readUInt32LE(offset+42);
      if (buffer.readUInt32LE(local)!==0x04034b50) throw new Error('Entrada ZIP inválida.');
      const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);
      const compressed=buffer.subarray(start,start+buffer.readUInt32LE(offset+20));
      const method=buffer.readUInt16LE(offset+10);
      const data=method===8 ? inflateRawSync(compressed) : method===0 ? compressed : null;
      if (!data || !data.length || data.length!==buffer.readUInt32LE(offset+24)) throw new Error('Entrada APK vazia ou corrompida.');
      names.add(name);
    }
    offset+=46+nameLength+buffer.readUInt16LE(offset+30)+buffer.readUInt16LE(offset+32);
  }
  if (!names.has('classes.dex') || !names.has('AndroidManifest.xml')) throw new Error('APK sem classes.dex ou AndroidManifest.xml.');
  return true;
}

export function configureGradle(text) {
 const settings = {
  'org.gradle.jvmargs':'-Xmx1536m -Dfile.encoding=UTF-8',
  'org.gradle.daemon':'false', 'org.gradle.workers.max':'2',
  'kotlin.compiler.execution.strategy':'in-process', 'kotlin.daemon.jvmargs':'-Xmx1024m'
 };
 const lines=text.split(/\r?\n/).filter(line => !Object.keys(settings).some(key => line.trim().startsWith(key + '=') || new RegExp('^' + key.replaceAll('.', '\\.') + '\\s*=').test(line.trim())));
 return lines.join('\n').trimEnd() + '\n' + Object.entries(settings).map(([key,value])=>`${key}=${value}`).join('\n') + '\n';
}
export function prepareGradle(root, windows = process.platform === 'win32') {
 const android=join(root,'android'), properties=join(android,'gradle.properties');
 writeFileSync(properties, configureGradle(readFileSync(properties,'utf8')));
 for (const name of readdirSync(android)) if (/^hs_err_pid.*\.log$/.test(name)) unlinkSync(join(android,name));
 if (windows) {
  const memory=spawnSync('powershell',['-NoProfile','-Command','(Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory'],{encoding:'utf8'});
  const free=Number(memory.stdout?.trim());
  if (free > 0 && free < 3*1024*1024) console.warn('Memória virtual baixa: feche Chrome, Word e Edge e rode `wsl --shutdown`');
 }
}

function main() {
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'), env=detectEnvironment(), windows=process.platform==='win32';
 const run=(cmd,args,cwd=root) => { const result=spawnSync(cmd,args,{cwd,env,shell:windows && cmd !== process.execPath,encoding:'utf8',maxBuffer:32*1024*1024}); const output=(result.stdout||'')+(result.stderr||''); process.stdout.write(output); const gradle=cmd.includes('gradlew'); const log=join(root,'docs','BUILD_ANDROID.log'); if(gradle) writeFileSync(log,output); if(result.error || result.status!==0) { if(gradle) console.error(`Últimas 40 linhas:\n${output.trimEnd().split(/\r?\n/).slice(-40).join('\n')}\nLog completo: ${log}`); if(/OutOfMemory|daemon disappeared/i.test(output)) console.error('Feche navegador/Word/Edge, execute wsl --shutdown e rode npm run android:apk novamente.'); throw new Error(result.error?.message || `Falhou: ${cmd} ${args.join(' ')}`); } };
 run(process.execPath,['scripts/check-android-manifest.mjs']);
 run('npm',['run','build']); run('npx',['--no-install','cap','sync','android']);
 prepareGradle(root);
 run(windows?join(root,'android','gradlew.bat'):'./gradlew',['assembleDebug','--no-daemon'],join(root,'android'));
 const apk=join(root,'android/app/build/outputs/apk/debug/app-debug.apk');
 run(process.execPath,['scripts/check-android-manifest.mjs']);
 verifyApk(readFileSync(apk)); const info=statSync(apk); console.log(`APK verificado: ${apk}\n${info.size} bytes\n${info.mtime.toISOString()}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { try { main(); } catch(error) { console.error(error.message); process.exitCode=1; } }
