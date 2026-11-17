import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const allCommands=['npm run lint','npm run typecheck','npm run test','npm run build','npx cap sync android','node --check scripts/build-apk.mjs','node --check scripts/check-android-manifest.mjs','node scripts/check-android-manifest.mjs'];
const resume=process.argv.includes('--resume-sync');
const commands=resume?allCommands.slice(4):allCommands;
const results=resume?JSON.parse(readFileSync('docs/VERIFICACAO_CORRECOES.json','utf8')):[];
const save=()=>{writeFileSync('docs/VERIFICACAO_CORRECOES.json',JSON.stringify(results,null,2));writeFileSync('docs/VERIFICACAO_CORRECOES.txt',results.map(r=>`> ${r.command}${r.compat ? '\nNODE_OPTIONS: preload scripts/terminal-info-compat.cjs (fallback de metadados do terminal)' : ''}\nCódigo: ${r.code}\n${r.stdout}${r.stderr}${r.error||''}`).join('\n'));};
function run(command,compat=false){console.log(`Executando: ${command}${compat?' (compatibilidade terminal)':''}`);const env={...process.env};if(compat)env.NODE_OPTIONS=`${env.NODE_OPTIONS||''} --require="${resolve('scripts/terminal-info-compat.cjs').replaceAll('\\','/')}"`;const result=spawnSync(command,{shell:true,encoding:'utf8',env,maxBuffer:32*1024*1024});results.push({command,compat,code:result.status,stdout:result.stdout||'',stderr:result.stderr||'',error:result.error?.message});save();console.log(`Código ${result.status}\n${result.stdout||''}${result.stderr||''}`);return result;}
for(const command of commands){let result=run(command);if(result.status!==0 && command==='npx cap sync android' && /uv_os_get_passwd.*ENOMEM/.test(result.stderr||''))result=run(command,true);if(result.status!==0){process.exitCode=1;break;}}
