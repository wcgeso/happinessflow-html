import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
await build({entryPoints:['src/index.ts'],outfile:'lib/index.cjs',bundle:true,platform:'node',target:'node22',format:'cjs',external:['firebase-admin/*','firebase-functions/*'],plugins:[{name:'server-clock',setup(b){b.onResolve({filter:/\/serverClock$/},()=>({path:fileURLToPath(new URL('./src/serverClock.ts',import.meta.url))}));}}]});
