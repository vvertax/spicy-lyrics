import { reviewLines, reviewTime } from "./ReviewLines.ts";
import { translateUi } from "../../utils/i18n/translate.ts";
import { $uiLanguage } from "../../utils/stores.ts";
import { bindComparisonDiff } from "./ComparisonDiffUI.ts";
import { createAuthorCard, knownAuthor } from "./AuthorProfile.ts";
import { openTTMLCheck } from "./TTMLCheckPanel.ts";
import { followComparisonLine } from "./ComparisonFollow.ts";
import { bindTTMLDrop } from "./TTMLDrop.ts";
import { renderComparisonLyrics } from "./ComparisonRenderer.ts";
import GetProgress from "../../utils/Gets/GetProgress.ts";
import { onAnimationFrame } from "../../utils/AnimationFrameLoop.ts";
import { authorHandle } from "./ReviewModel.ts";
import { toast } from "sonner";
import { getDisplayedLyrics } from "../../utils/Lyrics/DisplayedLyrics.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { ParseTTML } from "../../utils/Lyrics/manager/parseTTML.ts";
import { quoteLineText } from "./QuoteText.ts";
import { Icons } from "../Styling/Icons.ts";

type Note = { id:string; uri:string; title:string; file:string; line:number; text:string; timeMs:number; kind:string; comment:string; created:string; backgroundIndex?:number };
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
  const data=getDisplayedLyrics(SpotifyPlayer.GetUri());
  if (Array.isArray(data?.Content)) return data;
  throw new Error('Open a song with lyrics first');
}
export function AddReviewMenuRows(menu:HTMLElement, add:(button:HTMLButtonElement,label:string)=>void) {
  const doc=menu.ownerDocument;
  for (const [label, icon, open] of [
    ['Find Author Works',Icons.FindAuthorWorks,()=>authorSearch(doc)],
    ['Review Lyrics',Icons.ReviewLyrics,()=>reviewLyrics(doc)],
    ['Check TTML',Icons.ReviewLyrics,()=>openTTMLCheck(doc)],
    ['Compare TTML A/B',Icons.CompareTTML,()=>compareTTML(doc)],
  ] as const) {
    const row=element(doc,'button');row.type='button';row.innerHTML=icon;
    add(row,label);row.onclick=()=>{ try { open(); } catch(error) {toast.error((error as Error).message);} };
  }
}
function authorSearch(doc:Document) {
  const root=dialog(doc,'Find Author Works');root.classList.add('vv-author-dialog');
  const emblem=element(doc,'span');emblem.className='vv-author-emblem';emblem.innerHTML=Icons.FindAuthorWorks;root.querySelector('header h2')!.prepend(emblem);
  const form=element(doc,'form');const input=element(doc,'input');input.placeholder='Username, e.g. vvertax. or july';input.setAttribute('aria-label','Author username');input.required=true;input.maxLength=100;
  const submit=element(doc,'button','Search');submit.type='submit';form.append(input,submit);
  const message=element(doc,'p','Enter a username to open their public profile.');message.role='status';
  const results=element(doc,'div');results.className='vv-author-results';
  submit.textContent='Show profile';
  form.onsubmit=event=>{
    event.preventDefault(); const name=authorHandle(input.value);
    if (!name) {message.textContent='Enter a username, not a link.';return;}
    message.textContent='Profile link ready.';
    root.classList.add('has-results');
    results.replaceChildren(createAuthorCard(doc,knownAuthor(name)??{username:name}));
  };
  root.append(form,message,results);input.focus();
}
export function reviewLyrics(doc:Document, supplied?:any, initialLine=0) {
  const data=supplied??currentLyrics(),uri=SpotifyPlayer.GetUri();if(!uri)throw new Error('No current track');
  const t=(text:string)=>translateUi(text,$uiLanguage.get());
  const title=Spicetify.Player.data?.item?.metadata?.title??uri,file=data.reviewFileName??t('Current lyrics');
  const root=dialog(doc,t('Review Lyrics'));root.classList.add('vv-review-workspace');root.setAttribute('data-i18n-ignore','');
  root.querySelector('header button')!.setAttribute('aria-label',t('Close'));
  const track=element(doc,'p',`${title} · ${file}`);track.className='vv-review-track';root.append(track);
  const lines=reviewLines(data);let selected=lines.find(line=>line.index===initialLine)??lines[0];
  const layout=element(doc,'div');layout.className='vv-review-layout';
  const picker=element(doc,'section');picker.className='vv-review-picker';
  const search=element(doc,'input');search.type='search';search.placeholder=t('Search lyric lines…');search.setAttribute('aria-label',t('Search lyric lines…'));
  const voices=element(doc,'select');voices.setAttribute('aria-label',t('Vocal part'));
  for(const [value,label] of [['all','All vocals'],['lead','Lead vocal'],['background','Backing vocals']]){const option=element(doc,'option',t(label));option.value=value;voices.append(option);}
  const choices=element(doc,'div');choices.className='vv-review-line-list';choices.setAttribute('aria-label',t('Lyric line'));
  picker.append(search,voices,choices);
  const editor=element(doc,'section');editor.className='vv-review-editor';
  const selectedLabel=element(doc,'strong',t('Selected line')),preview=element(doc,'p'),timing=element(doc,'span');preview.className='vv-review-selected-text';timing.className='vv-review-time';
  const seek=button(doc,t('Listen to selected line'),()=>{if(selected&&SpotifyPlayer.GetUri()===uri)SpotifyPlayer.Seek(selected.timeMs);else toast.error(t('Play this track first'));});
  let selectedKind='Wrong word';
  const issueSelection=element(doc,'summary',`${t('Problem type')}: ${t(selectedKind)}`);issueSelection.className='vv-review-issue-selection';issueSelection.role='status';
  const kind=element(doc,'details');kind.className='vv-review-problems';kind.append(issueSelection);
  const issueButtons:HTMLButtonElement[]=[];
  for(const [group,names] of [
    ['Text',['Wrong word','Missing text','Extra text','Punctuation / spelling']],
    ['Timing',['Starts too early','Starts too late','Wrong end / duration']],
    ['Markup',['Wrong syllable splits','Wrong voice / side','Wrong line break']],
    ['Backing vocals',['Missing backing vocal','Extra backing vocal','Wrong backing text','Backing vocal timing']],
    ['Other',['Translation / romanization','Other issue']],
  ] as const){
    const section=element(doc,'div');section.className='vv-review-problem-group';section.append(element(doc,'span',t(group)));
    for(const name of names){const choice=button(doc,t(name),()=>{selectedKind=name;kind.open=false;issueSelection.textContent=`${t('Problem type')}: ${t(name)}`;for(const item of issueButtons)item.setAttribute('aria-pressed',String(item===choice));});choice.setAttribute('aria-pressed',String(name===selectedKind));issueButtons.push(choice);section.append(choice);}kind.append(section);
  }
  const comment=element(doc,'textarea');comment.placeholder=t('Wrong word, starts too early, missing background vocal…');comment.setAttribute('aria-label',t('Review comment'));comment.maxLength=2000;
  const status=element(doc,'p');status.role='status';status.className='vv-review-feedback';
  const partLabel=(line:{backgroundIndex?:number})=>line.backgroundIndex===undefined?t('Lead vocal'):`${t('Backing vocals')} ${line.backgroundIndex+1}`;
  const updateSelected=()=>{preview.textContent=selected?.text||t('[instrumental]');timing.textContent=selected?`${partLabel(selected)} · ${reviewTime(selected.timeMs)} — ${reviewTime(selected.endMs)}`:'';seek.disabled=!selected;};
  const renderChoices=()=>{
    choices.replaceChildren();const query=search.value.trim().toLocaleLowerCase();
    for(const line of lines){if(voices.value==='lead'&&line.backgroundIndex!==undefined||voices.value==='background'&&line.backgroundIndex===undefined||query&&!line.text.toLocaleLowerCase().includes(query))continue;
      const row=button(doc,'',()=>{selected=line;updateSelected();renderChoices();});row.className='vv-review-line';row.setAttribute('aria-pressed',String(selected?.key===line.key));if(line.backgroundIndex!==undefined)row.classList.add('is-background');
      row.append(element(doc,'span',`${line.index+1} · ${partLabel(line)} · ${reviewTime(line.timeMs)}`),element(doc,'strong',line.text||t('[instrumental]')));choices.append(row);
    }if(!choices.childElementCount)choices.append(element(doc,'p',t('No matching lines.')));
  };
  search.oninput=renderChoices;voices.onchange=renderChoices;
  const list=element(doc,'div');list.className='vv-review-notes';
  const report=()=>readNotes().filter(note=>note.uri===uri);
  const reportText=()=>`${title}\nhttps://open.spotify.com/track/${uri.split(':').pop()}\n\n`+report().map(note=>`[${reviewTime(note.timeMs)}] ${t(note.kind)} · ${note.file} · ${t('Lyric line')} ${note.line+1} · ${partLabel(note)}\n${note.text}\n${note.comment}`).join('\n\n');
  const renderNotes=()=>{
    list.replaceChildren();const notes=report();
    if(!notes.length){const empty=element(doc,'p',t('No notes for this track yet.'));empty.className='vv-review-empty';list.append(empty);}
    for(const note of notes){
      const card=element(doc,'article');card.className='vv-review-note';
      const heading=element(doc,'div');heading.className='vv-review-note-heading';
      const problem=element(doc,'strong',t(note.kind));problem.className='vv-review-note-kind';
      const time=button(doc,reviewTime(note.timeMs),()=>{if(SpotifyPlayer.GetUri()===uri)SpotifyPlayer.Seek(note.timeMs);else toast.error(t('Play this track first'));});time.className='vv-review-note-time';time.title=t('Go to line');time.setAttribute('aria-label',`${t('Go to line')} · ${reviewTime(note.timeMs)}`);
      heading.append(problem,time);
      const meta=element(doc,'div');meta.className='vv-review-note-meta';meta.append(element(doc,'span',partLabel(note)),element(doc,'span',note.file));
      const quote=element(doc,'blockquote',note.text);quote.className='vv-review-note-quote';
      const comment=element(doc,'p',note.comment);comment.className='vv-review-note-comment';
      const remove=button(doc,t('Delete'),()=>{storeNotes(readNotes().filter(item=>item.id!==note.id));renderNotes();});remove.className='vv-review-note-delete';
      const footer=element(doc,'div');footer.className='vv-review-note-footer';footer.append(element(doc,'span',t('Review comment')),remove);
      card.append(heading,meta,quote,comment,footer);list.append(card);
    }
  };

  const save=button(doc,t('Save note'),()=>{
    if(!selected){status.textContent=t('Choose a line.');return;}if(!comment.value.trim()){status.textContent=t('Describe the issue first.');return;}
    try {storeNotes([...readNotes(),{id:crypto.randomUUID(),uri,title,file,line:selected.index,backgroundIndex:selected.backgroundIndex,text:selected.text,timeMs:selected.timeMs,kind:selectedKind,comment:comment.value.trim(),created:new Date().toISOString()}]);comment.value='';status.textContent=`✓ ${t('Note saved')}`;renderNotes();}catch{status.textContent=t('Could not save notes. Export existing notes to free storage.');}
  });save.className='vv-review-save';
  editor.append(selectedLabel,preview,timing,seek,kind,comment,save,status);
  layout.append(picker,editor);
  const exports=element(doc,'div');exports.className='vv-review-actions';exports.append(button(doc,t('Copy report'),()=>{void doc.defaultView!.navigator.clipboard.writeText(reportText()).then(()=>{status.textContent=t('Report copied');}).catch(()=>{status.textContent=t('Clipboard unavailable. Use Download report.');});}),button(doc,t('Download report'),()=>download(doc,'lyrics-review.txt',reportText(),'text/plain;charset=utf-8')),button(doc,t('Export JSON'),()=>download(doc,'lyrics-review.json',JSON.stringify(report(),null,2),'application/json')));
  const body=element(doc,'div');body.className='vv-review-body';body.append(layout,element(doc,'h3',t('Saved notes')),list,exports);root.append(body);updateSelected();renderChoices();renderNotes();
  choices.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({block:'nearest'});
}

