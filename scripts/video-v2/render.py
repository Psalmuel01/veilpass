#!/usr/bin/env python3
"""Render the narrated film from real recordings and code-native title assets."""
import json, math, pathlib, shutil, subprocess, textwrap
ROOT=pathlib.Path(__file__).resolve().parents[2]
WORK=ROOT/'.cache/video-v2'; OUT=ROOT/'docs/video'; OUT.mkdir(parents=True,exist_ok=True)
def run(args): subprocess.run([str(a) for a in args],check=True,stdout=subprocess.DEVNULL,stderr=open(WORK/'render-current.log','w'))
def probe(file): return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(file)]))
plan=json.loads((WORK/'film-plan.json').read_text()); evidence=json.loads((ROOT/'docs/evidence/lifecycle-network.json').read_text())
assert evidence['browser']['twoPoliciesConfirmed'] and evidence['sdkRevocationRejected']
tracks={}
for kind in ['product','live']:
 data=json.loads((WORK/f'{kind}-scenes.json').read_text()); origin=next(x['seconds'] for x in data['scenes'] if x['name']=='video-origin')
 tracks[kind]={'marks':{x['name']:max(0,x['seconds']-origin) for x in data['scenes']},'path':WORK/f'{kind}-raw.webm'}
 tracks[kind]['duration']=float(probe(tracks[kind]['path'])['format']['duration'])
