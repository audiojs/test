// Only on a fresh CI runner; never enable scripting in a user's desktop profile.
import { mkdtemp,mkdir,writeFile,access,stat } from 'node:fs/promises'
import { homedir,tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn,execFileSync } from 'node:child_process'
if(process.env.CI!=='true'||process.platform!=='linux')throw new Error('Requires a disposable Linux CI runner')
const repeats=Number(process.env.AUDACITY_BENCH_REPEATS||7)
if(!Number.isInteger(repeats)||repeats<3)throw new Error('AUDACITY_BENCH_REPEATS must be an integer of at least 3')
try{await access(join(homedir(),'.audacity-data'));throw new Error('Existing Audacity profile; refusing to control it')}catch(e){if(e.code!=='ENOENT')throw e}
const dir=await mkdtemp(join(tmpdir(),'audio-test-audacity-ci-'))
const env={...process.env,XDG_CONFIG_HOME:join(dir,'config'),XDG_DATA_HOME:join(dir,'data'),XDG_STATE_HOME:join(dir,'state'),XDG_CACHE_HOME:join(dir,'cache')}
// Audacity 3.4 still reads its legacy profile; XDG paths alone leave scripting disabled.
const modulePath=execFileSync('dpkg-query',['-L','audacity'],{encoding:'utf8'}).split('\n').find(path=>path.endsWith('/mod-script-pipe.so'))
if(!modulePath)throw new Error('Installed Audacity has no mod-script-pipe module')
const moduleDate=(await stat(modulePath)).mtime.toISOString().slice(0,19)
const config=`[Module]\nmod-script-pipe=1\n[ModulePath]\nmod-script-pipe=${modulePath}\n[ModuleDateTime]\nmod-script-pipe=${moduleDate}\n[GUI]\nShowSplashScreen=0\n[Version]\nMajor=3\nMinor=4\nMicro=2\n[FileFormats]\nExportFormat_SF1=65542\n[FileFormats/ExportFormat_SF1_Type]\nWAV_10000=6\n[Quality]\nDitherAlgorithm=0\nHQDitherAlgorithm=0\n`
const profiles=[join(homedir(),'.audacity-data'),join(env.XDG_CONFIG_HOME,'audacity')]
for(const cfg of profiles){await mkdir(cfg,{recursive:true});await writeFile(join(cfg,'audacity.cfg'),config.replace('mod-script-pipe=1','mod-script-pipe=0'))}
const to=`/tmp/audacity_script_pipe.to.${process.getuid()}`,from=`/tmp/audacity_script_pipe.from.${process.getuid()}`
for(const path of [to,from]){try{await access(path);throw new Error('Existing Audacity pipe; refusing to reuse it')}catch(e){if(e.code!=='ENOENT')throw e}}
// Populate the plugin registry before enabling scripting. Audacity's first-run
// plugin validator is another process; loading the scripting module there can
// replace the main editor's FIFOs while it is already waiting on them.
const warm=spawn('xvfb-run',['-a','audacity'],{env,stdio:'inherit',detached:true})
const warmExit=new Promise((resolve,reject)=>{warm.once('error',reject);warm.once('exit',resolve)})
await Promise.race([new Promise(resolve=>setTimeout(resolve,10000)),warmExit.then(code=>{throw new Error(`Audacity registry warmup exited ${code}`)})])
try{process.kill(-warm.pid,'SIGTERM')}catch{}
await warmExit
for(const cfg of profiles)await writeFile(join(cfg,'audacity.cfg'),config)
const editor=spawn('xvfb-run',['-a','audacity'],{env,stdio:'inherit',detached:true})
try{
 let ready=false
 for(let i=0;i<60;i++){try{await access(to);await access(from);ready=true;break}catch{};await new Promise(r=>setTimeout(r,1000))}
 if(!ready)throw new Error('Audacity scripting pipe did not start within 60s')
 const version=execFileSync('dpkg-query',['-W','-f=${Version}','audacity'],{encoding:'utf8'}).trim()
 const isolatedEnv={...env,AUDIO_TEST_AUDACITY_ISOLATED:'1',AUDIO_TEST_AUDACITY_TO:to,AUDIO_TEST_AUDACITY_FROM:from,AUDIO_TEST_AUDACITY_VERSION:version}
 const run=args=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['bin/audio-test.js',...args],{stdio:'inherit',env:isolatedEnv})
  child.once('error',reject);child.once('exit',resolve)
 })
 const args=process.argv.slice(2),bench=args.includes('--bench')
 process.exitCode=await run(['run','--adapter','audacity','--tier','research','--report-only','--out','results/audacity.json',...args.filter(arg=>arg!=='--bench')])
 if(bench&&process.exitCode===0){
  // The server recreates its FIFOs when the correctness worker disconnects.
  await new Promise(resolve=>setTimeout(resolve,250))
  process.exitCode=await run(['bench','--adapter','audacity','--repeats',String(repeats),'--out','results/audacity-benchmarks.json'])
 }
}finally{try{process.kill(-editor.pid,'SIGTERM')}catch{}}
