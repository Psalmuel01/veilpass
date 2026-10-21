"""Edit the explicitly requested scripted hosted-browser demonstration.
Never substitutes a fabricated Preprod transaction for the pending proof milestone.
"""
import json,math,pathlib,re,shutil,subprocess,textwrap,sys
from PIL import Image,ImageDraw,ImageFont
ROOT=pathlib.Path(__file__).resolve().parents[2];WORK=ROOT/'.cache/video-hosted';OUT=ROOT/'docs/video/hosted';OUT.mkdir(parents=True,exist_ok=True)
plan=json.loads((WORK/'plan.json').read_text());run=json.loads((WORK/'browser-evidence.json').read_text());recording=json.loads((WORK/'browser-scenes.json').read_text());marks={x['name']:x['seconds'] for x in recording['scenes']}
assert run['actualHostedBrowser'] and run['signedIssuance'] and run['revocationRejected'] and run['testCredentialLeftRevoked'] and not run['networkProof']
raw=WORK/'hosted-browser-raw.webm';assert raw.exists()
BG='#0c1220';PANEL='#151e30';LINE='#31415e';TEXT='#f2f5fc';MUTED='#a7b6d0';BLUE='#90a8ff';GREEN='#7fe0bf'
FONT=ROOT/'apps/web/app/fonts/SpaceGrotesk.ttf'
def font(size):return ImageFont.truetype(str(FONT),size)
def wrap(draw,text,size,width):
 result=[];line=''
 for word in text.split():
  candidate=(line+' '+word).strip()
  if draw.textlength(candidate,font=font(size))>width and line:result.append(line);line=word
  else:line=candidate
 if line:result.append(line)
 return result
def text(draw,words,x,y,size=30,color=TEXT,width=1700):
 for line in wrap(draw,words,size,width):draw.text((x,y),line,font=font(size),fill=color);y+=size+12
 return y
def panel(d,box):d.rounded_rectangle(box,20,fill=PANEL,outline=LINE,width=2)
def base(scene,index):
 video=scene['kind']=='video';im=Image.new('RGBA' if video else 'RGB',(1920,1080),(0,0,0,0) if video else BG);d=ImageDraw.Draw(im)
 if video:
  d.rectangle((0,0,1920,84),fill=BG);d.rectangle((0,984,1920,1080),fill=BG);d.rectangle((0,84,159,984),fill=BG);d.rectangle((1761,84,1920,984),fill=BG)
  d.rounded_rectangle((159,83,1761,985),4,outline=LINE,width=2)
  d.text((162,22),'veilpass.',font=font(30),fill=TEXT);d.text((500,29),scene['eyebrow'],font=font(20),fill=BLUE)
  d.text((1315,29),'SCRIPTED LIVE HOSTED DEMO',font=font(17),fill=MUTED)
 else:
  d.text((80,40),'veilpass.',font=font(39),fill=TEXT);d.text((1470,51),'HOSTED JUDGES’ DEMO',font=font(19),fill=MUTED)
  d.line((80,112,1840,112),fill=LINE,width=2);d.text((82,145),scene['eyebrow'],font=font(20),fill=BLUE);text(d,scene['title'],80,200,49)
  if scene['kind']=='architecture':
   boxes=[(80,385,600,755),(700,385,1220,755),(1320,385,1840,755)]
   for box,name,role,detail in zip(boxes,['VERCEL','RENDER','NEON'],['The website','The issuer backend','The database'],['What users open','Issues and revokes credentials','Keeps encrypted authority state']):
    panel(d,box);d.text((box[0]+32,box[1]+35),name,font=font(39),fill=BLUE);text(d,role,box[0]+32,box[1]+125,32,width=455);text(d,detail,box[0]+32,box[1]+215,26,MUTED,450)
   for x in [615,1235]:d.line((x,570,x+70,570),fill=BLUE,width=5);d.polygon([(x+70,570),(x+50,557),(x+50,583)],fill=BLUE)
   d.text((83,815),'ONE PUBLIC ADDRESS:  https://useveilpass.vercel.app',font=font(31),fill=GREEN)
  else:
   panel(d,(80,345,925,850));panel(d,(970,345,1840,850));d.text((115,385),'WORKING ON THE LIVE WEBSITE',font=font(25),fill=GREEN);d.text((1005,385),'NEXT: PUBLIC PREPROD PROOFS',font=font(25),fill=BLUE)
   for i,label in enumerate(['Holder-owned signing keys','Signed credential issuance','Encrypted vault and recovery','Two policy checks + revocation']):
    yy=466+i*84;d.line((116,yy+18,124,yy+27,139,yy+7),fill=GREEN,width=4);text(d,label,155,yy,29,width=730)
   for i,label in enumerate(['A prover with sufficient memory','Deploy the Midnight contract','Test with installed Lace','Complete external acceptance']):text(d,label,1005,466+i*84,29,width=790)
   d.text((83,892),'Current demo: live hosted credentials. Public Preprod proof deployment is pending.',font=font(25),fill=MUTED)
 return im

