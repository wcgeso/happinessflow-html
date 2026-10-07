import {build} from 'vite';
import {writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {relative} from 'node:path';
await build({configLoader:'runner',plugins:[{name:'measure-bundle',generateBundle(_options,bundle){
 const chunks=Object.values(bundle).filter(chunk=>chunk.type==='chunk').map(chunk=>({file:chunk.fileName,entry:chunk.isEntry,bytes:Buffer.byteLength(chunk.code),gzipBytes:gzipSync(chunk.code).length,imports:chunk.imports,dynamicImports:chunk.dynamicImports,modules:Object.entries(chunk.modules).map(([id,data])=>({id:relative(process.cwd(),id),bytes:data.renderedLength})).sort((a,b)=>b.bytes-a.bytes)}));
 return writeFile(process.argv[2]||'verification-bundle-analysis.json',JSON.stringify(chunks,null,2)+'\n');
 }}]});
