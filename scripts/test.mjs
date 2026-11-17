import { startVitest } from 'vitest/node';
const ctx=await startVitest('test',[],{run:true,environment:'jsdom',setupFiles:['tests/setup.ts'],pool:'threads',maxWorkers:1},{configFile:false});
if (!ctx) process.exitCode=1;
else { if(ctx.state.getFiles().some(f=>f.result?.state==='fail')||ctx.state.getUnhandledErrors().length)process.exitCode=1;await ctx.close(); }
