"""VeilPass 1080p30 motion edit. Genuine product footage, source excerpts and
recorded canonical evidence are composited with explicitly conceptual motion.
Rebuild: python render.py [--preview] [--scene ID]. Requires Pillow/numpy/ffmpeg.
"""
import pathlib,json,math,re,subprocess,wave,functools,argparse,shutil
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
R=pathlib.Path(__file__).resolve().parents[2];W=R/'.cache/video-enhanced';O=R/'docs/video/enhanced';O.mkdir(parents=True,exist_ok=True)

if not (W/'footage/00001.jpg').exists():
 (W/'footage').mkdir(parents=True,exist_ok=True)
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(R/'.cache/video-hosted/hosted-browser-raw.webm'),'-vf','fps=15','-q:v','3',str(W/'footage/%05d.jpg')],check=True)
PLAN=json.loads((W/'audio/plan.json').read_text());SCENES=PLAN['scenes'];E=json.loads((R/'docs/evidence/preprod-authorization.json').read_text());FPS=30;SIZE=(1920,1080)
INK='#101722';IVORY='#F5F3ED';BLUE='#405BFF';PALE='#CBD3FF';MUTED='#A8B3C7';GREEN='#A5E1CE';RED='#F2B5B5'
@functools.lru_cache(100)
def font(n):return ImageFont.truetype(str(R/'apps/web/app/fonts/SpaceGrotesk.ttf'),n)
def ease(t):return 1-(1-max(0,min(1,t)))**3
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def words(d,text,maxw,n):
 rows=[];line=''
 for w in text.split():
  q=(line+' '+w).strip()
  if d.textlength(q,font=font(n))>maxw and line:rows.append(line);line=w
  else:line=q
 if line:rows.append(line)
 return rows
def text(im,s,xy,n=32,fill=IVORY,width=None):
 d=ImageDraw.Draw(im);x,y=xy
 for line in words(d,s,width,n)if width else s.split('\n'):d.text((round(x),round(y)),line,font=font(n),fill=fill);y+=n+10
 return y
def roundbox(im,box,fill='#1D293C',r=24,outline=None):ImageDraw.Draw(im).rounded_rectangle(tuple(round(x)for x in box),r,fill=fill,outline=outline,width=2)
def fadepaste(im,layer,pos,alpha=1):
 if alpha<=0:return
 if layer.mode!='RGBA':layer=layer.convert('RGBA')
 if alpha<1:layer.putalpha(layer.getchannel('A').point(lambda p:round(p*alpha)))
 im.paste(layer,tuple(round(v)for v in pos),layer)
def chip(im,label,xy,fill=BLUE,n=23):
 d=ImageDraw.Draw(im);x,y=xy;w=d.textlength(label,font=font(n))+38;roundbox(im,(x,y,x+w,y+n+26),fill,16);text(im,label,(x+19,y+9),n);return w
@functools.lru_cache(80)
def source_frame(i):return Image.open(W/'footage'/f'{min(1647,max(1,i)):05d}.jpg').convert('RGB')
def footage(im,at,box,zoom=1,focus=(.55,.5),alpha=1):
 frame=source_frame(int(at*15)+1);x,y,w,h=box
 # Crop actual recording only; never synthesize a browser result.
 sw,sh=frame.size;ratio=w/h;cw=min(sw,sh*ratio)/zoom;ch=cw/ratio;cx=min(sw-cw,max(0,focus[0]*sw-cw/2));cy=min(sh-ch,max(0,focus[1]*sh-ch/2))
 pic=frame.crop((cx,cy,cx+cw,cy+ch)).resize((round(w),round(h)),Image.Resampling.BICUBIC).convert('RGBA')
 mask=Image.new('L',pic.size);ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),18,fill=255);pic.putalpha(mask);fadepaste(im,pic,(x,y),alpha)
