import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function bundle(entry, stubs = {}) {
  const {outputFiles} = await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'dependencies',setup(b){
    b.onResolve({filter:/.*/},a=>{const key=Object.keys(stubs).find(k=>a.path.endsWith(k));if(key)return{path:key,namespace:'stub'};});
    b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:stubs[a.path]}));
  }}]});
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}#${Math.random()}`);
}
const placement=await bundle('src/components/DynamicBG/ArtworkPlacement.ts');
const words=await bundle('src/utils/Lyrics/Applyer/Utils/JoinSplitWords.ts');

test('motion placement waits for a verdict, falls back to Canvas and never starts both surfaces',()=>{
  const base={stageEligible:true,canvas:true,motionEnabled:true,priority:'motion',motionOnStage:true,motion:'pending'};
  assert.deepEqual(placement.DecideArtworkPlacement(base),{stage:null,cover:false,pending:true});
  assert.equal(placement.DecideArtworkPlacement({...base,motion:'none'}).stage,'canvas');
  assert.equal(placement.DecideArtworkPlacement({...base,motion:'available'}).stage,'motion');
  assert.equal(placement.DecideArtworkPlacement({...base,priority:'canvas'}).stage,'canvas');
  for(const stageEligible of [false,true])for(const canvas of [false,true])for(const motionEnabled of [false,true])for(const motion of ['available','none','unknown','pending'])for(const priority of ['motion','canvas'])for(const motionOnStage of [false,true]){
    const result=placement.DecideArtworkPlacement({stageEligible,canvas,motionEnabled,motion,priority,motionOnStage});
    assert.ok(!(result.stage && result.cover));
    assert.ok(!(result.stage && result.pending));
    if(!stageEligible)assert.equal(result.stage,null);
  }
});

test('syllable merge preserves original timing parts and distinguishes steady and held words',()=>{
  const run=[{Text:'hel',StartTime:0,EndTime:0.3,IsPartOfWord:true},{Text:'lo',StartTime:0.3,EndTime:0.5,IsPartOfWord:false}];
  const joined=words.JoinSplitWords(run,'steady');assert.equal(joined.length,1);assert.equal(joined[0].Text,'hello');assert.equal(joined[0].EndTime,.5);assert.deepEqual(joined[0].Parts,run);
  const uneven=[{...run[0],EndTime:.01},{...run[1],StartTime:.01,EndTime:3}];
  assert.equal(words.JoinSplitWords(uneven,'steady').length,2);
  assert.equal(words.JoinSplitWords(uneven,'full').length,1);
  assert.equal(words.JoinSplitWords(run,'held',()=>false).length,2);
  assert.equal(words.JoinSplitWords(run,'held',()=>true).length,1);
  assert.equal(words.JoinSplitWords([{...run[0],Text:'Ah-'},run[1]],'full').length,2);
});

const storage=new Map();let refuseBackup=false;
globalThis.Spicetify={LocalStorage:{get:k=>storage.get(k)??null,set:(k,v)=>{if(refuseBackup&&k==='SL:ttmlReviewer')throw new Error('quota');storage.set(k,v);},remove:k=>storage.delete(k)}};
globalThis.window={};
const stores=await bundle('src/utils/stores.ts',{
  'InterfaceDesign.ts':'export const registerDesignDocument=()=>{};export const setInterfaceDesign=()=>{};export const setVvertaxYouPalette=()=>{};export const setVvertaxYouCustomColor=()=>{};',
  'SettingsHistory.ts':'export const settingsHistory={register(){},capture(){},previewing:false};',
  'hiddenSettings.ts':'export const SETTING_IDS=[];',
});
globalThis.__upstreamSettings=stores.PersistedSettings;
const reviewer=await bundle('src/utils/ttmlReviewer.ts',{
  './stores.ts':'export const PersistedSettings=globalThis.__upstreamSettings;',
  './experiments.ts':'export const EXPERIMENTS=[{id:"nextUpCard"},{id:"canvasImmersive"}];',
  'sonner':'export const toast={error(){}};',
});

test('upstream setting migration preserves the fork simple renderer opt-out and legacy background',()=>{
  const blob={simpleLyricsMode:true,'experiment:refreshedSimpleLyrics':false};
  assert.equal(stores.migrateRendererStyle(blob),true);
  assert.equal(blob.rendererVisualStyle,'bloom');assert.equal(blob.simpleLyricsMode,true);assert.equal(blob['experiment:refreshedSimpleLyrics'],false);
  stores.$staticBackgroundMode.set('legacy');assert.equal(stores.$backgroundStyle.get(),'legacy');
});

test('reviewer saves before modifying, preserves per-song offsets and restores exact background and renderer choices',()=>{
  stores.$staticBackgroundMode.set('legacy');stores.$simpleLyricsMode.set(true);stores.$rendererVisualStyle.set('bloom');stores.$playbackOffset.set(320);stores.$spaceGravityMode.set(true);
  const offsets={'spotify:track:test':150};stores.$songPlaybackOffsets.set(offsets);
  reviewer.setTtmlReviewer(true);assert.equal(reviewer.$ttmlReviewer.get(),true);assert.ok(storage.has('SL:ttmlReviewer'));
  assert.equal(stores.$playbackOffset.get(),0);assert.equal(stores.$simpleLyricsMode.get(),false);assert.equal(stores.$rendererVisualStyle.get(),'spring');assert.equal(stores.$spaceGravityMode.get(),false);assert.equal(stores.$backgroundStyle.get(),'color');assert.deepEqual(stores.$songPlaybackOffsets.get(),offsets);
  reviewer.setTtmlReviewer(false);assert.equal(stores.$playbackOffset.get(),320);assert.equal(stores.$simpleLyricsMode.get(),true);assert.equal(stores.$rendererVisualStyle.get(),'bloom');assert.equal(stores.$spaceGravityMode.get(),true);assert.equal(stores.$backgroundStyle.get(),'legacy');assert.equal(storage.has('SL:ttmlReviewer'),false);
});

