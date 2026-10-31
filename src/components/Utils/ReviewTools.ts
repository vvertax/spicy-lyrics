import GetProgress from "../../utils/Gets/GetProgress.ts";
import { onAnimationFrame } from "../../utils/AnimationFrameLoop.ts";
import { authorHandle, changedTTMLLines, comparisonTiming, comparisonDifference } from "./ReviewModel.ts";
import { toast } from "sonner";
import { $currentLyricsData } from "../../utils/stores.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { ParseTTML } from "../../utils/Lyrics/manager/parseTTML.ts";
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
  for (const [label, icon, open] of [
    ['Find Author Works',Icons.FindAuthorWorks,()=>authorSearch(doc)],
    ['Review Lyrics',Icons.ReviewLyrics,()=>reviewLyrics(doc)],
    ['Compare TTML A/B',Icons.CompareTTML,()=>compareTTML(doc)],
  ] as const) {
    const row=element(doc,'button');row.type='button';row.innerHTML=icon;
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
function reviewLyrics(doc:Document, supplied?:any, initialLine=0) {
  const data=supplied ?? currentLyrics();const uri=SpotifyPlayer.GetUri();if(!uri)throw new Error('No current track');
  const title=Spicetify.Player.data?.item?.metadata?.title??uri;
  const file=data.reviewFileName??'Current lyrics';
  const root=dialog(doc,'Review Lyrics');root.append(element(doc,'p',`${title} · ${file}`));
  const hint=element(doc,'p','Choose a line, select the problem type and add a note. Notes are stored only on this device.');root.append(hint);
  const select=element(doc,'select');select.setAttribute('aria-label','Lyric line');
  const lines=data.Content.map((line:any,index:number)=>({index,text:quoteLineText(line),timeMs:Math.round((line.StartTime??line.Lead?.StartTime??0)*1000)}));
  for(const line of lines){const option=element(doc,'option',`${line.index+1}. ${line.text||'[instrumental]'}`);option.value=String(line.index);select.append(option);}
  select.value=String(initialLine);
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
  const uri=SpotifyPlayer.GetUri();if(!uri)throw new Error('Play a track before comparing TTML');
  const root=dialog(doc,'Compare TTML A/B');root.classList.add('vv-split-dialog');
  const win=doc.defaultView!;
  const title=element(doc,'p',Spicetify.Player.data?.item?.metadata?.title??uri);title.className='vv-split-track';root.append(title);
  const status=element(doc,'p','Load A and B. Both panels follow the same playback clock. Click any line to seek.');status.role='status';
  const grid=element(doc,'div');grid.className='vv-split-grid';root.append(grid);
  type WordView={element:HTMLElement;start:number;end:number};
  type LineView={element:HTMLElement;start:number;end:number;words:WordView[]};
  type Side={data:any;rows:LineView[];view:HTMLElement;name:HTMLElement;selected:number;request:number;manualUntil:number;input:HTMLInputElement};
  const sides:Record<string,Side>={};let closed=false;let mismatched=false;
  const diffLabel=element(doc,'label');const diff=element(doc,'input');diff.type='checkbox';diff.checked=true;diffLabel.append(diff,' Highlight differences');
  const summary=element(doc,'span');summary.className='vv-split-summary';
  const refreshDiff=()=>{
    for(const [label,side] of Object.entries(sides))side.rows.forEach((row,index)=>{
      const other=sides[label==='A'?'B':'A'];
      const kind=side.data&&other?.data?comparisonDifference(side.data.Content[index],other.data.Content[index]):'';
      row.element.dataset.diff=diff.checked?kind:'';
    });
    if(sides.A?.data&&sides.B?.data)summary.textContent=`${changedTTMLLines(sides.A.data.Content,sides.B.data.Content)} differing lines · text / timing`;
  };
  diff.onchange=refreshDiff;
  const valid=()=>!closed&&SpotifyPlayer.GetUri()===uri;
  const seek=(position:number)=>{if(valid())SpotifyPlayer.Seek(Math.max(0,position));};
  for(const label of ['A','B']){
    const panel=element(doc,'section');panel.className='vv-split-side';panel.setAttribute('aria-label',`Version ${label}`);
    const header=element(doc,'div');header.className='vv-split-side-header';
    const badge=element(doc,'strong',label);const name=element(doc,'span','No TTML loaded');name.className='vv-split-filename';
    const input=element(doc,'input');input.type='file';input.accept='.ttml';input.setAttribute('aria-label',`Load version ${label}`);
    const view=element(doc,'div');view.className='vv-split-lyrics';view.tabIndex=0;view.setAttribute('aria-label',`Lyrics ${label}`);view.append(element(doc,'p',`Choose a TTML file for side ${label}`));
    const side:Side={data:null,rows:[],view,name,selected:0,request:0,manualUntil:0,input};sides[label]=side;
    const mark=button(doc,`Add note to ${label}`,()=>{if(!side.data||!valid())return;reviewLyrics(doc,{...side.data,reviewFileName:`[${label}] ${side.data.reviewFileName}`},side.selected);});mark.disabled=true;
    header.append(badge,name,input,mark);panel.append(header,view);grid.append(panel);
    for(const event of ['wheel','pointerdown'])view.addEventListener(event,()=>side.manualUntil=win.performance.now()+4000,{passive:true});
    input.onchange=async()=>{
      const file=input.files?.[0];if(!file)return;const request=++side.request;
      try{
        if(!valid())throw new Error('Track changed. Reopen comparison.');
        if(file.size>5*1024*1024)throw new Error('TTML must be smaller than 5 MB');
        const parsed=await ParseTTML(await file.text());
        if(!parsed?.Result?.Content?.length)throw new Error('This TTML has no valid lyric lines');
        if(!valid()||request!==side.request)return;
        side.data={...parsed.Result,reviewFileName:file.name};side.rows=[];side.selected=0;side.manualUntil=0;
        name.textContent=file.name;name.title=file.name;view.replaceChildren();
        const appendWords=(parent:HTMLElement,parts:any[],fallback:{start:number;end:number},words:WordView[])=>{
          parts.forEach((part,index)=>{
            const word=element(doc,'span',part.Text??'');word.className='vv-split-word';
            const timing=comparisonTiming(part);
            parent.append(word);
            if(!part.IsPartOfWord&&index<parts.length-1&&!/\s$/.test(part.Text??''))parent.append(doc.createTextNode(' '));
            words.push({element:word,start:timing.start??fallback.start,end:timing.end??fallback.end});
          });
        };
        side.data.Content.forEach((line:any,index:number)=>{
          const row=element(doc,'button');row.type='button';row.className='vv-split-line';row.onclick=()=>{side.selected=index;side.manualUntil=0;seek(comparisonTiming(line).start);};
          const timing=comparisonTiming(line);const words:WordView[]=[];
          const text=element(doc,'span');text.className='vv-split-line-text';
          if(line.Lead?.Syllables?.length)appendWords(text,line.Lead.Syllables,timing,words);
          else text.textContent=quoteLineText(line)||'♪';
          row.append(text);
          for(const background of line.Background??[]){const backing=element(doc,'span');backing.className='vv-split-backing';appendWords(backing,background.Syllables??[],timing,words);row.append(backing);}
          if(line.OppositeAligned)row.classList.add('vv-split-duet');
          const stamp=element(doc,'small',`${(timing.start/1000).toFixed(2)} — ${(timing.end/1000).toFixed(2)}s`);row.append(stamp);
          side.rows.push({element:row,...timing,words});view.append(row);
        });
        mark.disabled=false;status.textContent=`Loaded ${label}: ${file.name}`;refreshDiff();
      }catch(error){if(!closed&&request===side.request)status.textContent=(error as Error).message;}
    };
  }
  const toolbar=element(doc,'div');toolbar.className='vv-split-toolbar';
  const play=button(doc,'Play / Pause',()=>{if(valid())Spicetify.Player.togglePlay();});
  const clock=element(doc,'span');clock.className='vv-split-clock';
  const progress=element(doc,'input');progress.type='range';progress.min='0';progress.step='10';progress.value='0';progress.setAttribute('aria-label','Playback position');
  let dragging=false;progress.onpointerdown=()=>dragging=true;progress.onchange=()=>{seek(Number(progress.value));dragging=false;};progress.onpointercancel=()=>dragging=false;
  const returnToCurrent=button(doc,'Current line',()=>{for(const side of Object.values(sides)){side.manualUntil=0;side.view.querySelector('.is-active')?.scrollIntoView({block:'center',behavior:'smooth'});}});
  toolbar.append(button(doc,'−5 s',()=>seek(GetProgress()-5000)),play,button(doc,'+5 s',()=>seek(GetProgress()+5000)),progress,clock,returnToCurrent,diffLabel,summary);
  root.append(toolbar,status);
  const format=(ms:number)=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
  let lastUpdate=0;
  const stop=onAnimationFrame((now)=>{
    if(now-lastUpdate<33)return;lastUpdate=now;
    if(!valid()){
      if(!closed&&!mismatched){mismatched=true;status.textContent='Track changed. Close and reopen comparison for the new song.';root.querySelectorAll<HTMLButtonElement|HTMLInputElement>('input,button:not([aria-label="Close"])').forEach(control=>control.disabled=true);}
      return;
    }
    const position=GetProgress();const duration=Math.max(1,Number(Spicetify.Player.getDuration())||1);
    progress.max=String(Math.max(1,duration));if(!dragging)progress.value=String(Math.max(0,position));
    clock.textContent=`${format(position)} / ${format(duration)}`;
    const reduce=win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for(const side of Object.values(sides)){
      let activeIndex=-1;
      side.rows.forEach((row,index)=>{
        const active=position>=row.start&&position<row.end;
        const wasActive=row.element.classList.contains('is-active');
        if(wasActive!==active)row.element.classList.toggle('is-active',active);
        const sung=position>=row.end;if(row.element.classList.contains('is-sung')!==sung)row.element.classList.toggle('is-sung',sung);
        if(active){if(activeIndex<0)activeIndex=index;if(!wasActive&&win.performance.now()>side.manualUntil&&activeIndex===index)row.element.scrollIntoView({block:'center',behavior:reduce?'instant':'smooth'});}
        for(const word of row.words){const fill=word.end<=word.start?(position>=word.start?100:0):Math.max(0,Math.min(100,(position-word.start)/(word.end-word.start)*100));const value=`${Math.round(fill)}%`;if(word.element.style.getPropertyValue('--word-fill')!==value)word.element.style.setProperty('--word-fill',value);}
      });
      if(activeIndex>=0)side.selected=activeIndex;
    }
  },win);
  root.addEventListener('close',()=>{closed=true;stop();for(const side of Object.values(sides))side.request++;},{once:true});
}
