import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function bundle(entry,stubs={}){const {outputFiles}=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'ui-fixture',setup(b){b.onResolve({filter:/.*/},a=>{const key=Object.keys(stubs).find(k=>a.path.endsWith(k));return key?{path:key,namespace:'fixture'}:undefined;});b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path]}));}}]});return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);}
const {volumeSliderShift}=await bundle('src/components/Utils/VolumeSliderLayout.ts');
test('fullscreen volume stays on-screen at either edge and releases the correction when room returns',()=>{
 const page={left:0,right:1000};assert.equal(volumeSliderShift({left:-55,right:-11,width:44},page,1000,0,44),67);
 assert.equal(volumeSliderShift({left:12,right:56,width:44},page,1000,67,44),67);
 assert.equal(volumeSliderShift({left:100,right:144,width:44},page,1000,67,44),0);
 assert.equal(volumeSliderShift({left:990,right:1034,width:44},page,1000,0,44),-46);
 assert.equal(volumeSliderShift({left:-20,right:2,width:22},page,1000,0,44),64);
});
const {settingDestination}=await bundle('src/components/ReactComponents/SettingsPanel/SettingNavigation.ts');
test('related-setting destinations resolve to their real tab without a search query',()=>{
 assert.deepEqual(settingDestination('appearance-custom-font'),{id:'appearance-custom-font',section:'Appearance'});
 assert.equal(settingDestination('lyrics-early-scroll').section,'Playback');
 assert.equal(settingDestination('interface-disable-npv').section,'Interface');
 assert.equal(settingDestination('ctrlWheelLyricsZoom').section,'Lyrics Display');
 assert.equal(settingDestination('unknown'),null);
 assert.deepEqual(settingDestination('appearance-background-type'),{id:'appearance-background-type',section:'Appearance',group:'Background'});
 assert.deepEqual(settingDestination('motionArtwork'),{id:'motionArtwork',section:'Appearance',group:'Background'});
 assert.deepEqual(settingDestination('appearance-cover-art-animation'),{id:'appearance-cover-art-animation',section:'Appearance',group:'Background'});
 assert.deepEqual(settingDestination('effects-animator-presets'),{id:'effects-animator-presets',section:'Lyrics Display',group:'Effects'});
 assert.equal(settingDestination('lyrics-song-offset').section,'Playback');
 assert.deepEqual(settingDestination('ttmlReviewer'),{id:'ttmlReviewer',section:'Advanced',group:'TTML Reviewer'});
});
const {settingsLocation,MAIN_SETTINGS_SECTIONS}=await bundle('src/components/ReactComponents/SettingsPanel/SettingsLayout.ts');
test('all previous settings tabs reopen their new parent and group',()=>{
 assert.equal(MAIN_SETTINGS_SECTIONS.length,8);
 for(const [old,section,group] of [['Background','Appearance','Background'],['Effects','Lyrics Display','Effects'],['Bug report','Advanced','Diagnostic report'],['TTML Reviewer','Advanced','TTML Reviewer'],['History','Advanced','Settings history']])assert.deepEqual(settingsLocation(old),{section,group});
 for(const section of [...MAIN_SETTINGS_SECTIONS,'Favorites'])assert.deepEqual(settingsLocation(section),{section});
 assert.deepEqual(settingsLocation('obsolete'),{section:'Appearance'});
});
const {safeDiagnosticValue,formatDiagnosticText}=await bundle('src/utils/DiagnosticReport.ts');
test('readable diagnostics group nested values, preserve errors and remove credentials before formatting',()=>{
 const report=safeDiagnosticValue({version:'1.11.1',capturedAt:'2026-11-14T00:00:00Z',channel:'vvertax Edition',runtime:{online:true},settings:{password:'VERY_PRIVATE',accessToken:'SECRET',size:125},errors:[{message:'Bearer secret123',stack:'Error\n at update https://example.test/app.js?token=private'}]});
 const text=formatDiagnosticText(report);assert.match(text,/01  Runtime/);assert.match(text,/Online: on/);assert.match(text,/Size: 125/);assert.match(text,/Recent errors/);
 for(const secret of ['VERY_PRIVATE','SECRET','secret123','token=private'])assert.equal(text.includes(secret),false);
 assert.match(text,/\[redacted\]/);
});
const fixture=globalThis.__uiDiagnostic={settings:new Map([['lyricsSize',{get:()=>125}],['showVolumeSliderFullscreen',{get:()=> 'Left'}],['musixmatchToken',{get:()=> 'PRIVATE_TOKEN'}],['customFont',{get:()=> 'PRIVATE_FONT'}]]),lyrics:{Type:'Syllable',sourceDisplayName:'Apple Music',Content:[{Type:'Vocal',Lead:{Syllables:[{Text:'PRIVATE_LYRIC_TEXT'}]},Background:[{Syllables:[]}]}]},failure:{uri:'spotify:track:PRIVATE_TRACK',source:'spicy',detail:'token=PRIVATE_TOKEN'}};
const storeNames=['spicyLyricsVersion','showVolumeSliderFullscreen','playbackOffset','songPlaybackOffsets','rendererVisualStyle','lyricsSize','ctrlWheelLyricsZoom','lyricsRendererPaused','currentlyFetching','buildChannel','uiLanguage'];
const values={spicyLyricsVersion:'1.11.1',showVolumeSliderFullscreen:'Left',playbackOffset:100,songPlaybackOffsets:{'spotify:track:PRIVATE_TRACK':30},rendererVisualStyle:'bloom',lyricsSize:125,ctrlWheelLyricsZoom:true,lyricsRendererPaused:false,currentlyFetching:false,buildChannel:'vvertax Edition',uiLanguage:'ru'};
const api=await bundle('src/components/Utils/Diagnostics.ts',{
 'Icons.ts':'export const Icons={LyricsPage:"<svg/>"};',
 'experiments.ts':'export const getExperiments=()=>[{id:"nextUpCard"}];export const isExperimentEnabled=()=>true;',
 'SettingsHistory.ts':'export const settingsHistory={stores:globalThis.__uiDiagnostic.settings};',
 'stores.ts':storeNames.map(n=>`export const $${n}={get:()=>(${JSON.stringify(values[n])})};`).join(''),
 'DisplayedLyrics.ts':'export const getDisplayedLyrics=()=>globalThis.__uiDiagnostic.lyrics;',
 'SpotifyPlayer.ts':'export const SpotifyPlayer={GetUri:()=>"spotify:track:PRIVATE_TRACK",GetPosition:()=>1000,GetDuration:()=>20000,GetContentType:()=>"track"};',
 'fetchLyrics.ts':'export const GetLastLyricsFailure=()=>globalThis.__uiDiagnostic.failure,GetLyricsAnsweredFrom=()=>"cache",getActiveLyricsSourceOrder=()=>["spicy","spotify"];',
 'CircuitBreaker.ts':'export const IsOpen=()=>false,RetryAfterMs=()=>0;',
 'ttmlReviewer.ts':'export const $ttmlReviewer={get:()=>false};',
 'translate.ts':'export const translateUi=s=>s;',
});
const bounds=(left,right)=>({getBoundingClientRect:()=>({left,right,width:right-left,top:0,bottom:700,height:700})});
const page={...bounds(0,1000),classList:{contains:name=>['Fullscreen','NowBarSide__Left','QueueOpen'].includes(name)},closest:()=>null,querySelector:s=>s==='.FullscreenVolumeSlider'?bounds(-20,24):bounds(12,400),querySelectorAll:()=>({length:3})};
const doc={defaultView:{innerWidth:1000,innerHeight:700,navigator:{onLine:true,platform:'Win32',hardwareConcurrency:8,userAgent:'Spotify/1.2.3'},devicePixelRatio:1,performance:{},matchMedia:()=>({matches:false})},documentElement:{clientWidth:1000,clientHeight:700},querySelector:()=>page,visibilityState:'visible',fullscreenElement:{},fonts:{status:'loaded'},getAnimations:()=>[]};
globalThis.Spicetify={Config:{version:'2.0'},Player:{isPlaying:()=>true,getVolume:()=>.4}};
test('full diagnostics contain actionable layout and pipeline data, without lyrics, track identifiers or tokens',()=>{
 const report=api.buildDiagnosticData(doc);const json=JSON.stringify(report);assert.equal(report.window.coverSide,'left');assert.equal(report.window.queueOpen,true);assert.equal(report.playback.songOffsetMs,30);assert.equal(report.lyrics.syllables,1);assert.equal(report.rendering.lyricsSizePercent,125);assert.equal(report.network.lastFailure.stage,'spicy');assert.ok(report.findings.some(s=>s.includes('volume slider')));
 for(const secret of ['PRIVATE_LYRIC_TEXT','PRIVATE_TRACK','PRIVATE_TOKEN','PRIVATE_FONT'])assert.equal(json.includes(secret),false,secret);
 assert.deepEqual(JSON.parse(api.buildDiagnosticReport(doc)).network.enabledSources,['spicy','spotify']);
});
