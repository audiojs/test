import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile,writeFile } from 'node:fs/promises'
const exec=promisify(execFile),entries=[]
const propose=name=>/loud|ebu|r128/.test(name)?['BS.1770/EBU published vectors','gating and channel weighting']:/resam|rate/.test(name)?['passband and alias rejection','duration and flush']:/pitch|stretch|tempo|speed/.test(name)?['pitch/duration ratio','transient and stereo coherence']:/filter|pass|shelf|equal|eq|notch/.test(name)?['frequency/impulse response','stability and channel isolation']:/compress|limit|gate/.test(name)?['static transfer curve','attack/release and stereo linking']:['documented identity/neutral behavior','known signal response','frame count, channels, non-finite and boundary behavior']
async function native(id,args,pattern,url){const {stdout,stderr}=await exec(id,args);const names=[...(stdout+stderr).matchAll(pattern)].map(m=>m[1]);entries.push({id,source:url,version:(await exec(id,[id==='ffmpeg'?'-version':'--version'])).stdout.split('\n')[0],features:[...new Set(names)].sort().map(name=>({name,proposedTests:propose(name)}))})}
await native('ffmpeg',['-hide_banner','-filters'],/^\s*[.A-Z|]{2,3}\s+(\w+)\s+[AN|]+\s*->\s*[AN|]+/gm,'https://ffmpeg.org/ffmpeg-filters.html')
const sox=await exec('sox',['--help']);const effects=(sox.stdout.match(/EFFECTS:\s*([^\n]+)/)||[])[1]
entries.push({id:'sox',source:'https://sox.sourceforge.net/sox.html',features:(effects||'').trim().split(/\s+/).filter(Boolean).map(name=>({name,proposedTests:propose(name)}))})
const python=process.env.AUDIO_TEST_PYTHON||'python3'
for(const id of ['librosa','pedalboard']){
 const code=id==='pedalboard'?"import pedalboard as p,json; print(json.dumps({'version':p.__version__,'names':[n for n in dir(p) if isinstance(getattr(p,n),type) and issubclass(getattr(p,n),p.Plugin)]+['time_stretch']}))":"import librosa as p,json; print(json.dumps({'version':p.__version__,'names':[f'{m}.{n}' for m in ['effects','feature','onset','beat','segment','sequence','decompose','util'] for n in dir(getattr(p,m)) if not n.startswith('_') and callable(getattr(getattr(p,m),n))]+['resample','stft','istft','to_mono','load','stream']}))"
 const {stdout}=await exec(python,['-c',code],{timeout:120000});const data=JSON.parse(stdout)
 entries.push({id,source:id==='librosa'?'https://librosa.org/doc/0.11.0/':'https://spotify.github.io/pedalboard/reference/pedalboard.html',version:data.version,features:data.names.map(name=>({name,proposedTests:propose(name.toLowerCase())}))})
}
const source='https://manual.audacityteam.org/man/scripting_reference.html',response=await fetch(source)
if(!response.ok)throw new Error(`Audacity manual: ${response.status}`)
const html=await response.text(),commands=[...new Set([...html.matchAll(/>\s*([A-Z][A-Za-z0-9_]+):\s*</g)].map(m=>m[1]))].sort()
if(commands.length<100)throw new Error('Audacity command scraper found too few entries')
entries.push({id:'audacity',source,version:'manual snapshot; not a measured binary',features:commands.map(name=>({name,proposedTests:propose(name.toLowerCase())}))})
// Refresh discovered APIs without dropping the separately reviewed market survey.
const previous=JSON.parse(await readFile(new URL('../spec/competitors.json',import.meta.url),'utf8'))
const discovered=new Set(entries.map(entry=>entry.id))
entries.push(...previous.contenders.filter(entry=>entry.curated&&!discovered.has(entry.id)))
const result={schema:1,generatedAt:new Date().toISOString(),reviewedAt:previous.reviewedAt,scope:'Public API/CLI/manual inventory, not a coverage claim. UI commands and utilities are included and require scope triage.',contenders:entries}
await writeFile(new URL('../spec/competitors.json',import.meta.url),JSON.stringify(result,null,2)+'\n')
for(const e of entries)console.log(`${e.id}: ${e.features.length} inventory entries`)