def backdrop(t,s):
 im=Image.new('RGB',SIZE,INK);d=ImageDraw.Draw(im)
 # Restrained moving proof lines create depth without generic blockchain particles.
 for j in range(6):
  y=170+j*140+12*math.sin(t*.12+j);d.line([(0,y),(1920,y-100)],fill='#172234',width=1)
 text(im,'V / veilpass.',(70,37),36);text(im,f"MIDNIGHT PREPROD   /   {s['start']//60:02d}:{s['start']%60:02d}",(1400,46),19,MUTED)
 d.line((72,105,1848,105),fill='#36415C',width=2)
 text(im,s['title'],(72,140),47,width=1740)
 # Three-minute progress line, aligned with the cut.
 d.line((72,910,1848,910),fill='#26354F',width=2);d.line((72,910,72+1776*t/180,910),fill=BLUE,width=3)
 return im

def reference(im,label,ref,y=790,block=None):
 roundbox(im,(80,y,1840,y+108),'#202D43',16)
 text(im,label+(f'  ·  BLOCK {block}'if block else ''),(105,y+12),24,GREEN)
 text(im,ref,(105,y+53),23,IVORY)

def evidence_panel(im,kind,elapsed,x=1260):
 if elapsed<0:return
 p=ease(elapsed/.5);x=x+45*(1-p);roundbox(im,(x,300,x+570,760),'#202D43',25)
 text(im,'RECORDED PREPROD',(x+30,330),22,PALE)
 text(im,'PROOF VERIFIED'if kind=='A' else 'SEPARATE POLICY',(x+30,395),33,width=510)
 text(im,'Hackathon eligibility'if kind=='A'else'Professional community',(x+30,452),29,width=510)
 chip(im,'ELIGIBLE',(x+30,535),'#286357',27)
 text(im,'Confirmed terminal-operator execution',(x+30,615),24,MUTED,width=490)
 text(im,'Not a public-browser proof',(x+30,690),22,MUTED,width=490)
 # Finite, low-amplitude success ring.
 if 0<elapsed<1.2:
  a=1-elapsed/1.2;d=ImageDraw.Draw(im);r=28+elapsed*45;d.ellipse((x+490-r,550-r,x+490+r,550+r),outline=tuple(round(v*a)for v in (90,150,140)),width=2)

def flow(im,t,labels,y=720):
 d=ImageDraw.Draw(im);n=len(labels);w=400;gap=40;start=100
 for i,label in enumerate(labels):
  amount=ease((t-i*.35)/.6);x=start+i*(w+gap);yy=y+20*(1-amount)
  if amount:
   layer=Image.new('RGBA',(w,100));roundbox(layer,(0,0,w-1,99),'#26344F',18);text(layer,label,(20,30),25,width=w-40);fadepaste(im,layer,(x,yy),amount)
  if i<n-1:
   p=ease((t-.2-i*.35)/.8);d.line((x+w+5,y+50,x+w+5+(gap-10)*p,y+50),fill=PALE,width=3)

def hook(im,u):
 im.paste(IVORY,(0,0,1920,1080));d=ImageDraw.Draw(im)
 text(im,'PRIVACY SHOULD BE THE DEFAULT.',(96,90),25,BLUE)
 if u<9:
  x=470+40*(1-ease(u/.8));roundbox(im,(x,220,x+980,820),'#FFFFFF',28,outline='#E0E3EC')
  text(im,'DEVELOPER QUALIFICATION',(x+55,265),33,INK)
  fields=['Name: Alex Example','Date of birth: 01 / 01 / 2000','Address: Private residence','Certificate: Approved training']
  for j,label in enumerate(fields):
   a=1-smooth((u-2-j*.6)/.7)
   if a:
    l=Image.new('RGBA',(850,65));text(l,label,(0,0),30,INK);fadepaste(im,l,(x+55,350+j*75),a)
  p=ease((u-5)/.7)
  if p:
   text(im,'QUALIFIED',(x+55,660-40*(1-p)),60,BLUE);d.line((x+600,694,x+620,714,x+660,665),fill=BLUE,width=7)
  text(im,'CONCEPTUAL ILLUSTRATION · FICTIONAL DETAILS',(100,870),20,'#6A7284')
 else:
  p=ease((u-9)/.7);text(im,'V / veilpass.',(480,350+35*(1-p)),112,INK)
  text(im,'Prove what qualifies you.',(480,520),43,INK);text(im,'Reveal nothing else.',(480,580),43,BLUE)
  text(im,'BUILT ON MIDNIGHT',(480,705),24,'#65708A')
 # Horizontal mask wipes the certificate away at the logo reveal.
 if 8.6<u<9.1:
  q=smooth((u-8.6)/.5);d.rectangle((0,0,1920*q,1080),fill=BLUE)
 return im

