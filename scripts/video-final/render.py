"""Reproducible review cut: authentic dated hosted footage + recorded Preprod evidence.
No simulated UI, transaction, wallet approval or live proof progress.
"""
import pathlib,json,subprocess,textwrap,re,wave,math
import numpy as np
from PIL import Image,ImageDraw,ImageFont
R=pathlib.Path(__file__).resolve().parents[2];W=R/'.cache/video-final';O=R/'docs/video/final';O.mkdir(parents=True,exist_ok=True)

if not (W/'audio/plan.json').exists():
 import shutil
 shutil.copytree(O/'source/audio',W/'audio',dirs_exist_ok=True)
plan=json.loads((W/'audio/plan.json').read_text());ev=json.loads((R/'docs/evidence/preprod-authorization.json').read_text())
font=R/'apps/web/app/fonts/SpaceGrotesk.ttf'
def F(n):return ImageFont.truetype(str(font),n)
ink='#101827';muted='#AAB6CC';blue='#8AA3FF';white='#F4F5FA'
def wrap(d,s,xy,width,font,fill,spacing=12):
 x,y=xy;line=''
 for word in s.split():
  test=(line+' '+word).strip()
  if d.textlength(test,font=font)>width and line:d.text((x,y),line,font=font,fill=fill);y+=font.size+spacing;line=word
  else:line=test
 if line:d.text((x,y),line,font=font,fill=fill);y+=font.size+spacing
 return y
refs=ev['authorizationTransactions']
details={
 'problem':['A certificate can reveal more than an application needs.','Verify eligibility. Minimize collection.'],
 'introduction':['Vercel: public interface','Render: issuer and verifier API','Neon: durable encrypted state','Midnight: private contract constraints'],
 'holder':['Device-generated signing key','Encrypted vault and recovery backup','Hosted recording · 21 October 2026'],
 'issuance':['Holder-bound enrollment','Real holder and issuer signatures','Sample training issuer · synthetic qualification'],
 'hackathon':['REAL PREPROD · SUCCESS','Hackathon authorization · block 3086593',refs[0],'Dedicated terminal operator; recorded execution.'],
 'community':['REAL PREPROD · SUCCESS','Community authorization · block 3086617',refs[1],'Same test credential. Separate policy and challenge.'],
 'replay':['DURABLE REPLAY REJECTED','Both accepted challenges consumed in Neon.','Recorded acceptance: 22 October 2026','This panel reports actual test evidence; it is not a live terminal.'],
 'revocation':['REAL PREPROD · SUCCESS','Revocation published · block 3086630',ev['revocationTransaction'],'Restored holder backup → fresh active-membership constraint rejection.'],
 'technical':['Compact 0.31.1 · Midnight.js 4.1.1','91 root tests + 39 signed-module tests passed','Verifier keys and deployed state independently pinned','Installed-wallet acceptance remains pending.'],
 'closing':['useveilpass.vercel.app','github.com/Psalmuel01/veilpass','Verified Preprod prototype','Next: hosted-browser proof acceptance, independent review and external pilot.']}
# These excerpts are actual prior hosted screen recordings. Keep date and scope visible.
clips={'problem':(3.6,6),'introduction':(4,5),'holder':(22.2,6),'issuance':(39.95,6)}
allcaps=[]
def ms(t):
 n=round(t*1000);return f'{n//3600000:02}:{n//60000%60:02}:{n//1000%60:02},{n%1000:03}'