const comparisons = new WeakMap<Document, () => void>();
export function compareTTML(doc:Document) {
  const existing = comparisons.get(doc);
  if (existing) { existing(); return; }
  const uri=SpotifyPlayer.GetUri();if(!uri)throw new Error('Play a track before comparing TTML');
  const page=doc.querySelector<HTMLElement>('#SpicyLyricsPage');
  const host=page?.querySelector<HTMLElement>('.ContentBox');
  if(!page||!host)throw new Error('Open the lyrics page first');
  const win=doc.defaultView!;
  const previous=doc.activeElement as HTMLElement|null;
  const root=element(doc,'section');root.className='vv-page-comparison';root.setAttribute('aria-label','Compare TTML A/B');
  const heading=element(doc,'header');heading.className='vv-comparison-heading';
  const iconButton=(label:string,icon:string,action:()=>void)=>{
    const control=button(doc,'',action);control.className='vv-comparison-control';control.innerHTML=icon;
    control.setAttribute('aria-label',label);control.title=label;return control;
  };
  const exit=iconButton('Exit comparison',Icons.Close,()=>closeComparison());
  heading.append(element(doc,'h2','Compare TTML A/B'),exit);root.append(heading);
  const lyricsStyle=page.querySelector<HTMLElement>('.LyricsContent');
  if(lyricsStyle)root.style.setProperty('--comparison-font',win.getComputedStyle(lyricsStyle).fontFamily);
  page.classList.add('VV_ComparingTTML');host.append(root);

  const title=element(doc,'span',Spicetify.Player.data?.item?.metadata?.title??uri);title.className='vv-split-track';heading.querySelector('h2')!.append(title);
  const status=element(doc,'p');status.role='status';
  const grid=element(doc,'div');grid.className='vv-split-grid';root.append(grid);
  type WordView={element:HTMLElement;start:number;end:number};
  type LineView={element:HTMLElement;start:number;end:number;words:WordView[]};
  type Side={data:any;rows:LineView[];view:HTMLElement;name:HTMLElement;selected:number;request:number;manualUntil:number;followed:number;input:HTMLInputElement;renderer?:ReturnType<typeof renderComparisonLyrics>};
  const sides:Record<string,Side>={};let closed=false;const dropCleanup:(()=>void)[]=[];
  const options=element(doc,'div');options.className='vv-split-toolbar vv-comparison-options';heading.insertBefore(options,exit);
  const differences=bindComparisonDiff(options,sides);
  const valid=()=>!closed&&root.isConnected&&SpotifyPlayer.GetUri()===uri;
  const seek=(position:number)=>{if(valid())SpotifyPlayer.Seek(Math.max(0,position));};
  for(const label of ['A','B']){
    const panel=element(doc,'section');panel.className='vv-split-side LyricsContainer';panel.setAttribute('aria-label',`Version ${label}`);
    const header=element(doc,'div');header.className='vv-split-side-header';
    const badge=element(doc,'strong',label);const name=element(doc,'span','');name.className='vv-split-filename';
    const input=element(doc,'input');input.type='file';input.accept='.ttml';input.hidden=true;input.setAttribute('aria-label',`Load version ${label}`);
    const view=element(doc,'div');view.className='vv-split-lyrics LyricsContent';view.tabIndex=0;view.setAttribute('aria-label',`Lyrics ${label}`);const empty=element(doc,'div');empty.className='vv-comparison-empty';
    const emptyIcon=element(doc,'div');emptyIcon.className='vv-comparison-empty-icon';emptyIcon.innerHTML=Icons.LyricsManager;
    const choose=button(doc,`Load version ${label}`,()=>input.click());choose.className='vv-comparison-load';
    const hint=element(doc,'p','Select a TTML file to compare its lyrics');
    empty.append(emptyIcon,choose,hint);view.append(empty);
    const side:Side={data:null,rows:[],view,name,selected:0,request:0,manualUntil:0,followed:-1,input};sides[label]=side;
    const mark=iconButton(`Add note to ${label}`,Icons.ReviewLyrics,()=>{if(!side.data||!valid())return;reviewLyrics(doc,{...side.data,reviewFileName:`[${label}] ${side.data.reviewFileName}`},side.selected);});mark.disabled=true;
    const load=iconButton(`Load version ${label}`,Icons.LoadTTML,()=>{input.value='';input.click();});
    header.append(badge,name,input,load,mark);panel.append(header,view);grid.append(panel);
    for(const event of ['wheel','pointerdown','touchstart','keydown'])view.addEventListener(event,()=>{side.manualUntil=win.performance.now()+4000;side.followed=-1;},{passive:true});
    const loadSide=async(file:File)=>{
      const request=++side.request;
      try{
        if(!valid())throw new Error('Track changed. Reopen comparison.');
        if(file.size>5*1024*1024)throw new Error('TTML must be smaller than 5 MB');
        const parsed=await ParseTTML(await file.text());
        if(!parsed?.Result?.Content?.length)throw new Error('This TTML has no valid lyric lines');
        if(!valid()||request!==side.request)return;
        side.data={...parsed.Result,reviewFileName:file.name};side.rows=[];side.selected=0;side.manualUntil=0;side.followed=-1;
        name.textContent=file.name;name.title=file.name;view.replaceChildren();
        side.renderer?.destroy();
        side.renderer=renderComparisonLyrics(view,side.data,(index,start)=>{side.selected=index;side.manualUntil=0;seek(start);});
        side.rows=side.renderer.rows;
        mark.disabled=false;status.textContent='';differences.refresh();
      }catch(error){if(!closed&&request===side.request)status.textContent=(error as Error).message;}
    };
    input.onchange=()=>{if(input.files?.[0])void loadSide(input.files[0]);};
    dropCleanup.push(bindTTMLDrop(panel,file=>{void loadSide(file);}));
  }
  root.append(status);
  const scrollLine=(view:HTMLElement,line:HTMLElement,behavior:ScrollBehavior)=>{
    const offset=line.getBoundingClientRect().top-view.getBoundingClientRect().top;
    view.scrollTo({top:view.scrollTop+offset-view.clientHeight*.4,behavior});
  };
  const stop=onAnimationFrame(()=>{
    if(!valid()){
      if(!closed)closeComparison();
      return;
    }
    const position=GetProgress();
    const reduce=win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for(const side of Object.values(sides)){
      side.renderer?.animate(position);
      let activeIndex=-1;
      side.rows.forEach((row,index)=>{
        const active=position>=row.start&&position<row.end;
        const wasActive=row.element.classList.contains('is-active');
        if(wasActive!==active)row.element.classList.toggle('is-active',active);
        const sung=position>=row.end;if(row.element.classList.contains('is-sung')!==sung)row.element.classList.toggle('is-sung',sung);
        if(active&&activeIndex<0)activeIndex=index;
        for(const word of row.words){const fill=word.end<=word.start?(position>=word.start?100:0):Math.max(0,Math.min(100,(position-word.start)/(word.end-word.start)*100));const value=`${Math.round(fill)}%`;if(word.element.style.getPropertyValue('--word-fill')!==value)word.element.style.setProperty('--word-fill',value);}
      });
      if(activeIndex>=0) {
        side.selected=activeIndex;
        followComparisonLine(side,activeIndex,win.performance.now(),()=>{
          scrollLine(side.view,side.rows[activeIndex].element,reduce?'instant':'smooth');
        });
      }
    }
  },win);
  const escape=(event:KeyboardEvent)=>{
    if(event.key==='Escape'&&!doc.querySelector('dialog[open]')){event.preventDefault();event.stopPropagation();closeComparison();}
  };
  const observer=new MutationObserver(()=>{if(!root.isConnected||!page.isConnected)closeComparison();});
  function closeComparison(){
    if(closed)return;closed=true;dropCleanup.forEach(dispose=>dispose());differences.destroy();stop();observer.disconnect();
    doc.removeEventListener('keydown',escape,true);
    for(const side of Object.values(sides)){side.request++;side.renderer?.destroy();}
    comparisons.delete(doc);page!.classList.remove('VV_ComparingTTML');root.remove();
    if(previous?.isConnected)previous.focus();
  }
  comparisons.set(doc,closeComparison);
  observer.observe(doc.body,{childList:true,subtree:true});
  doc.addEventListener('keydown',escape,true);exit.focus();
}