def code(im,file,lines,box):
 x,y,w,h=box;roundbox(im,(x,y,x+w,y+h),'#182235',20);text(im,file,(x+25,y+20),23,PALE)
 yy=y+75
 for line in lines:
  # Exact lines from repository, wrapped only for composition.
  for row in textwrap_code(line,max(35,int(w/15))):
   text(im,row,(x+25,yy),22,PALE if any(k in row for k in ['assert','export','verifyHolder'])else IVORY);yy+=34
   if yy>y+h-35:return

def textwrap_code(s,width):
 return [s[i:i+width]for i in range(0,len(s),width)]or['']
compact=(R/'integrations/issuance/authorization.compact').read_text().splitlines()
verifier=(R/'integrations/issuance/src/verifier.ts').read_text().splitlines()

def scene_picture(s,u):
 t=s['start']+u;im=backdrop(t,s);id=s['id']
 if id=='hook':return hook(im,u)
 if id=='intro':
  at=3.5+min(u,5.5) if u<7 else 10.7+min(u-7,4)
  p=smooth((u-6.7)/.5)
  footage(im,at,(80,235,1760,650),1.03+.035*u/15,focus=(.52,.48))
  chip(im,'HOSTED PRODUCT · 21 OCT 2026',(110,252),'#273759',20)
  if u>8:chip(im,'Holder-controlled keys',(1160,790),BLUE,27)
 elif id=='issuance':
  # Actual creation outcome, issuer enrollment and signed credential arrival.
  if u<7:at=22.2+u*.8;label='Holder-controlled keys';focus=(.62,.55)
  elif u<14:at=30.6+(u-7)*1.05;label='Issuer-signed credential';focus=(.62,.55)
  elif u<20:at=40+(u-14)*1.35;label='Encrypted storage';focus=(.62,.62)
  else:at=68.5+(u-20)*1.15;label='Encrypted recovery';focus=(.62,.65)
  footage(im,at,(80,235,1760,650),1.12+.025*ease(u/25),focus)
  chip(im,label,(110,255),BLUE,25)
  text(im,'GENUINE HOSTED FLOW · SYNTHETIC HOLDER · 21 OCT',(100,851),20,PALE)
  # Explicit conceptual card transfer overlays a real, recognizable interface.
  if 9<u<12:
   p=ease((u-9)/3);x=1230-500*p;y=320+140*p
   l=Image.new('RGBA',(340,130));roundbox(l,(0,0,339,129),BLUE,19);text(l,'Signed qualification',(20,25),25);text(l,'Conceptual transfer',(20,75),19,PALE);fadepaste(im,l.filter(ImageFilter.GaussianBlur(1.5*(1-p))),(x,y),math.sin(math.pi*p)**.4)
 elif id in ['policyA','policyB']:
  kind='A'if id=='policyA'else'B';at=(50.4+min(u,8))if kind=='A'else(61.9+min(u,5))
  if u<4.5:
   shot=Image.open(R/'docs/screenshots/theme'/('hackathon-dark.png'if kind=='A'else'community-dark.png')).convert('RGB')
   # Genuine recorded reference page, cropped to policy and controls.
   picture=shot.crop((20,210,1420,824)).resize((1140,500),Image.Resampling.BICUBIC)
   fadepaste(im,picture,(80,265))
   text(im,'RECORDED REFERENCE INTERFACE · LOCAL SANDBOX',(90,758),19,PALE)
  else:
   footage(im,at,(80,265,1140,500),1.16+.03*ease(u/s['duration']),focus=(.65,.66))
   text(im,'HOSTED LOCAL CREDENTIAL CHECK · NOT A BROWSER ZK PROOF',(90,758),19,PALE)
  if kind=='B' and u<4.5:
   text(im,'CONCEPTUAL CREDENTIAL REUSE',(1260,288),22,PALE)
   roundbox(im,(1280,480,1825,580),'#26354F',18)
   roundbox(im,(1280,655,1825,755),'#26354F',18)
   text(im,'Hackathon · approved training',(1305,515),27)
   text(im,'Community · professional level 2',(1305,690),25)
   p=ease(u/4.5);cy=345+230*p
   roundbox(im,(1320,cy,1790,cy+94),BLUE,18)
   text(im,'One signed qualification',(1340,cy+30),28)
   text(im,'Separate policies. Separate challenges.',(1270,805),20,MUTED)
  evidence_panel(im,kind,u-(11.8 if kind=='A'else 4.5))
  ref=E['authorizationTransactions'][0 if kind=='A'else 1];reference(im,'CONFIRMED PREPROD · POLICY '+kind,ref,790,3086593 if kind=='A'else 3086617)
 elif id=='preprod':
  if u<9:
   if u<4.5:
    code(im,'integrations/issuance/authorization.compact',compact[49:63],(80,240,1760,400))
   else:
    deployment=json.loads((R/'docs/evidence/preprod-terminal.json').read_text())['deployment']
    code(im,'Actual confirmed deployment · docs/evidence/preprod-terminal.json',[
     'V3 deployment confirmed · Midnight Preprod · block 3085824',
     deployment['transactionReference'],
     'Confirmed at: '+deployment['confirmedAt'],
     'Deployed contract:',deployment['contractAddress']],(80,240,1760,400))
   reference(im,'DEPLOYED V3 CONTRACT',E['contractAddress'],775,3085824)
  else:
   for j,ref in enumerate(E['authorizationTransactions']):
    reference(im,'CONFIRMED · '+('HACKATHON'if j==0 else'COMMUNITY'),ref,270+j*155,3086593 if j==0 else 3086617)
   text(im,'Recorded results · terminal operator · independently checked',(105,645),27,PALE)
  flow(im,max(0,u-1),['COMPACT CONTRACT','ZK PROOF','MIDNIGHT PREPROD','AUTHORIZATION'],y=670 if u<9 else 735)
 elif id=='security':
  if u<7:
   code(im,'Recorded acceptance · actual security results',[ '"durableReplayRejected": true,','"revokedCredentialRejectedByCircuit": true,','"encryptedHolderRecovery": true'],(80,245,1150,510))
   chip(im,'REPLAY REJECTED',(1290,400),'#704351',27)
   text(im,'Consumed challenge remains used in Neon',(1290,495),28,width=480)
  else:
   footage(im,86.8+min(u-7,5.5),(80,245,1150,520),1.15,focus=(.62,.65))
   chip(im,'CREDENTIAL REVOKED',(1270,310),'#704351',25)
   text(im,'Fresh authorization rejected',(1290,430),38,width=450)
   text(im,'Active-membership constraint fails before submission.',(1290,550),27,MUTED,width=460)
   text(im,'Hosted local rejection shown; separate network test recorded below.',(100,758),20,PALE)
  reference(im,'CONFIRMED STATUS PUBLICATION',E['revocationTransaction'],790,3086630)
 elif id=='closing':
  if u<15:
   if u<5:code(im,'V3 Compact · private qualification and ownership',compact[50:61],(80,245,1150,590));term='PRIVATE BY DESIGN'
   elif u<10:code(im,'integrations/issuance/src/verifier.ts',verifier[28:42],(80,245,1150,590));term='BUILT FOR DEVELOPERS'
   else:
    footage(im,3.7+u-10,(80,245,1150,590),1.05);term='VERIFIABLE ON MIDNIGHT'
   text(im,term,(1280,330),42,PALE,width=480)
   text(im,'91 root tests\n39 signed-module tests',(1280,540),32,width=480)
   text(im,'Documented recorded results',(1280,695),22,MUTED,width=480)
  elif u<26:
   text(im,'Verified Preprod prototype.',(110,290),55)
   text(im,'Next before production',(110,405),29,PALE)
   for j,label in enumerate(['Public-browser proofs + installed-wallet acceptance','Institutional onboarding + independent review','External issuer and application pilot']):
    y=480+j*95;ImageDraw.Draw(im).line((110,y+18,140,y+18),fill=BLUE,width=5);text(im,label,(170,y),32)
   text(im,'No claim of production readiness or complete unlinkability.',(110,825),25,MUTED)
  else:
   im.paste(IVORY,(0,0,1920,1080));text(im,'V / veilpass.',(440,270),112,INK)
   text(im,'Prove what qualifies you.',(440,450),47,INK);text(im,'Reveal nothing else.',(440,515),47,BLUE)
   text(im,'useveilpass.vercel.app',(440,665),35,INK)
   text(im,'github.com/Psalmuel01/veilpass',(440,735),26,'#65708A')
 return im

