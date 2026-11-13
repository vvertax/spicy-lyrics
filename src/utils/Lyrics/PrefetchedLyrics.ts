import type { TrackLyricsInfo,ExternalLyricsResult } from "./Sources/Types.ts";
export function nextQueueTrack(queue:any):TrackLyricsInfo|null {
  const entry=(queue?.queued?.length?queue.queued:queue?.nextUp??queue?.nextTracks??[])[0];
  const track=entry?.contextTrack??entry?.track??entry;
  const uri=track?.uri??track?.contextTrack?.uri;if(typeof uri!=='string'||!/^spotify:track:[A-Za-z0-9]+$/.test(uri))return null;
  const m=track.metadata??{},title=track.name??m.title??'',artist=track.artists?.map((a:any)=>a.name).filter(Boolean).join(', ')??m.artist_name??m.artist??'',album=track.album?.name??m.album_title??'';
  const durationMs=Number(track.duration?.milliseconds??track.duration_ms??m.duration??m.duration_ms??0);
  if(!title||!artist||!Number.isFinite(durationMs)||durationMs<=0)return null;
  return {uri,id:uri.split(':')[2],title,artist,album,durationMs};
}
export class NextLyricsCache {
  slot:{uri:string;signature:string;controller:AbortController;promise:Promise<ExternalLyricsResult|null>}|null=null;
  cancel(){this.slot?.controller.abort();this.slot=null;}
  plan(track:TrackLyricsInfo|null,signature:string,load:(track:TrackLyricsInfo,signal:AbortSignal)=>Promise<ExternalLyricsResult|null>){
    if(this.slot?.uri===track?.uri&&this.slot?.signature===signature)return;
    this.cancel();if(!track)return;const controller=new AbortController();
    const promise=Promise.resolve().then(()=>{if(controller.signal.aborted)return null;return load(track,controller.signal);}).then(value=>!controller.signal.aborted&&value?.status===200&&value.lyrics?value:null).catch(()=>null);
    this.slot={uri:track.uri,signature,controller,promise};
  }
  async take(uri:string,signature:string){const slot=this.slot;if(!slot||slot.uri!==uri||slot.signature!==signature)return null;const value=await slot.promise;return slot.controller.signal.aborted||!value?null:structuredClone(value);}
}
export const nextLyricsCache=new NextLyricsCache();
