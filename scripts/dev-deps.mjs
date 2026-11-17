// Rollup (via Vite) evita o acesso a diretórios pais feito pelo scanner nativo esbuild.
import { build } from 'vite';
import { createRequire } from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const entry={};
await mkdir('node_modules/.ifto-inputs',{recursive:true});
for(const [name,module] of Object.entries({react:'react','react-dom-client':'react-dom/client','jsx-runtime':'react/jsx-runtime','jsx-dev-runtime':'react/jsx-dev-runtime',router:'react-router-dom',lucide:'lucide-react'})){
 const file='node_modules/.ifto-inputs/'+name+'.js';
 await writeFile(file,`import value from ${JSON.stringify(require.resolve(module).replaceAll('\\','/'))}; export default value; export const { ${Object.keys(require(module)).filter(key=>/^[a-zA-Z_$][\w$]*$/.test(key)&&key!=='default').join(',')} } = value;`);
 entry[name]=file;
}
await build({configFile:false,define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{outDir:'node_modules/.ifto-deps',emptyOutDir:true,minify:false,lib:{entry,formats:['es']},rollupOptions:{output:{entryFileNames:'[name].js',chunkFileNames:'chunk-[hash].js'}}}});
