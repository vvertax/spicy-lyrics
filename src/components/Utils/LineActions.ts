import { getDisplayedLyrics } from "../../utils/Lyrics/DisplayedLyrics.ts";
import { $duetColorsEnabled,$duetLeadColor,$duetOtherColor,$uiLanguage } from "../../utils/stores.ts";
import { translateUi } from "../../utils/i18n/translate.ts";
import { LyricsObject } from "../../utils/Lyrics/lyrics.ts";
import GetProgress from "../../utils/Gets/GetProgress.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { quoteLineText } from "./QuoteText.ts";
import { comparisonTiming } from "./ReviewModel.ts";
import { comparisonLineSources } from "./TTMLDrop.ts";
import { quoteCard } from "./CreativeTools.ts";
import { reviewLyrics } from "./ReviewTools.ts";
import { toast } from "sonner";
export function bindLineActions(page:HTMLElement){
 const doc=page.ownerDocument;let menu:HTMLElement|null=null;let restore:HTMLElement|null=null;
 let repeat:{start:number;end:number;uri:string}|null=null;
 const close=()=>{menu?.remove();menu=null;};
 const color=()=>{page.classList.toggle('VV_DuetColors',$duetColorsEnabled.get());for(const [key,value] of [['--vv-lead-color',$duetLeadColor.get()],['--vv-other-color',$duetOtherColor.get()]])if(/^#[a-f0-9]{6}$/i.test(value)){page.style.setProperty(key,value);page.style.setProperty(key+'-rgb',[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)).join(','));}};
 const subscriptions=[$duetColorsEnabled.subscribe(color),$duetLeadColor.subscribe(color),$duetOtherColor.subscribe(color)];
 let repeatTimer:number|undefined;
 const stop=()=>{if(repeatTimer!==undefined)doc.defaultView!.clearInterval(repeatTimer);repeatTimer=undefined;};
 const startRepeat=()=>{stop();repeatTimer=doc.defaultView!.setInterval(()=>{if(!repeat||!page.isConnected||SpotifyPlayer.GetUri()!==repeat.uri){repeat=null;stop();return;}if(GetProgress()>=repeat.end)SpotifyPlayer.Seek(repeat.start);},50);};
 const open=(event:MouseEvent)=>{
  const line=(event.target as Element).closest<HTMLElement>('.line:not(.musical-line)');if(!line||!page.contains(line))return;
  let data:any,index:number;
  const source=comparisonLineSources.get(line);
  if(source){data=source.data;index=source.index;}
  else{data=getDisplayedLyrics(SpotifyPlayer.GetUri());if(!data)return;
   const model=[...LyricsObject.Types.Syllable.Lines,...LyricsObject.Types.Line.Lines].find(l=>l.HTMLElement===line);
   index=model?data.Content?.findIndex((l:any)=>Math.abs(comparisonTiming(l).start-model.StartTime)<2):Array.from(page.querySelectorAll('.LyricsContent .line:not(.musical-line)')).indexOf(line);
  }
  if(!data?.Content?.[index])return;const text=quoteLineText(data.Content[index]);if(!text)return;
  event.preventDefault();event.stopPropagation();close();restore=line;const targetUri=SpotifyPlayer.GetUri();
  menu=doc.createElement('div');menu.className='vv-line-menu';menu.role='menu';
  const add=(label:string,action:()=>void)=>{const button=doc.createElement('button');button.type='button';button.role='menuitem';button.textContent=translateUi(label,$uiLanguage.get());button.onclick=()=>{close();if(SpotifyPlayer.GetUri()===targetUri)action();};menu!.append(button);};
  add('Copy line',()=>{void doc.defaultView!.navigator.clipboard.writeText(text).catch(()=>toast.error(translateUi("Couldn't copy",$uiLanguage.get())));});
  add('Translate in Google Translate',()=>{doc.defaultView!.open('https://translate.google.com/?sl=auto&tl='+$uiLanguage.get()+'&text='+encodeURIComponent(text)+'&op=translate','_blank','noopener,noreferrer');});
  add('Create Quote Card',()=>{void quoteCard(doc,index,data).catch(e=>toast.error(String(e)));});
  add('Review Lyrics',()=>reviewLyrics(doc,data,index));
  const timing=comparisonTiming(data.Content[index]);
  if(timing.end>timing.start)add('Repeat line',()=>{const uri=SpotifyPlayer.GetUri();if(uri){repeat={...timing,uri};startRepeat();SpotifyPlayer.Seek(timing.start);if(!Spicetify.Player.isPlaying())Spicetify.Player.togglePlay();}});
  if(repeat)add('Stop repeating',()=>{repeat=null;stop();});
  doc.body.append(menu);const rect=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(event.clientX,doc.defaultView!.innerWidth-rect.width-8))+'px';menu.style.top=Math.max(8,Math.min(event.clientY,doc.defaultView!.innerHeight-rect.height-8))+'px';menu.querySelector('button')?.focus();
 };
 const outside=(event:PointerEvent)=>{if(!menu?.contains(event.target as Node))close();};
 const keys=(event:KeyboardEvent)=>{if(!menu)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();restore?.focus();}else if(event.key==='Tab')close();else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const buttons=Array.from(menu.querySelectorAll('button'));const i=buttons.indexOf(doc.activeElement as HTMLButtonElement);buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}};
 page.addEventListener('contextmenu',open);doc.addEventListener('pointerdown',outside);doc.addEventListener('keydown',keys,true);
 return()=>{close();repeat=null;stop();subscriptions.forEach(unsubscribe=>unsubscribe());page.removeEventListener('contextmenu',open);doc.removeEventListener('pointerdown',outside);doc.removeEventListener('keydown',keys,true);};
}
