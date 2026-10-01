"""JSON-lines bridge to an explicitly isolated Audacity mod-script-pipe session."""
import json, os, sys, tempfile, traceback
import numpy as np
import soundfile as sf
from audacity_commands import prepare_gains, speed_command, fade_commands

if os.environ.get('AUDIO_TEST_AUDACITY_ISOLATED') != '1':
    raise RuntimeError('Refusing to control a desktop session: AUDIO_TEST_AUDACITY_ISOLATED=1 required')
to_path = os.environ['AUDIO_TEST_AUDACITY_TO']
from_path = os.environ['AUDIO_TEST_AUDACITY_FROM']
# These are existing FIFOs, not files to create or truncate.
writer = os.fdopen(os.open(to_path, os.O_WRONLY), 'w')
reader = os.fdopen(os.open(from_path, os.O_RDONLY))

def command(text):
    writer.write(text+'\n'); writer.flush()
    lines = []
    while True:
        line = reader.readline()
        if not line: raise RuntimeError('Audacity pipe closed')
        lines.append(line)
        if line.strip().startswith('BatchCommand finished:'):
            reply = ''.join(lines)
            if 'BatchCommand finished: OK' not in reply: raise RuntimeError(text+': '+reply)
            return reply

def select(start, end):
    command(f'Select: Start={start} End={end} Track=0 TrackCount=1')

for line in sys.stdin:
    try:
        request = json.loads(line)
        if request['method'] == 'version':
            command('GetInfo: Type=Tracks')
            print(json.dumps({'value': os.environ.get('AUDIO_TEST_AUDACITY_VERSION', 'unknown')}), flush=True)
            continue
        if request['method'] == 'metadata':
            print(json.dumps({'value': {'pythonVersion': sys.version.split()[0], 'numpyVersion': np.__version__, 'soundfileVersion': sf.__version__, 'libsndfileVersion': sf.__libsndfile_version__}}), flush=True)
            continue
        t, sr = request['test'], request['sampleRate']
        gains = prepare_gains(t.get('steps', []))
        x = np.asarray(request['input'], dtype=np.float32)
        with tempfile.TemporaryDirectory(prefix='audio-test-audacity-') as folder:
            source, target = folder+'/input.wav', folder+'/output.wav'
            sf.write(source, x.T, sr, subtype='FLOAT')
            tracks = command('GetInfo: Type=Tracks')
            tracks = json.loads(tracks[tracks.index('['):tracks.rindex(']')+1])
            if tracks:
                command('SelectAll:'); command('RemoveTracks:')
            command(f'SetProject: Rate={sr}')
            command('Import2: Filename='+json.dumps(source)); command('SelectAll:')
            if t.get('workflow'):
                w = t['workflow']; select(w['start']/sr, (w['start']+w['length'])/sr)
                command('Copy:'); select(x.shape[1]/sr, x.shape[1]/sr); command('Paste:')
                select(x.shape[1]/sr, (x.shape[1]+w['length'])/sr); command('Reverse:')
            else:
                for index, s in enumerate(t['steps']):
                    op = s['op']
                    if index in gains:
                        for text in gains[index]: command(text)
                    elif op == 'reverse': command('Reverse:')
                    elif op == 'reverse-range':
                        select(s['start']/sr, (s['start']+s['length'])/sr); command('Reverse:')
                    elif op == 'remove':
                        select(s['start']/sr, (s['start']+s['length'])/sr); command('Delete:')
                    elif op == 'trim':
                        select(s['start']/sr, (s['start']+s['length'])/sr); command('Trim:')
                    elif op == 'normalize': command(f'Normalize: ApplyGain=1 PeakLevel={s["db"]} RemoveDcOffset=0 StereoIndependent=0')
                    elif op == 'fade':
                        for text in fade_commands(s['direction'], s['length'], sr): command(text)
                    elif op == 'resample':
                        # Export2 renders tracks at the project rate. The menu's
                        # Resample action opens a dialog and has no rate argument.
                        command(f'SetProject: Rate={s["to"]}')
                    elif op == 'repeat': command(f'Repeat: Count={s["count"]-1}')
                    elif op == 'speed': command(speed_command(s['factor']))
                    elif op == 'stretch': command(f'ChangeTempo: Percentage={(1/s["factor"]-1)*100}')
                    elif op == 'pitch': command(f'ChangePitch: Percentage={(2**(s["semitones"]/12)-1)*100}')
                    else: raise ValueError('Unmapped operation '+op)
                    command('SelectAll:')
            command('SelectAll:')
            command('Export2: Filename='+json.dumps(target)+f' NumChannels={x.shape[0]}')
            y, rate = sf.read(target, dtype='float32', always_2d=True)
            if sf.info(target).subtype != 'FLOAT': raise RuntimeError('Audacity export must be float32 WAV; configure export preferences')
            out = {'channels': y.T.tolist(), 'sampleRate': rate}
            if t.get('workflow'): out['observations'] = {'sourceAfter': y[:x.shape[1]].T.tolist()}
            print(json.dumps({'value': out}, allow_nan=False), flush=True)
    except Exception:
        print(json.dumps({'error': traceback.format_exc()}), flush=True)