test('reviewer leaves settings untouched when its backup cannot be saved',()=>{
  stores.$playbackOffset.set(777);refuseBackup=true;reviewer.setTtmlReviewer(true);refuseBackup=false;
  assert.equal(reviewer.$ttmlReviewer.get(),false);assert.equal(stores.$playbackOffset.get(),777);assert.equal(storage.has('SL:ttmlReviewer'),false);
});

test('unsynced advanced scrolling falls back to a bounded linear clock when both services fail',async()=>{
  const {GetStaticPace}=await bundle('src/utils/Scrolling/StaticPace.ts',{
    'audioAnalysis.ts':'export const getDynamicAudioAnalysis=async()=>{throw new Error("offline")};',
    'SpotifyMetadata.ts':'export const MetadataExtension={VocalActivity:1};export const FetchMetadataExtension=async()=>{throw new Error("offline")};export const DecodeVocalActivity=()=>null;',
    'Logger.ts':'export default class {debug(){}}',
  });
  const promise=GetStaticPace('spotify:track:offline',10000,'advanced');assert.equal(GetStaticPace('spotify:track:offline',10000,'advanced'),promise);
  const pace=await promise;assert.equal(pace(-1),0);assert.equal(pace(5000),.5);assert.equal(pace(20000),1);
});

test('stable Ctrl wheel zoom carries a saved experimental opt-out into the normal setting',async()=>{
  const values=new Map([["SL:settings",JSON.stringify({"experiment:ctrlWheelLyricsZoom":false})]]);
  globalThis.Spicetify.LocalStorage={get:k=>values.get(k)??null,set:(k,v)=>values.set(k,v),remove:k=>values.delete(k)};
  const migrated=await bundle('src/utils/stores.ts',{
    'InterfaceDesign.ts':'export const registerDesignDocument=()=>{};export const setInterfaceDesign=()=>{};export const setVvertaxYouPalette=()=>{};export const setVvertaxYouCustomColor=()=>{};',
    'SettingsHistory.ts':'export const settingsHistory={register(){},capture(){},previewing:false};',
    'hiddenSettings.ts':'export const SETTING_IDS=new Set();',
  });
  assert.equal(migrated.$ctrlWheelLyricsZoom.get(),false);
  const saved=JSON.parse(values.get('SL:settings'));assert.equal(saved.ctrlWheelLyricsZoom,false);assert.equal('experiment:ctrlWheelLyricsZoom' in saved,false);
});

test('6.5.10 merge default is Off without overwriting saved or legacy split-word choices',async()=>{
  for(const [saved,expected] of [[{},'off'],[{syllableMerge:'steady'},'steady'],[{joinSplitWords:true},'steady'],[{joinSplitWords:false},'off']]){
    const values=new Map([['SL:settings',JSON.stringify(saved)]]);
    globalThis.Spicetify.LocalStorage={get:k=>values.get(k)??null,set:(k,v)=>values.set(k,v),remove:k=>values.delete(k)};
    const stores=await bundle('src/utils/stores.ts',{
      'InterfaceDesign.ts':'export const registerDesignDocument=()=>{};export const setInterfaceDesign=()=>{};export const setVvertaxYouPalette=()=>{};export const setVvertaxYouCustomColor=()=>{};',
      'SettingsHistory.ts':'export const settingsHistory={register(){},capture(){},previewing:false};',
      'hiddenSettings.ts':'export const SETTING_IDS=new Set();',
    });
    assert.equal(stores.$syllableMerge.get(),expected);assert.equal(stores.$showQueueWhenNoLyrics.get(),false);
    stores.$showQueueWhenNoLyrics.set(true);assert.equal(JSON.parse(values.get('SL:settings')).showQueueWhenNoLyrics,true);
  }
});

test("graduated subtitles preserve the effective old state and saved layout", async () => {
  const position = { anchor: "top", x: .4, y: .2, width: 670 };
  const cases = [
    [{}, false],
    [{ "experiment:subtitleBar": true }, true],
    [{ "experiment:subtitleBar": true, subtitlePanelVisible: false }, false],
    [{ "experiment:subtitleBar": false, subtitlePanelVisible: true }, false],
    [{ "experiment:subtitleBar": false, subtitlesEnabled: true }, true],
  ];
  for (const [saved, enabled] of cases) {
    const values = new Map([["SL:settings", JSON.stringify({ ...saved, subtitleLayout: position })]]);
    globalThis.Spicetify.LocalStorage = { get: k => values.get(k) ?? null, set: (k, v) => values.set(k, v), remove: k => values.delete(k) };
    const migrated = await bundle("src/utils/stores.ts", {
      "InterfaceDesign.ts": "export const registerDesignDocument=()=>{};export const setInterfaceDesign=()=>{};export const setVvertaxYouPalette=()=>{};export const setVvertaxYouCustomColor=()=>{};",
      "SettingsHistory.ts": "export const settingsHistory={register(){},capture(){},previewing:false};",
      "hiddenSettings.ts": "export const SETTING_IDS=new Set();",
    });
    assert.equal(migrated.$subtitlesEnabled.get(), enabled);
    assert.deepEqual(migrated.$subtitleLayout.get(), position);
    const persisted = JSON.parse(values.get("SL:settings"));
    assert.equal("experiment:subtitleBar" in persisted, false);
    assert.equal("subtitlePanelVisible" in persisted, false);
  }
});
