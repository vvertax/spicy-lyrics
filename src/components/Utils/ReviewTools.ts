import { authorHandle, changedTTMLLines } from "./ReviewModel.ts";
import { toast } from "sonner";
import { $currentLyricsData } from "../../utils/stores.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { ParseTTML } from "../../utils/Lyrics/manager/parseTTML.ts";
import { ProcessLyrics } from "../../utils/Lyrics/ProcessLyrics.ts";
import ApplyLyrics from "../../utils/Lyrics/Global/Applyer.ts";
import { SessionTTMLStore, getSongKey } from "../../utils/Lyrics/fetchLyrics.ts";
import { quoteLineText } from "./QuoteText.ts";
import { Icons } from "../Styling/Icons.ts";

type Note = { id:string; uri:string; title:string; file:string; line:number; text:string; timeMs:number; kind:string; comment:string; created:string };
const NOTES_KEY = "vvertax:lyrics-review-notes:v1";
function readNotes(): Note[] {
  try { const value = JSON.parse(Spicetify.LocalStorage.get(NOTES_KEY) ?? "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
}
function storeNotes(notes: Note[]) { Spicetify.LocalStorage.set(NOTES_KEY, JSON.stringify(notes)); }
function element<K extends keyof HTMLElementTagNameMap>(doc:Document, tag:K, text?:string) {
  const node = doc.createElement(tag); if (text !== undefined) node.textContent = text; return node;
}
function dialog(doc:Document, title:string) {
  const previous = doc.activeElement as HTMLElement | null;
  const root = element(doc,'dialog'); root.className = 'vv-review-dialog';
  const header = element(doc,'header'); const close = element(doc,'button','×'); close.type='button'; close.setAttribute('aria-label','Close'); close.onclick=()=>root.close();
  header.append(element(doc,'h2',title),close); root.append(header);
  root.addEventListener('close',()=>{root.remove(); previous?.focus();},{once:true}); doc.body.append(root); root.showModal();
  return root;
}
function button(doc:Document, label:string, action:()=>void) { const node=element(doc,'button',label); node.type='button'; node.onclick=action; return node; }
function download(doc:Document, name:string, text:string, type:string) {
  const url=URL.createObjectURL(new Blob([text],{type})); const link=element(doc,'a'); link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function currentLyrics() {
  try { const data=JSON.parse($currentLyricsData.get()); if (Array.isArray(data.Content)) return data; } catch { /* notice */ }
  throw new Error('Open a song with lyrics first');
}
export function AddReviewMenuRows(menu:HTMLElement, add:(button:HTMLButtonElement,label:string)=>void) {
  const doc=menu.ownerDocument;
  for (const [label, open] of [
    ['Find Author Works',()=>authorSearch(doc)],
    ['Review Lyrics',()=>reviewLyrics(doc)],
    ['Compare TTML A/B',()=>compareTTML(doc)],
  ] as const) {
    const row=element(doc,'button');row.type='button';row.innerHTML=Icons.LoadTTML;
    add(row,label);row.onclick=()=>{ try { open(); } catch(error) {toast.error((error as Error).message);} };
  }
}
function authorSearch(doc:Document) {
  const root=dialog(doc,'Find Author Works'); const win=doc.defaultView!;
  const form=element(doc,'form');const input=element(doc,'input');input.placeholder='Username, e.g. vvertax. or july';input.setAttribute('aria-label','Author username');input.required=true;input.maxLength=100;
  const submit=element(doc,'button','Search');submit.type='submit';form.append(input,submit);
  const message=element(doc,'p','Enter a username to view their public works.');message.role='status';
  const profile=element(doc,'a','Open profile in browser');profile.target='_blank';profile.rel='noopener noreferrer';profile.hidden=true;
  const frame=element(doc,'iframe');frame.title='Author works';frame.className='vv-author-frame';frame.hidden=true;frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups');
  let timer:ReturnType<typeof setTimeout>|undefined;
  form.onsubmit=event=>{
    event.preventDefault(); const name=authorHandle(input.value);
    if (!name) {message.textContent='Enter a username, not a link.';return;}
    clearTimeout(timer);profile.href=`https://spicylyrics.org/${encodeURIComponent(name)}`;profile.hidden=false;
    message.textContent='Loading author works…';frame.hidden=false;frame.src=`https://spicylyrics.org/embed/${encodeURIComponent(name)}`;
    timer=setTimeout(()=>{if(root.isConnected)message.textContent='If the list is unavailable, open the profile in your browser.';},10000);
  };
  frame.onload=()=>{clearTimeout(timer);message.textContent='Public profile works. Use Listen to play a track; if the page is unavailable, open it in your browser.';};
  const onMessage=(event:MessageEvent)=>{
    if(event.origin!=='https://spicylyrics.org'||event.source!==frame.contentWindow||event.data?.type!=='events')return;
    for(const item of Array.isArray(event.data?.data?.events)?event.data.data.events:[]) {
      if(item?.action==='PATCH_PLAYBACK') {
        const uri=item?.patches?.[0]?.playback_uri;
        if(typeof uri==='string'&&/^spotify:track:[A-Za-z0-9]+$/.test(uri)){Spicetify.Player.playUri(uri);}
      }
    }
  };
  win.addEventListener('message',onMessage);root.addEventListener('close',()=>{clearTimeout(timer);win.removeEventListener('message',onMessage);frame.src='about:blank';},{once:true});
  root.append(form,message,profile,frame);input.focus();
}
function reviewLyrics(doc:Document) {
  const data=currentLyrics();const uri=SpotifyPlayer.GetUri();if(!uri)throw new Error('No current track');
  const title=Spicetify.Player.data?.item?.metadata?.title??uri;
  const file=data.reviewFileName??'Current lyrics';
  const root=dialog(doc,'Review Lyrics');root.append(element(doc,'p',`${title} · ${file}`));
  const hint=element(doc,'p','Choose a line, select the problem type and add a note. Notes are stored only on this device.');root.append(hint);
  const select=element(doc,'select');select.setAttribute('aria-label','Lyric line');
  const lines=data.Content.map((line:any,index:number)=>({index,text:quoteLineText(line),timeMs:Math.round((line.StartTime??line.Lead?.StartTime??0)*1000)}));
  for(const line of lines){const option=element(doc,'option',`${line.index+1}. ${line.text||'[instrumental]'}`);option.value=String(line.index);select.append(option);}
  const kind=element(doc,'select');kind.setAttribute('aria-label','Problem type');for(const name of ['Text','Timing','Markup']){const option=element(doc,'option',name);kind.append(option);}
  const comment=element(doc,'textarea');comment.placeholder='Wrong word, starts too early, missing background vocal…';comment.setAttribute('aria-label','Review comment');comment.maxLength=2000;
  const list=element(doc,'div');list.className='vv-review-notes';const status=element(doc,'p');status.role='status';
  const report=()=>readNotes().filter(note=>note.uri===uri);
  const reportText=()=>`${title}\nhttps://open.spotify.com/track/${uri.split(':').pop()}\n\n`+report().map(note=>`[${(note.timeMs/1000).toFixed(2)}s] ${note.kind} · ${note.file} · line ${note.line+1}\n${note.text}\n${note.comment}`).join('\n\n');
  const render=()=>{list.replaceChildren();const notes=report();if(!notes.length)list.append(element(doc,'p','No notes for this track yet.'));for(const note of notes){const card=element(doc,'article');card.append(element(doc,'strong',`${note.kind} · ${(note.timeMs/1000).toFixed(2)}s · ${note.file}`),element(doc,'p',note.text),element(doc,'p',note.comment));card.append(button(doc,'Go to line',()=>{if(SpotifyPlayer.GetUri()===uri)SpotifyPlayer.Seek(note.timeMs);else toast.error('Play this track first');}),button(doc,'Delete',()=>{storeNotes(readNotes().filter(item=>item.id!==note.id));render();}));list.append(card);}};
  const save=button(doc,'Save note',()=>{
    const line=lines[Number(select.value)];if(!line){status.textContent='Choose a line.';return;}
    if(!comment.value.trim()){status.textContent='Describe the issue first.';return;}
    try {storeNotes([...readNotes(),{id:crypto.randomUUID(),uri,title,file,line:line.index,text:line.text,timeMs:line.timeMs,kind:kind.value,comment:comment.value.trim(),created:new Date().toISOString()}]);comment.value='';status.textContent='Note saved';render();}catch{status.textContent='Could not save notes. Export existing notes to free storage.';}
  });
  const actions=element(doc,'div');actions.className='vv-review-actions';actions.append(save,button(doc,'Copy report',()=>{void doc.defaultView!.navigator.clipboard.writeText(reportText()).then(()=>{status.textContent='Report copied';}).catch(()=>{status.textContent='Clipboard unavailable. Use Download report.';});}),button(doc,'Download report',()=>download(doc,'lyrics-review.txt',reportText(),'text/plain;charset=utf-8')),button(doc,'Export JSON',()=>download(doc,'lyrics-review.json',JSON.stringify(report(),null,2),'application/json')));
  root.append(select,kind,comment,actions,status,list);render();
}
function compareTTML(doc:Document) {
  const original=currentLyrics();const uri=SpotifyPlayer.GetUri();if(!uri)throw new Error('No current track');
  const key=getSongKey(uri) ?? uri;const oldSession=SessionTTMLStore.get(key);
  const root=dialog(doc,'Compare TTML A/B');root.append(element(doc,'p','Load two versions for the current track. Switching preserves playback position. Closing restores the original lyrics.'));
  const status=element(doc,'p');status.role='status';const summary=element(doc,'div');summary.className='vv-compare-summary';
  const versions:Record<string,any>={};let generation=0;let changed=false;let closing=false;
  const apply=async(data:any)=>{
    const request=++generation;
    if(SpotifyPlayer.GetUri()!==uri)throw new Error('Track changed. Reopen comparison for the new track.');
    const copy=structuredClone(data);copy.uri=uri;copy.id=SpotifyPlayer.GetId();
    await ProcessLyrics(copy);
    if(request!==generation||SpotifyPlayer.GetUri()!==uri||closing)return;
    SessionTTMLStore.set(key,copy);$currentLyricsData.set(JSON.stringify(copy));changed=true;
    await ApplyLyrics([copy,200]);
  };
  const refresh=()=>{summary.replaceChildren();for(const label of ['A','B']){const data=versions[label];if(data)summary.append(element(doc,'p',`${label}: ${data.reviewFileName} · ${data.Content.length} lines`));}if(versions.A&&versions.B){const differences=changedTTMLLines(versions.A.Content, versions.B.Content);summary.append(element(doc,'p',`${differences} lines differ in text or timing.`));}};
  for(const label of ['A','B']){
    const row=element(doc,'div');row.className='vv-review-actions';const input=element(doc,'input');input.type='file';input.accept='.ttml';input.setAttribute('aria-label',`Load TTML ${label}`);
    const use=button(doc,`Show ${label}`,()=>{void apply(versions[label]).then(()=>{if(root.isConnected)status.textContent=`Showing ${label}: ${versions[label].reviewFileName}`;}).catch(error=>{status.textContent=(error as Error).message;});});use.disabled=true;
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;use.disabled=true;try{if(file.size>5*1024*1024)throw new Error('TTML must be smaller than 5 MB');const parsed=await ParseTTML(await file.text());if(!parsed?.Result?.Content?.length)throw new Error('No valid lyrics in this TTML');if(!root.isConnected)return;versions[label]={...parsed.Result,reviewFileName:file.name};use.disabled=false;status.textContent=`Loaded ${label}`;refresh();}catch(error){status.textContent=(error as Error).message;}};
    row.append(element(doc,'strong',label),input,use);root.append(row);
  }
  root.append(button(doc,'Mark a problem in current version',()=>{try{reviewLyrics(doc);}catch(error){toast.error((error as Error).message);}}),summary,status);
  const restore=async()=>{
    closing=true;++generation;
    if(!changed)return;
    if(oldSession)SessionTTMLStore.set(key,oldSession);else SessionTTMLStore.delete(key);
    if(SpotifyPlayer.GetUri()!==uri)return;
    $currentLyricsData.set(JSON.stringify(original));await ApplyLyrics([structuredClone(original),200]);
  };
  root.addEventListener('close',()=>{void restore().catch(error=>toast.error((error as Error).message));},{once:true});
}
