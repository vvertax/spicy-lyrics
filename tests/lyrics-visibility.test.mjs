import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const doc=new EventTarget();doc.hidden=false;doc.querySelectorAll=()=>[];
const win=new EventTarget();win.document=doc;win.closed=false;globalThis.window=win;
const fixture={uri:'spotify:track:a',requests:0,processed:0,reads:0,presented:0,held:false,resolve:null};globalThis.__visibilityFixture=fixture;
const atom=()=>{let value=null;return{get:()=>value,set:v=>{value=v}}};
fixture.data=atom();fixture.type=atom();fixture.fetching=atom();
const stubs={
'ScenePresentation.ts':'export const beginSceneTrackChange=()=>{};',
'Defaults.ts':'export const isDev=false;export default {LyricsSourceOrder:[],DisabledLyricsSourceIds:[]};',
'stores.ts':'const f=globalThis.__visibilityFixture;export const $currentLyricsData=f.data,$currentLyricsType=f.type,$currentlyFetching=f.fetching;',
'SpotifyPlayer.ts':'const f=globalThis.__visibilityFixture;export const SpotifyPlayer={GetUri:()=>f.uri,IsDJ:()=>false,GetMediaType:()=>"audio",GetContentType:()=>"track"};',
'PageView.ts':'export const PageContainer=null;export default {AppendViewControls(){globalThis.__visibilityFixture.presented++}};',
'ProcessLyrics.ts':'export const ProcessLyrics=async()=>{globalThis.__visibilityFixture.processed++};',
'EmptyLines.ts':'export const IsEmptyLyrics=()=>false;',
'Logger.ts':'export default class Logger{debug(){} error(){} warn(){}}',
'index.ts':'export const LocalLyricsManager={get:async()=>{globalThis.__visibilityFixture.reads++;return null}};',
'Store.ts':'export const GetExpireStore=()=>null;',
'ExternalSources.ts':`export async function fetchLyricsFromProviders(uri,order,{signal}){const f=globalThis.__visibilityFixture;f.requests++;if(f.held)await new Promise((resolve,reject)=>{f.resolve=resolve;signal.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')),{once:true})});return {lyrics:{Type:'Line',Content:[{Text:uri,StartTime:0,EndTime:10}]},status:200}}`,
'LyricsSourcePreferences.ts':'export const normalizeLyricsSourceOrder=()=>[];',
'Track.ts':'export const isCurrentTrack=uri=>uri===globalThis.__visibilityFixture.uri;',
'LyricsQueueRetry.ts':'export const LyricsQueueRetry={NotifyResolved(){},HandleQueued(){}};',
'LyricsLoader.ts':'export const HideLoaderContainer=()=>{},ShowLoaderContainer=()=>{},ShowQueueLoader=()=>{},LYRICS_QUEUE_MESSAGE="queue";',
'remoteConfig.ts':'export const getRemoteConfig=()=>({lyricsFetch:{rapidSwitchWindowMs:0,rapidSwitchBackoffMs:0}});',
'LyricsNotice.ts':'export const SetShownNotice=()=>{},SyncNoLyricsLayout=()=>{};',
};
globalThis.navigator??={};Object.defineProperty(globalThis.navigator,"onLine",{value:true,configurable:true});
const {outputFiles}=await build({stdin:{contents:`export {default as fetchLyrics} from './src/utils/Lyrics/fetchLyrics.ts';export * from './src/utils/WindowActivity.ts';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'pipeline-fixtures',setup(b){b.onResolve({filter:/.*/},a=>{const name=a.path.split('/').pop();if(stubs[name])return{path:name,namespace:'stub'}});b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:stubs[a.path]}))}}]});
const api=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
function hide(value){doc.hidden=value;doc.dispatchEvent(new Event('visibilitychange'))}
async function settle(){for(let i=0;i<10;i++)await Promise.resolve()}
test('hidden track changes do no reads, requests or processing; restore fetches only the latest track once',async()=>{
 hide(true);const a=api.fetchLyrics(fixture.uri);fixture.uri='spotify:track:b';const b=api.fetchLyrics(fixture.uri);fixture.uri='spotify:track:c';const c=api.fetchLyrics(fixture.uri);const duplicate=api.fetchLyrics(fixture.uri);
 await settle();assert.equal(fixture.requests,0);assert.equal(fixture.reads,0);assert.equal(fixture.processed,0);
 hide(false);const results=await Promise.all([a,b,c,duplicate]);assert.equal(results[0],null);assert.equal(results[1],null);assert.equal(fixture.requests,1);assert.equal(fixture.processed,1);assert.equal(results[2][1],200);assert.deepEqual(results[2],results[3]);
});
test('hiding aborts an in-flight fetch without processing or error notice; resume retries current URI',async()=>{
 fixture.uri='spotify:track:d';fixture.held=true;const parsed=fixture.processed;const requests=fixture.requests;
 const pending=api.fetchLyrics(fixture.uri);await settle();assert.equal(fixture.requests,requests+1);hide(true);await settle();assert.equal(fixture.processed,parsed);
 fixture.held=false;hide(false);const result=await pending;assert.equal(result[1],200);assert.equal(fixture.requests,requests+2);assert.equal(fixture.processed,parsed+1);
});

test('visible external window permits loading while host is hidden; closing it cancels further automatic work',async()=>{
 const external=new EventTarget();external.closed=false;external.document=new EventTarget();external.document.hidden=false;external.document.querySelectorAll=()=>[];
 api.registerActivityWindow(external);hide(true);
 fixture.uri='spotify:track:external';fixture.held=false;const before=fixture.requests;await api.fetchLyrics(fixture.uri);assert.equal(fixture.requests,before+1);
 external.closed=true;external.dispatchEvent(new Event('pagehide'));
 fixture.uri='spotify:track:after-external';const pending=api.fetchLyrics(fixture.uri);await settle();assert.equal(fixture.requests,before+1);
 hide(false);await pending;assert.equal(fixture.requests,before+2);
});
