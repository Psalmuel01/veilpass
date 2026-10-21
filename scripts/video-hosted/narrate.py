import json,pathlib,subprocess,time
ROOT=pathlib.Path(__file__).resolve().parents[2]
WORK=ROOT/'.cache/video-hosted';WORK.mkdir(parents=True,exist_ok=True)
scenes=json.loads((ROOT/'scripts/video-hosted/story.json').read_text())
tts=ROOT/'.cache/video-voice-venv/bin/edge-tts'
for i,scene in enumerate(scenes):
 source=WORK/(scene['id']+'.txt');source.write_text(scene['text'])
 output=WORK/(scene['id']+'.mp3')
 for attempt in range(3):
  result=subprocess.run([str(tts),'--voice','en-US-AvaNeural','--rate=-2%','--file',str(source),'--write-media',str(output),'--write-subtitles',str(WORK/(scene['id']+'.srt'))],capture_output=True,timeout=100)
  if result.returncode==0:break
  if attempt==2:raise RuntimeError('Speech generation failed for '+scene['id'])
  time.sleep(2)
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(output)]))
 scene['audio']=str(output);scene['duration']=duration+1.1
 print(f'{i+1}/{len(scenes)} {scene["id"]}: {duration:.1f}s',flush=True)
(WORK/'plan.json').write_text(json.dumps({'voice':'en-US-AvaNeural','rate':'-2%','scenes':scenes},indent=2))
