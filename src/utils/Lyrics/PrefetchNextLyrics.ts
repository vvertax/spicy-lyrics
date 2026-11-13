import { $prefetchNextLyrics,$currentlyFetching,$lyricsSourceOrder,$disabledLyricsSources,$ignoreMusixmatchWordSync,$prioritizeAppleMusicQuality } from "../stores.ts";
import { hasVisibleLyricsWindow,observeLyricsVisibility } from "../WindowActivity.ts";
import { nextLyricsCache,nextQueueTrack } from "./PrefetchedLyrics.ts";
import { getActiveLyricsSourceOrder,getLyricsSourceCacheSignature,LyricsStore,SessionTTMLStore } from "./fetchLyrics.ts";
import { fetchLyricsFromProviders } from "./ExternalSources.ts";
import { LocalLyricsManager } from "./manager/index.ts";
import { SpotifyPlayer } from "../../components/Global/SpotifyPlayer.ts";
let initialized=false;
export function initNextLyricsPrefetch(){
  if(initialized)return;initialized=true;
  let timer:ReturnType<typeof setTimeout>|undefined,generation=0;
  const schedule=()=>{const revision=++generation;clearTimeout(timer);
    if(!$prefetchNextLyrics.get()||!hasVisibleLyricsWindow()||!navigator.onLine){nextLyricsCache.cancel();return;}
    if($currentlyFetching.get()){if(nextLyricsCache.slot?.uri!==SpotifyPlayer.GetUri()||nextLyricsCache.slot?.signature!==getLyricsSourceCacheSignature())nextLyricsCache.cancel();return;}
    timer=setTimeout(()=>{void (async()=>{
      const api=Spicetify.Platform?.PlayerAPI;
      const queue=(typeof api?.getQueue==='function'?await api.getQueue():null)??Spicetify.Queue;
      if(revision!==generation||$currentlyFetching.get()||!hasVisibleLyricsWindow()||!$prefetchNextLyrics.get())return;
      const next=nextQueueTrack(queue);if(!next||next.uri===SpotifyPlayer.GetUri()){nextLyricsCache.plan(null,'',async()=>null);return;}
      const signature=getLyricsSourceCacheSignature();
      nextLyricsCache.plan(next,signature,async(track,signal)=>{
        if(SessionTTMLStore.has(track.id)||await LocalLyricsManager.get(track.uri)||signal.aborted)return null;
        const cached=await LyricsStore?.GetItem(track.id);if(signal.aborted)return null;
        if(cached?.LyricsSourceCacheSignature===signature)return null;
        return fetchLyricsFromProviders(track.uri,getActiveLyricsSourceOrder(),{signal,trackInfo:track});
      });
    })().catch(()=>{});},1200);
  };
  // Queue events cover reorder/shuffle; no background polling or focus checks.
  const events=Spicetify.Platform?.PlayerAPI?._events;
  events?.addListener?.('queue_update',schedule);
  Spicetify.Player.addEventListener('songchange',schedule);
  for(const store of [$prefetchNextLyrics,$currentlyFetching,$lyricsSourceOrder,$disabledLyricsSources,$ignoreMusixmatchWordSync,$prioritizeAppleMusicQuality])store.listen(schedule);
  observeLyricsVisibility(schedule);window.addEventListener('online',schedule);window.addEventListener('offline',schedule);schedule();
}