def parse_time(v):
 h,m,s=v.replace(',','.').split(':');return int(h)*3600+int(m)*60+float(s)
def stamp(s):
 ms=round(s*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
def runff(args):subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-filter_complex_threads','2']+list(map(str,args)),check=True)
clips=[];subtitles=[];chapters=[];cursor=0;editnotes=[]
for index,scene in enumerate(plan['scenes']):
 duration=math.ceil(scene['duration']*30)/30;baseim=base(scene,index);basefile=WORK/(scene['id']+'-frame.png');baseim.save(basefile)
 cues=[]
 for block in re.split(r'\n\s*\n',(WORK/(scene['id']+'.srt')).read_text(encoding='utf-8-sig').strip()):
  rows=block.splitlines()
  if len(rows)>=3:
   a,b=rows[1].split(' --> ');cues.append([parse_time(a),parse_time(b),' '.join(rows[2:])])
 for i in range(len(cues)-1):cues[i][1]=min(cues[i][1],cues[i+1][0])
 captionfiles=[]
 for ci,(a,b,words) in enumerate(cues):
  subtitles.append((cursor+a,cursor+min(b,duration),words));im=baseim.copy();d=ImageDraw.Draw(im);wrapped=wrap(d,words,28,1490);height=len(wrapped)*36+20;top=1071-height
  d.rounded_rectangle((160,top,1760,1073),9,fill='#080d15')
  for li,line in enumerate(wrapped):d.text(((1920-d.textlength(line,font=font(28)))/2,top+9+li*36),line,font=font(28),fill=TEXT)
  file=WORK/(scene['id']+f'-caption-{ci}.png');im.save(file);captionfiles.append((a,b,file))
 destination=WORK/(scene['id']+'-final.mp4');clips.append(destination)
 chapters.append({'title':scene['title'],'seconds':round(cursor,3)})
 if scene['kind']=='video':
  start=marks[scene['start']]+.15;end=marks[scene['end']]-.2 if scene.get('end') else recording['durationSeconds']-.3
  if scene['id']=='revocation':end=min(end,start+6)
  if scene['id']=='backup':end=min(recording['durationSeconds']-.1,marks['holder-restored']+3.0)
  end=max(start+.5,end);available=end-start;speed=min(1,duration/available)
  args=['-ss',start,'-t',available,'-i',raw,'-loop','1','-framerate','30','-i',basefile,'-i',scene['audio']]
  filters=[f'[0:v]setpts={speed}*(PTS-STARTPTS),fps=30,scale=1600:900:flags=lanczos,pad=1920:1080:160:84:color=0x0c1220,tpad=stop_mode=clone:stop_duration={duration},trim=duration={duration},setpts=PTS-STARTPTS[v]','[v][1:v]overlay=0:0[base]'];last='base'
  for i,(a,b,file) in enumerate(captionfiles):
   args+=['-loop','1','-framerate','30','-i',file];new=f'c{i}';filters.append(f"[{last}][{i+3}:v]overlay=0:0:enable='between(t,{a},{b})'[{new}]");last=new
  filters.append(f'[{last}]format=yuv420p[out]')
  args+=['-filter_complex',';'.join(filters),'-map','[out]','-map','2:a']
  editnotes.append({'scene':scene['id'],'sourceStart':start,'sourceEnd':end,'speed':round(1/speed,3),'heldToFitNarration':available<duration})
 else:
  entries=[];at=0
  def entry(file,length):
   if length>.001:entries.append("file '"+str(file)+"'\nduration "+str(length))
  for a,b,file in captionfiles:entry(basefile,max(0,a-at));entry(file,max(.01,b-a));at=b
  entry(basefile,max(.01,duration-at));entries.append("file '"+str(basefile)+"'")
  sequence=WORK/(scene['id']+'-frames.txt');sequence.write_text('\n'.join(entries)+'\n')
  args=['-f','concat','-safe','0','-i',sequence,'-i',scene['audio'],'-vf','fps=30','-map','0:v','-map','1:a']
 args+=['-t',duration,'-af','apad,loudnorm=I=-16:TP=-1.5:LRA=8','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-g','60','-c:a','aac','-b:a','192k','-ar','48000','-ac','2',destination]
 print(f'Rendering {index+1}/{len(plan["scenes"])} {scene["id"]}',flush=True)
 if not ('--reuse-video' in sys.argv and scene['kind']=='video' and destination.exists()):runff(args)
 cursor+=duration
concat=WORK/'final-concat.txt';concat.write_text('\n'.join("file '"+str(p)+"'" for p in clips)+'\n')
metadata=WORK/'final-chapters.ffmeta';parts=[';FFMETADATA1','title=VeilPass — Simple hosted demo','artist=VeilPass','comment=Actual scripted browser recording against the deployed Vercel/Render/Neon service. Synthetic demo holder, credential revoked after recording. Narration uses an American neural voice. Some waits edited and frames held. No public Preprod proof transaction claimed.']
for i,c in enumerate(chapters):
 end=chapters[i+1]['seconds'] if i+1<len(chapters) else cursor
 parts+=['[CHAPTER]','TIMEBASE=1/1000',f'START={round(c["seconds"]*1000)}',f'END={round(end*1000)}',f'title={c["title"]}']
metadata.write_text('\n'.join(parts)+'\n');output=OUT/'veilpass-hosted-demo-american.mp4'
runff(['-f','concat','-safe','0','-i',concat,'-i',metadata,'-map_metadata','1','-map_chapters','1','-c','copy','-movflags','+faststart',output])
(OUT/'veilpass-hosted-demo.srt').write_text('\n\n'.join(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{t}' for i,(a,b,t) in enumerate(subtitles))+'\n')
(OUT/'chapters.json').write_text(json.dumps(chapters,indent=2));(OUT/'narration.txt').write_text('\n\n'.join(s['title']+'\n'+s['text'] for s in plan['scenes']))
shutil.copyfile(WORK/'browser-evidence.json',OUT/'browser-evidence.json');shutil.copyfile(WORK/'readiness.json',OUT/'readiness.json')
(OUT/'production-notes.json').write_text(json.dumps({'durationSeconds':cursor,'voice':plan['voice'],'voiceRate':plan['rate'],'source':'actual isolated scripted browser capture against the live deployed website','operatorApprovalAndRevocation':'authenticated API outside the browser; no token filmed','humanCredentialsUsed':False,'networkProofClaimed':False,'edits':editnotes},indent=2))
runff(['-ss','3','-i',output,'-frames:v','1',OUT/'poster.png']);runff(['-ss','0','-t','12','-i',output,'-vn','-c:a','libmp3lame',OUT/'voice-preview.mp3'])
print(f'Finished: {output} ({cursor:.1f}s)',flush=True)
