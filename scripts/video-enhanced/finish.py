"""Original 120 BPM score, subtle UI sound design, speech ducking and deliverables."""
from pathlib import Path
import json,subprocess,re,wave,shutil,hashlib,textwrap
import numpy as np
R=Path(__file__).resolve().parents[2];W=R/'.cache/video-enhanced';O=R/'docs/video/enhanced';P=json.loads((W/'audio/plan.json').read_text());sr=48000;N=180*sr
rng=np.random.default_rng(9403);music=np.zeros((N,2),np.float32);effects=np.zeros_like(music)
def add(dst,start,v,pan=0):
 at=round(start*sr);n=min(len(v),len(dst)-at)
 if n>0:
  dst[at:at+n,0]+=v[:n]*np.sqrt((1-pan)/2);dst[at:at+n,1]+=v[:n]*np.sqrt((1+pan)/2)
def tone(freq,dur,amp=.1):
 t=np.arange(round(dur*sr))/sr;env=np.minimum(1,t/.025)*np.exp(-3*t/dur);return amp*env*(np.sin(2*np.pi*freq*t)+.18*np.sin(4*np.pi*freq*t))
chords=[[130.8128,164.8138,195.9977],[110,130.8128,164.8138],[87.3071,130.8128,174.6141],[97.9989,146.8324,195.9977]]
for bar in range(90):
 start=bar*2;ch=chords[(bar//4)%4]
 # Warm layered chord, subtly opening toward the proof section.
 for j,f in enumerate(ch):
  t=np.arange(2*sr)/sr;env=np.minimum(1,t/.18)*np.minimum(1,(2-t)/.4);v=.032*env*(np.sin(2*np.pi*f*t)+.12*np.sin(2*np.pi*f*2*t));add(music,start,v,(j-1)*.45)
 for beat in range(4):
  pos=start+beat*.5
  if pos<2:continue
  # Soft electronic kick with tonal pitch decay.
  t=np.arange(int(.24*sr))/sr;freq=49+66*np.exp(-t*35);phase=2*np.pi*np.cumsum(freq)/sr;k=.15*np.sin(phase)*np.exp(-t*24);add(music,pos,k)
  add(music,pos,tone(ch[0]/2,.24,.075))
  if beat in [1,3]:
   t=np.arange(int(.12*sr))/sr;noise=rng.normal(size=len(t));v=.024*(noise-np.roll(noise,1))*np.exp(-t*36);add(music,pos,v,.15)
  for off in [0,.25]:
   t=np.arange(int(.05*sr))/sr;noise=rng.normal(size=len(t));h=.010*(noise-np.roll(noise,1))*np.exp(-t*100);add(music,pos+off,h,-.25 if off else .25)
 if start>14:
  for j,offset in enumerate([0,.75,1.25]):add(music,start+offset,tone(ch[j]*2,.38,.025),(-1)**j*.35)
# A consonant resolution at the final logo and a three-second fade.
for f in [130.8128,164.8138,195.9977,261.6256]:add(music,173,tone(f,6,.06))
t=np.arange(N)/sr;gain=np.minimum(1,t/3)*np.minimum(1,(180-t)/3);energy=np.where((t>=100)&(t<120),1.15,1.0);energy=np.where((t>=120)&(t<145),.80,energy);music*= (gain*energy)[:,None]
for at,kind in [(9,'title'),(39,'issue'),(66.9,'ok'),(89,'ok'),(100,'title'),(121,'reject'),(133,'reject'),(171,'title')]:
 if kind in ['issue','ok','title']:
  for j,f in enumerate([523.25,659.25,783.99] if kind=='ok'else[392,523.25]):add(effects,at+j*.06,tone(f,.22,.033),-.15+j*.15)
 else:
  add(effects,at,tone(196,.16,.026));add(effects,at+.09,tone(146.83,.20,.026))
def wav(path,a):
 with wave.open(str(path),'wb')as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(sr);f.writeframes((np.clip(a,-1,1)*32767).astype('<i2').tobytes())
wav(W/'original-120bpm.wav',music);wav(W/'interface-sfx.wav',effects)
for s in P['scenes']:
 if s['audioSeconds']>s['duration']-.02:raise RuntimeError('Scene audio exceeds available duration: '+s['id'])
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(W/'audio'/(s['id']+'.mp3')),'-af','apad','-t',str(s['duration']),'-ar','48000','-ac','2',str(W/(s['id']+'.wav'))],check=True)
(W/'voice-concat.txt').write_text(''.join(f"file '{W/(s['id']+'.wav')}'\n"for s in P['scenes']))
subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(W/'voice-concat.txt'),str(W/'voice.wav')],check=True)
subprocess.run(['ffmpeg','-y','-v','error','-i',str(W/'voice.wav'),'-i',str(W/'original-120bpm.wav'),'-i',str(W/'interface-sfx.wav'),'-filter_complex','[0:a]highpass=f=65,loudnorm=I=-16:TP=-2:LRA=8,asplit=2[v][key];[1:a]volume=0.48[bed];[bed][key]sidechaincompress=threshold=0.018:ratio=6:attack=12:release=220[duck];[v][duck][2:a]amix=inputs=3:normalize=0,loudnorm=I=-16:TP=-2:LRA=8,aresample=48000[a]','-map','[a]',str(W/'mix.wav')],check=True)
for kind,name in [('burn','veilpass-final-demo.mp4'),('clean','veilpass-final-demo-clean.mp4')]:
 listing=W/(kind+'-concat.txt');listing.write_text(''.join(f"file '{W/(s['id']+'-'+kind+'.mp4')}'\n"for s in P['scenes']))
 subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(listing),'-i',str(W/'mix.wav'),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t','180','-movflags','+faststart',str(O/name)],check=True)
