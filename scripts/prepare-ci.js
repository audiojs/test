import { unlink,rm,readFile } from 'node:fs/promises'
if(process.env.CI!=='true')throw new Error('Only use in disposable CI checkout')
if(JSON.parse(await readFile('package.json','utf8')).name!=='@audio/test')throw new Error('Wrong working directory')
for(const path of ['results/latest.json','results/registry.json','results/audacity.json','results/benchmarks.json','results/audacity-benchmarks.json','site/index.html','site/results.json','site/registry.json','site/benchmarks.json','site/audacity-benchmarks.json'])await unlink(path).catch(e=>{if(e.code!=='ENOENT')throw e})
for(const path of ['results/artifacts','site/artifacts'])await rm(path,{recursive:true,force:true})
