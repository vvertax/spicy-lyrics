import {fixture} from '../fixtures.ts';
import {track,uri} from '../environment.ts';
import {LocalLyricsManager} from '../../utils/Lyrics/manager/index.ts';
import {ProcessLyrics} from '../../utils/Lyrics/ProcessLyrics.ts';
import {$currentLyricsData,$currentLyricsType,$currentlyFetching} from '../../utils/stores.ts';
import {nextLyricsCache} from '../../utils/Lyrics/PrefetchedLyrics.ts';
export const SessionTTMLStore=new Map<string,any>();const cache=new Map<string,any>();
export const LyricsStore={GetItem:async(key:string)=>cache.get(key),SetItem:async(key:string,value:any)=>cache.set(key,value),RemoveItem:async(key:string)=>cache.delete(key),Destroy:async()=>cache.clear()};
export const getSongKey=(u:string)=>u?.split(':')[2]??'';
export const getActiveLyricsSourceOrder=()=>['spicy'] as any;
export const getLyricsSourceCacheSignature=()=> 'demo-v1';
export const GetLastLyricsFailure=()=>null;export const ShowQueueLoader=()=>{};export const LYRICS_QUEUE_MESSAGE='Demo';export const ClearLyricsPageContainer=()=>{};
export default async function fetchLyrics(u:string){if(u!==uri())return null;$currentlyFetching.set(true);const prefetched=await nextLyricsCache.take(u,'demo-v1');const data=structuredClone(SessionTTMLStore.get(getSongKey(u))??await LocalLyricsManager.get(u,track().duration).then(lyrics=>lyrics?{...lyrics,id:getSongKey(u),uri:u,fromLocal:true}:null)??prefetched?.lyrics??fixture(getSongKey(u)));await ProcessLyrics(data);if(u!==uri()){$currentlyFetching.set(false);return null;}$currentLyricsData.set(JSON.stringify(data));$currentLyricsType.set(data.Type);$currentlyFetching.set(false);return [data,200] as [any,number];}

export const GetLyricsAnsweredFrom = () => "Demo";
export const HoldsTemporaryUpload = () => false;