# Derive and sanitize subtitle timings from actual TTS output; preserve final words.
def sec(v):h,m,s=v.replace(',','.').split(':');return int(h)*3600+int(m)*60+float(s)
def stamp(t):n=round(t*1000);return f'{n//3600000:02}:{n//60000%60:02}:{n//1000%60:02},{n%1000:03}'
cap=[]
for s in P['scenes']:
 for b in re.split(r'\n\s*\n',(W/'audio'/(s['id']+'.srt')).read_text().strip()):
  lines=b.splitlines()
  if len(lines)<3:continue
  a,z=lines[1].split(' --> ');cap.append([s['start']+sec(a),s['start']+min(sec(z),s['duration']),' '.join(lines[2:])])
for i in range(len(cap)-1):cap[i][1]=min(cap[i][1],cap[i+1][0])
(O/'veilpass-subtitles.srt').write_text('\n\n'.join(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{chr(10).join(textwrap.wrap(text,72))}'for i,(a,b,text)in enumerate(cap))+'\n')
(O/'veilpass-voiceover.txt').write_text('\n\n'.join(s['text']for s in P['scenes'])+'\n')
shots=json.loads((R/'scripts/video-enhanced/shots.json').read_text())
(O/'veilpass-shotlist.md').write_text('# VeilPass final demo · 3:00\n\n'+'\n\n'.join(f"## {s['start']//60:02d}:{s['start']%60:02d}–{(s['start']+s['duration'])//60:02d}:{(s['start']+s['duration'])%60:02d} | {s['title']}\n\n{shots[s['id']]}\n\nNarration: {s['text']}"for s in P['scenes'])+'\n')
(O/'music-license.md').write_text('# Music and sound provenance\n\nOriginal 120 BPM electronic instrumental and interface sound effects, synthesized procedurally by `finish.py` for this demo. No third-party recordings, samples or copyrighted songs. Source code and deterministic seed included; the project owner may use, modify and redistribute these generated recordings with VeilPass. No external music attribution required.\n\nVoice: Microsoft Edge TTS, American English Ava (`en-US-AvaNeural`), generated from the included final script. Product footage: actual VeilPass hosted browser capture, 21 October 2026. Preprod evidence: repository acceptance reconciled 22 October 2026. Typography: existing project Space Grotesk, with its original license retained.\n')
(O/'timeline.json').write_text(json.dumps(P,indent=2)+'\n')
print('Final and clean three-minute exports complete.',flush=True)
