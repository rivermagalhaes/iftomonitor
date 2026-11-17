import ts from 'typescript';
import {readdir,readFile,writeFile} from 'node:fs/promises';
const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed});
async function walk(dir){for(const file of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+file.name;if(file.isDirectory())await walk(path);else if(/\.(ts|tsx)$/.test(path)){const text=await readFile(path,'utf8');const source=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);await writeFile(path,printer.printFile(source));}}}
await walk('src');await walk('tests');