for i,s in enumerate(plan['scenes']):
 im=Image.new('RGB',(1920,1080),ink);d=ImageDraw.Draw(im)
 d.text((72,44),'V / veilpass.',font=F(35),fill=white);d.text((1380,52),'TECHNICAL REVIEW CUT',font=F(20),fill=blue)
 d.rectangle((72,110,1848,113),fill='#334567')
 wrap(d,s['title'],(72,145),1700,F(48),white)
 if s['id'] in clips:
  d.rounded_rectangle((68,280,1324,1000),20,fill='#263149')
  y=310
  for t in details[s['id']]:y=wrap(d,t,(1370,y),450,F(27),blue if t==details[s['id']][0] else white,16)+35
  d.text((80,1025),'HOSTED UI · RECORDED 21 OCT 2026 · SIGNED CREDENTIAL FLOW',font=F(20),fill=muted)
 else:
  d.rounded_rectangle((72,290,1848,990),24,fill='#1C2639')
  y=335
  for j,t in enumerate(details[s['id']]):y=wrap(d,t,(120,y),1670,F(30 if len(t)>55 else 39),blue if j==0 else white,16)+32
  d.text((80,1025),'REAL PREPROD EVIDENCE · 22 OCT 2026 · RECORDED TERMINAL ACCEPTANCE',font=F(20),fill=muted)
 card=W/(s['id']+'.png');im.save(card)
 cmd=['ffmpeg','-y','-v','error','-loop','1','-i',str(card)]
 filters=[]
 if s['id'] in clips:
  start,length=clips[s['id']];cmd+=['-stream_loop','-1','-i',str(O/'source'/(s['id']+'.mp4'))]
  filters=['[1:v]scale=1240:698,setsar=1[v];[0:v][v]overlay=76:290:shortest=0[out]'];vmap='[out]'
 else:vmap='0:v'
 if filters:cmd+=['-filter_complex',filters[0]]
 cmd+=['-map',vmap,'-an','-t',str(s['duration']),'-r','30','-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p',str(W/(s['id']+'-silent.mp4'))]
 subprocess.run(cmd,check=True)
 # Narration subtitles come directly from the synthesizer's timing.
 src=(W/'audio'/(s['id']+'.srt')).read_text()
 def secs(v):h,m,z=v.replace(',','.').split(':');return int(h)*3600+int(m)*60+float(z)
 for block in re.split(r'\n\s*\n',src.strip()):
  lines=block.splitlines()
  if len(lines)<3:continue
  a,b=lines[1].split(' --> ');end=min(secs(b),s['duration']);beg=secs(a)
  if end>beg:allcaps.append((s['start']+beg,s['start']+end,' '.join(lines[2:])))
 print('Rendered',s['id'],flush=True)
# Original, restrained procedural music, created for this project (no third-party samples).
sr=48000;total=210;music=np.zeros((total*sr,2),dtype=np.float32)
for start in range(0,total,8):
 n=min(8*sr,len(music)-start*sr);t=np.arange(n)/sr;fade=np.minimum(1,t/1.5)*np.minimum(1,(n/sr-t)/2)
 chord=[130.8128,164.8138,195.9977] if (start//8)%2==0 else [110,146.8324,164.8138]
 for j,f in enumerate(chord):
  v=.025*fade*(np.sin(2*np.pi*f*t)+.2*np.sin(2*np.pi*f*2*t));music[start*sr:start*sr+n,j%2]+=v
with wave.open(str(W/'original-bed.wav'),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(sr);f.writeframes((np.clip(music,-1,1)*32767).astype('<i2').tobytes())
# Per-scene audio padded to exact timeline; no accelerated voice.
audio=[]
for s in plan['scenes']:
 if s['audioSeconds']>s['duration']:raise RuntimeError('Narration exceeds scene '+s['id'])
 p=W/(s['id']+'.wav');subprocess.run(['ffmpeg','-y','-v','error','-i',str(W/'audio'/(s['id']+'.mp3')),'-af','apad','-t',str(s['duration']),'-ar','48000','-ac','2',str(p)],check=True);audio.append(p)
for kind,files in [('video',[W/(s['id']+'-silent.mp4')for s in plan['scenes']]),('voice',audio)]:
 (W/(kind+'-concat.txt')).write_text(''.join("file '"+str(f)+"'\n"for f in files))
subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(W/'video-concat.txt'),'-c','copy',str(W/'silent.mp4')],check=True)
subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(W/'voice-concat.txt'),str(W/'voice.wav')],check=True)
subprocess.run(['ffmpeg','-y','-v','error','-i',str(W/'silent.mp4'),'-i',str(W/'voice.wav'),'-i',str(W/'original-bed.wav'),'-filter_complex','[1:a]loudnorm=I=-16:TP=-1.5:LRA=9[v];[2:a]volume=0.10,afade=t=in:d=3,afade=t=out:st=206:d=4[m];[v][m]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-2:LRA=9[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t','210','-movflags','+faststart',str(O/'veilpass-preprod-technical-review.mp4')],check=True)
(O/'veilpass-preprod-technical-review.srt').write_text('\n\n'.join(f'{i+1}\n{ms(a)} --> {ms(b)}\n{t}'for i,(a,b,t)in enumerate(allcaps))+'\n')
(O/'narration.md').write_text('\n\n'.join(f"### {s['start']}–{s['start']+s['duration']} seconds · {s['title']}\n\n{s['text']}\n\nVisual: {s['visual']}"for s in plan['scenes']))
(O/'CREDITS.md').write_text('Narration: Microsoft Edge TTS, en-US-AvaNeural. Music: original procedural composition generated by scripts/video-final/render.py; no third-party samples. Hosted UI footage: VeilPass, recorded 21 October 2026. Protocol evidence: actual Midnight Preprod execution reconciled 22 October 2026. This review cut does not claim installed-wallet/browser proof acceptance.\n')
(O/'timeline.json').write_text(json.dumps(plan,indent=2)+'\n')
print('Review MP4 and captions exported.',flush=True)
