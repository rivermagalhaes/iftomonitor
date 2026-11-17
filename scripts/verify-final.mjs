import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const results=[];let output='';
for(const name of ['lint','typecheck','test','build']){
 const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run',name],{encoding:'utf8',shell:process.platform==='win32',maxBuffer:8*1024*1024});
 const text=`$ npm run ${name}\n${result.stdout||''}${result.stderr||''}\nexit: ${result.status}\n`;
 output+=text+'\n';console.log(text);results.push({command:`npm run ${name}`,exitCode:result.status});
}
writeFileSync('docs/VERIFICACAO_FINAL.txt',output);writeFileSync('docs/VERIFICACAO_FINAL.json',JSON.stringify(results,null,2));if(results.some(r=>r.exitCode!==0))process.exitCode=1;