# Sentence/phrase-aware captions use the actual generated audio's phrase timing.
def sec(v):h,m,s=v.replace(',','.').split(':');return int(h)*3600+int(m)*60+float(s)
CAPTIONS=[]
for s in SCENES:
 for b in re.split(r'\n\s*\n',(W/'audio'/(s['id']+'.srt')).read_text().strip()):
  a=b.splitlines()
  if len(a)>2:
   begin,end=a[1].split(' --> ');CAPTIONS.append((s['start']+sec(begin),s['start']+min(sec(end),s['duration']), ' '.join(a[2:])))
for i in range(len(CAPTIONS)-1):CAPTIONS[i]=(CAPTIONS[i][0],min(CAPTIONS[i][1],CAPTIONS[i+1][0]),CAPTIONS[i][2])
def caption(im,t):
 for a,b,line in CAPTIONS:
  if a<=t<b:
   lines=words(ImageDraw.Draw(im),line,1530,37)
   if len(lines)>2:raise RuntimeError('Caption too long')
   h=30+len(lines)*49;top=1040-h;l=Image.new('RGBA',(1660,h),(0,0,0,0));roundbox(l,(0,0,1659,h-1),'#0C1220',15)
   d=ImageDraw.Draw(l)
   for j,row in enumerate(lines):
    x=(1660-d.textlength(row,font=font(37)))/2
    for token in row.split(' '):
     text(l,token+' ',(x,12+j*49),37,PALE if token.strip('.,').lower() in ['midnight','eligibility','revoked','encrypted'] else IVORY);x+=d.textlength(token+' ',font=font(37))
   alpha=min(ease((t-a)/.12),ease((b-t)/.12));fadepaste(im,l,(130,top),alpha);break
 return im

