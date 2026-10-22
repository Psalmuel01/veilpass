import json,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2];WORK=ROOT/'.cache/video-final/audio';WORK.mkdir(parents=True,exist_ok=True)
scenes=json.loads((ROOT/'scripts/video-final/story.json').read_text());tts=ROOT/'.cache/video-voice-venv/bin/edge-tts'
for scene in scenes:
 source=WORK/(scene['id']+'.txt');changed=not source.exists() or source.read_text()!=scene['text'];source.write_text(scene['text']);audio=WORK/(scene['id']+'.mp3');srt=WORK/(scene['id']+'.srt')
 if not audio.exists() or changed:
  result=subprocess.run([str(tts),'--voice','en-US-AvaNeural','--rate=-4%','--file',str(source),'--write-media',str(audio),'--write-subtitles',str(srt)],capture_output=True,timeout=60)
  if result.returncode:raise RuntimeError('Natural American narration generation failed for '+scene['id'])
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(audio)]))
 scene['audioSeconds']=duration;print(scene['id'],round(duration,2),'seconds; target',scene['duration'],flush=True)
(WORK/'plan.json').write_text(json.dumps({'voice':'en-US-AvaNeural','rate':'-4%','scenes':scenes},indent=2))
