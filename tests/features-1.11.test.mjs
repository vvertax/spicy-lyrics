import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function bundle(contents){const {outputFiles}=await build({stdin:{contents,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);}
const {SettingsHistory,historyKeyAllowed}=await bundle('export * from "./src/utils/SettingsHistory.ts"');
const {NextLyricsCache,nextQueueTrack}=await bundle('export * from "./src/utils/Lyrics/PrefetchedLyrics.ts"');
const {redactDiagnostic,recordDiagnostic,diagnosticErrors}=await bundle('export * from "./src/utils/DiagnosticLog.ts"');
function setting(history,key,value){const store={get:()=>value,set:next=>{const old=value;value=next;history.capture(key,old,next);}};history.register(key,store);return store;}
test('history groups a slider gesture, undoes and redoes a whole multi-setting edit',()=>{
 const h=new SettingsHistory(),a=setting(h,'size',10),b=setting(h,'background',false);h.start();a.set(11);a.set(12);b.set(true);
 assert.equal(h.entries.length,1);assert.equal(h.entries[0].changes.length,2);h.undo();assert.equal(a.get(),10);assert.equal(b.get(),false);assert.equal(h.entries.length,1);h.redo();assert.equal(a.get(),12);assert.equal(b.get(),true);
});
test('history handles undefined experiment defaults, preview restores values without creating changes',()=>{
 const h=new SettingsHistory(),s=setting(h,'experiment:test',undefined);h.start();s.set(true);const e=h.entries[0];h.preview(e);assert.equal(s.get(),undefined);assert.equal(h.previewing,true);h.endPreview();assert.equal(s.get(),true);assert.equal(h.entries.length,1);h.undo();assert.equal(s.get(),undefined);h.redo();assert.equal(s.get(),true);
});
test('history drops abandoned redo, cancels previews before undo and caps session memory',()=>{
 const h=new SettingsHistory(),s=setting(h,'size',0);h.start();for(let i=1;i<=45;i++){const old=s.get();h.applying=true;s.set(i);h.applying=false;h.capture('size',old,i,i*1000);}assert.equal(h.entries.length,40);h.preview(h.entries.at(-1));h.undo();assert.equal(s.get(),44);h.endPreview();assert.equal(s.get(),44);s.set(77);assert.equal(h.cursor,h.entries.length);assert.equal(h.entries.at(-1).changes[0].after,77);
});
test('runtime data and credentials never enter settings history',()=>{
 for(const key of ['musixmatchToken','secret','currentLyricsData','settingsMenuLocation','buildChannel','songPlaybackOffsets'])assert.equal(historyKeyAllowed(key),false,key);
 const h=new SettingsHistory();setting(h,'musixmatchToken','old');h.start();h.capture('musixmatchToken','old','new');assert.equal(h.entries.length,0);
});
test('next-track parsing supports queue metadata and skips unsupported or incomplete tracks',()=>{
 const raw={uri:'spotify:track:abc',metadata:{title:'Song',artist_name:'Artist',album_title:'Album',duration:'200000'}};
 assert.equal(nextQueueTrack({nextTracks:[{contextTrack:raw}]}).durationMs,200000);
 assert.equal(nextQueueTrack({queued:[{track:raw}],nextUp:[{uri:'bad'}]}).title,'Song');
 assert.equal(nextQueueTrack({nextTracks:[{uri:'spotify:episode:abc'}]}),null);assert.equal(nextQueueTrack({nextTracks:[{uri:'spotify:track:abc'}]}),null);
});
const track=id=>({uri:`spotify:track:${id}`,id,title:id,artist:'A',album:'',durationMs:1000});
test('prefetch deduplicates queue events and shares the pending request with current playback',async()=>{
 const c=new NextLyricsCache();let calls=0,finish;const load=()=>{calls++;return new Promise(resolve=>finish=resolve);};c.plan(track('a'),'sig',load);c.plan(track('a'),'sig',load);await Promise.resolve();assert.equal(calls,1);
 const playback=c.take('spotify:track:a','sig');finish({status:200,lyrics:{Type:'Line'}});assert.equal((await playback).lyrics.Type,'Line');assert.equal(await c.take('spotify:track:a','other'),null);
});
test('reorder, source changes and hidden-window cancellation discard late prefetch results',async()=>{
 const c=new NextLyricsCache();let finish;const load=()=>new Promise(resolve=>finish=resolve);
 c.plan(track('a'),'sig',load);await Promise.resolve();const old=c.slot,waiting=c.take(old.uri,'sig');c.plan(track('b'),'sig',async()=>({status:200,lyrics:{Type:'Syllable'}}));assert.equal(old.controller.signal.aborted,true);finish({status:200,lyrics:{stale:true}});assert.equal(await waiting,null);assert.equal((await c.take('spotify:track:b','sig')).lyrics.Type,'Syllable');
 const b=c.slot;c.plan(track('b'),'new',async()=>null);assert.equal(b.controller.signal.aborted,true);c.cancel();assert.equal(c.slot,null);
});
test('failed or queued preloads never become empty lyrics or trigger repeated requests',async()=>{
 const c=new NextLyricsCache();let calls=0;const load=async()=>{calls++;return {status:503,lyrics:null}};c.plan(track('a'),'s',load);assert.equal(await c.take('spotify:track:a','s'),null);c.plan(track('a'),'s',load);assert.equal(calls,1);
});
test('diagnostic errors are bounded, copied defensively and redact secrets and identities',()=>{
 const message='Bearer abc.secret token=hello https://example.org/test?token=hidden spotify:track:123 test@example.org';const safe=redactDiagnostic(message);
 for(const secret of ['abc.secret','hello','hidden','test@example.org','spotify:track:123'])assert.equal(safe.includes(secret),false);
 for(let i=0;i<40;i++)recordDiagnostic('pipeline',[`Error ${i}`,new Error('password=private'),{lyrics:'must not appear'}]);const log=diagnosticErrors();assert.equal(log.length,30);assert.equal(JSON.stringify(log).includes('must not appear'),false);assert.equal(JSON.stringify(log).includes('private'),false);log[0].scope='mutated';assert.notEqual(diagnosticErrors()[0].scope,'mutated');
});
test('real persisted settings do not write preview values to disk, and undo is persisted',async()=>{
 const saved=new Map();globalThis.window={};globalThis.Spicetify={LocalStorage:{get:k=>saved.get(k)??null,set:(k,v)=>saved.set(k,v)}};
 const real=await bundle('export * from "./src/utils/stores.ts";export {settingsHistory} from "./src/utils/SettingsHistory.ts";');
 const h=real.settingsHistory;h.start();real.$animationFpsCap.set(90);const disk=saved.get('SL:settings');h.preview(h.entries[0]);assert.equal(real.$animationFpsCap.get(),60);assert.equal(saved.get('SL:settings'),disk);h.endPreview();assert.equal(real.$animationFpsCap.get(),90);assert.equal(saved.get('SL:settings'),disk);h.undo();assert.equal(JSON.parse(saved.get('SL:settings')).animationFpsCap,60);
 real.$staticBackgroundMode.set('coverArt');real.$staticBackgroundBlur.set(8);const backgroundDisk=saved.get('SL:settings');h.preview(h.entries.at(-1));assert.equal(real.$staticBackgroundMode.get(),'default');assert.equal(real.$staticBackgroundBlur.get(),0);assert.equal(saved.get('SL:settings'),backgroundDisk);h.endPreview();assert.equal(real.$staticBackgroundMode.get(),'coverArt');assert.equal(real.$staticBackgroundBlur.get(),8);assert.equal(saved.get('SL:settings'),backgroundDisk);
});
