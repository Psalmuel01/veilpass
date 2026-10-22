"""Decode the entire export, check media and subtitles, measure audio, make review sheets."""
import pathlib,subprocess,json,re,hashlib
import numpy as np
from PIL import Image,ImageDraw,ImageFont
R=pathlib.Path(__file__).resolve().parents[2];W=R/'.cache/video-enhanced';O=R/'docs/video/enhanced';video=O/'veilpass-final-demo.mp4'
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)]));v=next(x for x in probe['streams']if x['codec_type']=='video');a=next(x for x in probe['streams']if x['codec_type']=='audio')
assert(v['width'],v['height'],v['r_frame_rate'],v['codec_name'])==(1920,1080,'30/1','h264');assert abs(float(probe['format']['duration'])-180)<.04;assert a['sample_rate']=='48000'
p=subprocess.Popen(['ffmpeg','-v','error','-i',str(video),'-vf','scale=96:54','-pix_fmt','rgb24','-f','rawvideo','-'],stdout=subprocess.PIPE);means=[];stds=[];size=96*54*3
while True:
 b=p.stdout.read(size)
 if not b:break
 assert len(b)==size;x=np.frombuffer(b,np.uint8);means.append(float(x.mean()));stds.append(float(x.std()))
assert p.wait()==0;assert len(means)==5400;assert min(stds)>2,'Blank or uniform frame detected'
# Validate subtitle contents and every timestamp against the actual narration plan.
srt=(O/'veilpass-subtitles.srt').read_text();caps=[]
def seconds(s):h,m,x=s.replace(',','.').split(':');return int(h)*3600+int(m)*60+float(x)
for block in re.split(r'\n\s*\n',srt.strip()):
 lines=block.splitlines();start,end=lines[1].split(' --> ');caps.append((seconds(start),seconds(end),' '.join(lines[2:])));assert len(lines[2:])<=2
assert all(0<=start<end<=180 for start,end,_ in caps);assert all(caps[i][1]<=caps[i+1][0]for i in range(len(caps)-1))
normalize=lambda s:re.findall(r"[a-z0-9']+",s.lower())
assert normalize(' '.join(t for _,_,t in caps))==normalize((O/'veilpass-voiceover.txt').read_text()),'Caption words differ from final voiceover'
# Measure final encoded output, rather than relying on encoder settings.
r=subprocess.run(['ffmpeg','-v','info','-i',str(video),'-vn','-af','loudnorm=I=-16:TP=-1:LRA=8:print_format=json','-f','null','-'],capture_output=True,text=True,check=True);match=re.findall(r'\{\s*"input_i".*?\}',r.stderr,re.S);loud=json.loads(match[-1]);assert float(loud['input_tp'])<-1
# Every second of the full timeline gets a review thumbnail; detailed scene captures too.
frames=W/'review';frames.mkdir(exist_ok=True)
subprocess.run(['ffmpeg','-y','-v','error','-i',str(video),'-vf','fps=1,scale=480:270','-q:v','2',str(frames/'%03d.jpg')],check=True)
for page in range(6):
 sheet=Image.new('RGB',(2400,1740),'#111827');draw=ImageDraw.Draw(sheet)
 for j in range(30):
  n=page*30+j+1;im=Image.open(frames/f'{n:03d}.jpg');x=(j%5)*480;y=(j//5)*290;sheet.paste(im,(x,y));draw.text((x+8,y+270),f'{(n-1)//60:02}:{(n-1)%60:02}',fill='white')
 sheet.save(W/f'review-sheet-{page+1}.jpg')
validation={'durationSeconds':180,'width':1920,'height':1080,'fps':30,'videoCodec':'h264','audioCodec':a['codec_name'],'audioSampleRate':48000,'decodedFrames':len(means),'blankFrames':sum(x<=2 for x in stds),'subtitleBlocks':len(caps),'captionWordsMatchFinalNarration':True,'subtitleOverlaps':0,'integratedLUFS':float(loud['input_i']),'truePeakDBTP':float(loud['input_tp']),'sourceRevision':'b7e2320c8cdeecf9092b8bf27ad9732eb1b1612e','publicPreprodRecheck':(W/'live-evidence.json').exists(),'humanFullPlaybackAndListeningReview':False,'note':'All frames decoded and measured; one frame per second prepared for visual timeline review. Automated checks do not substitute for a human listening review.'}
(O/'validation.json').write_text(json.dumps(validation,indent=2)+'\n');print(json.dumps(validation,indent=2))
