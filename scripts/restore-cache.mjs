// Reconstitui metadados npm exclusivamente de tarballs já presentes no cache.
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';
const require = createRequire('C:/Program Files/nodejs/node_modules/npm/package.json');
const cache = require('cacache');
const root = 'node_modules/.npm-cache/_cacache';
const entries = await cache.ls(root);
const packages = new Map();
for (const [key, entry] of Object.entries(entries)) {
  if (!key.endsWith('.tgz')) continue;
  try {
    const data = gunzipSync((await cache.get(root, key)).data);
    for(let offset=0; offset+512<data.length;) {
      const header=data.subarray(offset,offset+512);
      const name=header.subarray(0,100).toString().replace(/\0.*$/s,'');
      const size=parseInt(header.subarray(124,136).toString().replace(/\0.*$/s,'').trim(),8)||0;
      offset+=512;
      if (name==='package/package.json') {
        const manifest=JSON.parse(data.subarray(offset,offset+size).toString());
        manifest.dist={tarball:key.split('request-cache:')[1],integrity:entry.integrity};
        const p=packages.get(manifest.name)||{name:manifest.name,versions:{},'dist-tags':{}};
        p.versions[manifest.version]=manifest;packages.set(manifest.name,p);break;
      }
      offset+=Math.ceil(size/512)*512;
    }
  } catch { /* Ignore non npm tarballs. */ }
}
for(const [name,p] of packages){
  p['dist-tags'].latest=Object.keys(p.versions).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).at(-1);
  const url='https://registry.npmjs.org/'+name.replace('/','%2f');
  await cache.put(root,'make-fetch-happen:request-cache:'+url,JSON.stringify(p),{metadata:{time:Date.now(),url,reqHeaders:{accept:'application/json'},resHeaders:{'content-type':'application/json','cache-control':'public, max-age=300'},options:{compress:true}}});
}
console.log(`Metadados restaurados de ${packages.size} pacotes locais.`);
