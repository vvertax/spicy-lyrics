import {previewStorage} from "./Storage.ts";
import {events,state,position,seek,toggle,next,track,uri,storagePrefix,unavailable} from './environment.ts';
document.documentElement.dataset.preview='true';
const nativeStorage=window.localStorage;
Object.defineProperty(window,'localStorage',{configurable:true,value:previewStorage(nativeStorage,storagePrefix)});
const nativeOpen=indexedDB.open.bind(indexedDB),nativeDelete=indexedDB.deleteDatabase.bind(indexedDB);
Object.defineProperty(indexedDB,'open',{configurable:true,value:(name:string,version?:number)=>nativeOpen(storagePrefix+name,version)});
Object.defineProperty(indexedDB,'deleteDatabase',{configurable:true,value:(name:string)=>nativeDelete(storagePrefix+name)});
if(new URL(location.href).searchParams.has('reset')){await Promise.all(['spicylyrics','SL_ForkFonts'].map(name=>new Promise<void>(resolve=>{const request=nativeDelete(storagePrefix+name);request.onsuccess=request.onerror=request.onblocked=()=>resolve();})));const url=new URL(location.href);url.searchParams.delete('reset');window.history.replaceState(null,'',url);}

const local={get:(key:string)=>nativeStorage.getItem(storagePrefix+key),set:(key:string,value:any)=>nativeStorage.setItem(storagePrefix+key,String(value)),remove:(key:string)=>nativeStorage.removeItem(storagePrefix+key)};
const language=new URL(location.href).searchParams.get('lang')==='en'?'en':'ru';
if(!local.get('SL:settings'))local.set('SL:settings',JSON.stringify({uiLanguage:language,coverArtAnimation:true,showVolumeSlider:false}));
const metadata=()=>({title:track().title,artist_name:track().artist,album_title:track().album,image_url:new URL(track().cover,location.href).href,album_uri:'spotify:album:preview',artist_uri:'spotify:artist:preview',duration:String(track().duration)});
const item=()=>({uri:uri(),name:track().title,metadata:metadata(),duration:{milliseconds:track().duration},artists:[{name:track().artist}],album:{name:track().album}});
const history={location:{pathname:'/SpicyLyrics'},push:()=>unavailable(),goBack:()=>unavailable(),listen:()=>()=>{}};
const Player={get data(){return {item:item(),isPaused:!state.playing}},isPlaying:()=>state.playing,getProgress:position,getDuration:()=>track().duration,seek,togglePlay:toggle,next:()=>next(),back:()=>next(-1),getVolume:()=>state.volume,setVolume:(v:number)=>state.volume=v,
 addEventListener:(name:string,fn:any)=>events.addEventListener(name,fn),removeEventListener:(name:string,fn:any)=>events.removeEventListener(name,fn),getRepeat:()=>0,getShuffle:()=>false};
const noNetwork=async()=>{throw new Error('This action needs Spotify; the demo makes no Spotify requests.');};
Object.assign(window,{Spicetify:{LocalStorage:local,Player,Platform:{History:history,PlayerAPI:{getQueue:async()=>({nextTracks:[{contextTrack:{...item(),uri:'spotify:track:'+(track().id==='previewA'?'previewB':'previewA'),metadata:{title:'Next demo',artist_name:'Spicy Lyrics Demo',duration:'55000'}}}]}),_events:{addListener:(name:string,fn:any)=>events.addEventListener(name,fn)}},LibraryAPI:{contains:async()=>[false]},RootlistAPI:{}},CosmosAsync:{get:noNetwork,post:noNetwork,put:noNetwork},URI:{isTrack:(value:string)=>value.startsWith('spotify:track:'),fromString:(value:string)=>({type:'track',id:value.split(':')[2]}),Type:{TRACK:'track'}},showNotification:unavailable,React:null,colorExtractor:async()=>({VIBRANT:track().color,VIBRANT_NON_ALARMING:track().color,DARK_VIBRANT:'#181229',LIGHT_VIBRANT:'#c4aedf',DESATURATED:'#665e79'})}});
const originalFetch=window.fetch.bind(window);window.fetch=(input:any,init?:any)=>{const url=new URL(typeof input==='string'?input:input.url??String(input),location.href);if(url.origin!==location.origin&&!['fonts.googleapis.com','fonts.gstatic.com','fonts.spikerko.org'].includes(url.hostname))return Promise.reject(new Error('External services are unavailable in the demo.'));return originalFetch(input,init);};
const nativeHidden=Object.getOwnPropertyDescriptor(Document.prototype,'hidden')?.get;
Object.defineProperty(document,'hidden',{configurable:true,get:()=>state.hidden||nativeHidden?.call(document)||false});
window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin)return;if(e.data?.type==='SL_PREVIEW_VISIBILITY'){position();state.hidden=!e.data.visible;state.anchor=performance.now();document.dispatchEvent(new Event('visibilitychange'));}if(e.data?.type==='SL_PREVIEW_LANGUAGE')window.dispatchEvent(new CustomEvent('preview:language',{detail:e.data.language}));if(e.data?.type==='SL_PREVIEW_FEATURE')window.dispatchEvent(new CustomEvent('preview:feature',{detail:e.data.feature}));});
window.addEventListener('preview:reset',()=>{for(let i=nativeStorage.length-1;i>=0;i--){const key=nativeStorage.key(i);if(key?.startsWith(storagePrefix))nativeStorage.removeItem(key);}const resetUrl=new URL(location.href);resetUrl.searchParams.set('reset','1');location.href=resetUrl.href;});
import('./main.ts').catch(error=>{const el=document.createElement('p');el.className='preview-error';el.textContent='Не удалось открыть демо: '+error.message;document.body.append(el);console.error(error);});
