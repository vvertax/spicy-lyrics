import{test}from'node:test';import assert from'node:assert/strict';import{build}from'esbuild';
test('real prefetch scheduler pauses while hidden/offline, coalesces queue events and hands pending work to playback',async()=>{
 const timers=new Map(),events=new Map();let id=0;
 const state={visible:true,uri:'spotify:track:current',queue:null,signature:'s1',calls:[],setTimeout:fn=>{timers.set(++id,fn);return id},clearTimeout:key=>timers.delete(key)};
 globalThis.__prefetchTest=state;globalThis.window={addEventListener:(name,fn)=>events.set(name,fn)};Object.defineProperty(globalThis.navigator,'onLine',{value:true,writable:true,configurable:true});
 const handlers=new Map();globalThis.Spicetify={Player:{addEventListener:(name,fn)=>handlers.set(name,fn)},Platform:{PlayerAPI:{getQueue:async()=>state.queue,_events:{addListener:(name,fn)=>handlers.set(name,fn)}}}};
 const stub={
 'stores.ts':'import{atom}from"nanostores";export const $prefetchNextLyrics=atom(true),$currentlyFetching=atom(false),$lyricsSourceOrder=atom(""),$disabledLyricsSources=atom([]),$ignoreMusixmatchWordSync=atom(false),$prioritizeAppleMusicQuality=atom(true);globalThis.__prefetchTest.stores={$prefetchNextLyrics,$currentlyFetching};',
 'WindowActivity.ts':'export const hasVisibleLyricsWindow=()=>globalThis.__prefetchTest.visible;export const observeLyricsVisibility=fn=>globalThis.__prefetchTest.visibility=fn;',
 'fetchLyrics.ts':'export const getActiveLyricsSourceOrder=()=>["spicy"],getLyricsSourceCacheSignature=()=>globalThis.__prefetchTest.signature,LyricsStore={GetItem:async()=>null},SessionTTMLStore=new Map();',
 'ExternalSources.ts':'export const fetchLyricsFromProviders=(uri,order,options)=>new Promise(resolve=>globalThis.__prefetchTest.calls.push({uri,order,options,resolve}));',
 'index.ts':'export const LocalLyricsManager={get:async()=>null};',
 'SpotifyPlayer.ts':'export const SpotifyPlayer={GetUri:()=>globalThis.__prefetchTest.uri};',
 };
 const{outputFiles}=await build({stdin:{contents:'export * from "./src/utils/Lyrics/PrefetchNextLyrics.ts";export {nextLyricsCache} from "./src/utils/Lyrics/PrefetchedLyrics.ts";',resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',define:{setTimeout:'globalThis.__prefetchTest.setTimeout',clearTimeout:'globalThis.__prefetchTest.clearTimeout'},plugins:[{name:'scheduler-fixture',setup(b){b.onResolve({filter:/\.(ts|tsx)$/},a=>{const name=a.path.split('/').at(-1);if(stub[name])return{path:name,namespace:'fixture'}});b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stub[a.path],resolveDir:process.cwd()}));}}]});
 const mod=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
 const next=id=>({uri:`spotify:track:${id}`,name:id,artists:[{name:'Artist'}],duration:{milliseconds:200000}});
 const flush=async()=>{for(const [key,fn]of [...timers]){timers.delete(key);fn()}for(let i=0;i<20;i++)await Promise.resolve();};
 state.queue={nextUp:[next('a')]};mod.initNextLyricsPrefetch();mod.initNextLyricsPrefetch();handlers.get('queue_update')();handlers.get('queue_update')();assert.equal(timers.size,1);await flush();assert.equal(state.calls.length,1);
 handlers.get('queue_update')();await flush();assert.equal(state.calls.length,1,'identical queue shares a request');
 state.visible=false;state.visibility();assert.equal(state.calls[0].options.signal.aborted,true);assert.equal(timers.size,0);state.calls[0].resolve({status:200,lyrics:{stale:true}});await flush();assert.equal(mod.nextLyricsCache.slot,null);
 state.visible=true;state.visibility();await flush();assert.equal(state.calls.length,2);
 state.uri='spotify:track:a';state.stores.$currentlyFetching.set(true);handlers.get('songchange')();assert.equal(state.calls[1].options.signal.aborted,false,'playback adopts the pending request');
 const pending=mod.nextLyricsCache.take(state.uri,'s1');state.calls[1].resolve({status:200,lyrics:{Type:'Line',Content:[]}});assert.equal((await pending).lyrics.Type,'Line');
 state.queue={nextUp:[next('b')]};state.stores.$currentlyFetching.set(false);await flush();assert.equal(state.calls.length,3);assert.equal(state.calls[2].uri,'spotify:track:b');
 state.stores.$prefetchNextLyrics.set(false);assert.equal(state.calls[2].options.signal.aborted,true);assert.equal(timers.size,0);state.calls[2].resolve(null);
 navigator.onLine=false;state.stores.$prefetchNextLyrics.set(true);assert.equal(timers.size,0);navigator.onLine=true;events.get('online')();await flush();assert.equal(state.calls.length,4);
 state.queue={nextUp:[next('c')]};handlers.get('queue_update')();await flush();assert.equal(state.calls[3].options.signal.aborted,true);assert.equal(state.calls[4].uri,'spotify:track:c');
 state.visible=false;state.visibility();state.calls[3].resolve(null);state.calls[4].resolve(null);assert.equal(timers.size,0);
});