def render():
 args=argparse.ArgumentParser();args.add_argument('--preview',action='store_true');args.add_argument('--scene');args=args.parse_args()
 if args.preview:
  for s in SCENES:
   for u in [1,min(7,s['duration']-1),s['duration']-2]:
    im=caption(scene_picture(s,u),s['start']+u);im.save(W/f"preview-{s['id']}-{u}.jpg")
  return
 for s in SCENES:
  if args.scene and s['id']!=args.scene:continue
  clean=W/(s['id']+'-clean.mp4');burn=W/(s['id']+'-burn.mp4')
  procs=[]
  for out in [clean,burn]:
   procs.append(subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080','-r','30','-i','-','-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-threads','3',str(out)],stdin=subprocess.PIPE))
  previous=SCENES[SCENES.index(s)-1] if SCENES.index(s)>0 else None
  previous_picture=scene_picture(previous,previous['duration']-.01) if previous else None
  for frame in range(s['duration']*FPS):
   u=frame/FPS;im=scene_picture(s,u)
   # Ease into each new composition with a short, directional parallax reveal.
   if u<.36 and s['start']:
    p=ease(u/.36);base=previous_picture.copy();shift=round(20*(1-p));fadepaste(base,im,(shift,0),p);im=base
   procs[0].stdin.write(im.tobytes());procs[1].stdin.write(caption(im.copy(),s['start']+u).tobytes())
  for p in procs:p.stdin.close();assert p.wait()==0
  print('Rendered motion scene',s['id'],flush=True)
if __name__=='__main__':render()
