import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
// Dependências do dev são preparadas por scripts/dev-deps.mjs.
export default defineConfig(({command})=>({
 resolve:command==='serve'?{alias:[['react/jsx-dev-runtime','jsx-dev-runtime'],['react/jsx-runtime','jsx-runtime'],['react-dom/client','react-dom-client'],['react','react'],['react-router-dom','router'],['lucide-react','lucide']].map(([find,file])=>({find,replacement:resolve('node_modules/.ifto-deps',file+'.js')}))}:{},
 optimizeDeps:{noDiscovery:true},
 test: { environment: 'jsdom', setupFiles: ['tests/setup.ts'], pool: 'threads', maxWorkers: 1 }
}));