chapters=[]; cursor=0; srt=[]; subindex=1; render_scenes=[]
def timestamp(seconds):
 ms=round(seconds*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
for index,scene in enumerate(plan['scenes']):
 duration=math.ceil(scene['durationSeconds']*30)/30; scene['renderStart']=cursor;scene['renderDuration']=duration
 for c in scene['captions']:
  srt.append(f'{subindex}\n{timestamp(cursor+c["start"])} --> {timestamp(cursor+c["end"])}\n'+ '\n'.join(textwrap.wrap(c['text'],76))+'\n');subindex+=1
 chapters.append({'title':scene['title'].replace('\n',' '),'seconds':round(cursor,3),'mode':scene.get('mode','TITLE CARD')})
 destination=WORK/f'{index:02}-{scene["id"]}.mkv'; base=['ffmpeg','-hide_banner','-loglevel','error','-y','-filter_complex_threads','2']
 if scene['kind']=='card':
  args=base+['-loop','1','-framerate','30','-i',scene['frame'],'-i',scene['audio']]
  filters=[f'[0:v]fps=30,trim=duration={duration},setpts=PTS-STARTPTS,format=yuv420p[base]']; audio_index=1; next_input=2
 else:
  track=tracks[scene['kind']]; start=track['marks'][scene['start']]+.35
  end=track['marks'].get(scene['end'],track['duration']-.25) if scene.get('end') else track['duration']-.5
  end=max(start+.8,min(end-.25,track['duration']-.1))
  if scene['id']=='challenge':
   start=max(start,track['marks'][scene['end']]-1.8)
   end=track['marks'][scene['end']]+1.0
  if scene.get('proof'): end=min(track['duration']-.1,track['marks'][scene['end']]+1.7)
  stable={'live-ready':6,'verified':8.5,'second-result':8.5,'replay':4.8,'revoked-receipt':8.5}
  if scene['id'] in stable: end=min(end,start+stable[scene['id']])
  available=end-start
  if scene.get('proof'):
   cut=min(5.8,available/2); tail=max(start+cut,end-cut)
   shot=WORK/f'{scene["id"]}-shortened.mkv'
   run(['ffmpeg','-hide_banner','-loglevel','error','-y','-filter_complex_threads','2','-ss',start,'-t',cut,'-i',track['path'],'-ss',tail,'-t',end-tail,'-i',track['path'],'-filter_complex',f'[0:v]fps=30,setpts=PTS-STARTPTS[a];[1:v]fps=30,setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[out]','-map','[out]','-an','-c:v','libx264','-preset','fast','-crf','18',shot])
   source=shot;source_start=0;source_duration=cut+end-tail
   scene['recordedWaitSeconds']=round(track['marks'][scene['end']]-track['marks'][scene['start']],2)
  else: source=track['path'];source_start=start;source_duration=min(duration,available)
  args=base+['-f','lavfi','-i',f'color=c=0x080d15:s=1920x1080:r=30:d={duration}','-ss',str(source_start),'-t',str(source_duration),'-i',str(source),'-i',scene['audio'],'-loop','1','-framerate','30','-i',scene['frame']]
  filters=[f'[1:v]fps=30,scale=1600:900:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration={duration},trim=duration={duration},setpts=PTS-STARTPTS[screen]','[0:v][screen]overlay=160:84:shortest=1[ui]','[ui][3:v]overlay=0:0[base]'];audio_index=2;next_input=4
 last='base'
 for ci,c in enumerate(scene['captions']):
  args+=['-loop','1','-framerate','30','-i',c['image']];new=f'caption{ci}'
  filters.append(f'[{last}][{next_input}:v]overlay=0:0:enable=\'between(t,{c["start"]},{c["end"]+.1})\'[{new}]');last=new;next_input+=1
 if scene.get('proof'):
  note=WORK/(scene['id']+'-proof-note.png')
  args+=['-loop','1','-framerate','30','-i',str(note)];filters.append(f'[{last}][{next_input}:v]overlay=0:0[noted]');last='noted'
 if scene.get('transaction'):
  args+=['-loop','1','-framerate','30','-i',str(WORK/'revocation-tx.png')];filters.append(f'[{last}][{next_input}:v]overlay=0:0[transaction]');last='transaction'
 filters += [f'[{last}]format=yuv420p[out]',f'[{audio_index}:a]aresample=48000,apad,atrim=duration={duration},afade=t=in:d=0.08,afade=t=out:st={duration-.12}:d=0.12[audio]']
 args+=['-filter_complex',';'.join(filters),'-map','[out]','-map','[audio]','-t',str(duration),'-r','30','-c:v','libx264','-preset','fast','-crf','18','-profile:v','high','-level','4.1','-pix_fmt','yuv420p','-g','60','-c:a','pcm_s16le',str(destination)]
 print(f'Rendering {index+1}/{len(plan["scenes"])}: {scene["id"]} ({duration:.1f}s)',flush=True);run(args);render_scenes.append(destination);cursor+=duration
concat=WORK/'concat.txt';concat.write_text('\n'.join("file '"+str(p)+"'" for p in render_scenes)+'\n')
run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',concat,'-c','copy',WORK/'assembled.mkv'])
metadata=WORK/'chapters.ffmeta';parts=[';FFMETADATA1','title=VeilPass — Prove what qualifies you','artist=VeilPass','comment=Real local Midnight browser footage. Generated sandbox sections and shortened waits are labeled. Narration is synthesized.']
for i,c in enumerate(chapters):
 end=chapters[i+1]['seconds'] if i+1<len(chapters) else cursor
 title=c['title'].replace('=','\\=').replace(';','\\;').replace('#','\\#')
 parts+=['[CHAPTER]','TIMEBASE=1/1000',f'START={round(c["seconds"]*1000)}',f'END={round(end*1000)}',f'title={title}']
metadata.write_text('\n'.join(parts)+'\n')
output=OUT/'veilpass-v2-demo.mp4'
run(['ffmpeg','-hide_banner','-loglevel','info','-y','-i',WORK/'assembled.mkv','-i',WORK/'music.wav','-f','ffmetadata','-i',metadata,'-filter_complex',f'[0:a]highpass=f=70,asplit=2[voice][side];[1:a]volume=0.12,lowpass=f=5500,afade=t=in:d=2,afade=t=out:st={cursor-4}:d=4[music];[music][side]sidechaincompress=threshold=0.02:ratio=5:attack=20:release=250[duck];[voice][duck]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9[audio]','-map','0:v','-map','[audio]','-map_metadata','2','-map_chapters','2','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-t',str(cursor),'-movflags','+faststart',output])
(OUT/'veilpass-v2-demo.srt').write_text('\n'.join(srt));(OUT/'chapters.json').write_text(json.dumps(chapters,indent=2));(OUT/'narration.txt').write_text('\n\n'.join(scene['title'].replace('\n',' ')+ '\n'+ '\n'.join(scene['lines']) for scene in plan['scenes'])+'\n')
shutil.copy2(ROOT/'docs/evidence/lifecycle-network.json',OUT/'recording-evidence.json')
(WORK/'render-plan.json').write_text(json.dumps({'durationSeconds':cursor,'scenes':plan['scenes']},indent=2))
run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss','2','-i',output,'-frames:v','1',OUT/'poster.png'])
info=probe(output);(OUT/'media-info.json').write_text(json.dumps(info,indent=2));print(f'Finished: {output} ({cursor:.2f}s)',flush=True)
