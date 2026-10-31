import { createLyricsAnimationSession } from "../../utils/Lyrics/Animator/Lyrics/LyricsAnimator.ts";
import { getLyricsBetweenShow, type LyricsSyllable } from "../../utils/Lyrics/lyrics.ts";
import Emphasize from "../../utils/Lyrics/Applyer/Utils/Emphasize.ts";
import { IsLetterCapable, MinLetterCapableDuration } from "../../utils/Lyrics/Applyer/Utils/IsLetterCapable.ts";
import { SplitLetters } from "../../utils/Lyrics/Applyer/Utils/SplitLetters.ts";
import { StripZeroWidth } from "../../utils/Lyrics/Applyer/Utils/StripZeroWidth.ts";
import { getIdleLyricsScale, getIdleEmphasisLyricsScale } from "../../utils/Lyrics/Animator/Shared.ts";
import { $simpleLyricsMode, $minimalLyricsMode } from "../../utils/stores.ts";
import isRtl from "../../utils/Lyrics/isRtl.ts";
import { quoteLineText } from "./QuoteText.ts";
import { comparisonTiming } from "./ReviewModel.ts";

/** The same DOM vocabulary and animator as the main lyrics, with a private model. */
export function renderComparisonLyrics(view:HTMLElement, data:any, seek:(index:number,start:number)=>void) {
  const doc=view.ownerDocument;
  const type=data.Type==='Syllable'?'Syllable':'Line';
  const container=doc.createElement('div');container.className='SpicyLyricsScrollContainer';container.dataset.lyricsType=type;if(data.Content.some((line:any)=>line.OppositeAligned))container.classList.add('HasDuetLines');
  const lines:LyricsSyllable[]=[];
  const rows:{element:HTMLElement;start:number;end:number;words:never[]}[]=[];
  const makeLine=(source:any,index:number,background=false)=>{
    const timing=comparisonTiming(source);
    const next=data.Content[index+1];const nextStart=Number(next?.Lead?.StartTime??next?.StartTime??0)*1000;
    if(!background&&$minimalLyricsMode.get()&&nextStart>timing.end&&nextStart-timing.end<getLyricsBetweenShow()*1000)timing.end=nextStart;
    const element=doc.createElement('div');element.className='line NotSung vv-split-line';
    element.tabIndex=0;element.role='button';element.title=`${(timing.start/1000).toFixed(2)} — ${(timing.end/1000).toFixed(2)}s`;
    element.onclick=()=>seek(index,timing.start);
    element.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();seek(index,timing.start);}};
    if(background)element.classList.add('bg-line');
    const model:LyricsSyllable={HTMLElement:element,StartTime:timing.start,EndTime:timing.end,TotalTime:timing.end-timing.start,Syllables:{Lead:[]},BGLine:background};
    const parts=source.Lead?.Syllables??source.Syllables??[];
    let group:HTMLElement|null=null;
    parts.forEach((part:any,index:number)=>{
      const text=StripZeroWidth(part.Text??'');const duration=(part.EndTime-part.StartTime)*1000;
      let word:HTMLElement=doc.createElement('span');
      const letters=!data.experimentalWordSync&&duration>=MinLetterCapableDuration()?SplitLetters(text):[];
      if(letters.length&&IsLetterCapable(letters.length,duration)&&!isRtl(text)){
        word=doc.createElement('div');Emphasize(letters,word,{...part,Text:text},background,model.Syllables!.Lead);
        if(!$simpleLyricsMode.get()){
          word.style.setProperty('--text-shadow-opacity','0%');word.style.setProperty('--text-shadow-blur-radius','4px');
          word.style.scale=String(getIdleEmphasisLyricsScale());word.style.transform='translateY(calc(var(--DefaultLyricsSize) * 0.02))';
        }
      }else{
        word.className='word';word.textContent=text;
        if(!$simpleLyricsMode.get()){
          word.style.setProperty('--gradient-position','-20%');word.style.scale=String(getIdleLyricsScale());
          word.style.transform='translateY(calc(var(--DefaultLyricsSize) * 0.01))';
        }
        const time=comparisonTiming(part);
        model.Syllables!.Lead.push({HTMLElement:word,StartTime:time.start,EndTime:time.end,TotalTime:time.end-time.start,BGWord:background});
      }
      const last=index===parts.length-1;const join=!last&&part.IsPartOfWord===true;
      if(last)word.classList.add('LastWordInLine');else if(join)word.classList.add('PartOfWord');
      if(isRtl(text))element.classList.add('rtl');
      if(join||group){if(!group){group=doc.createElement('span');group.className='word-group';element.append(group);}group.append(word);}else element.append(word);
      if(!join){group=null;if(!last&&!/\s$/.test(text))element.append(doc.createTextNode(' '));}
    });
    if(!parts.length)element.textContent=quoteLineText(source)||'♪';
    if(source.OppositeAligned)element.classList.add('OppositeAligned');
    lines.push(model);container.append(element);
    if(!background)rows.push({element,...timing,words:[]});
  };
  data.Content.forEach((source:any,index:number)=>{
    makeLine(source,index);
    for(const background of source.Background??[])makeLine({...background,OppositeAligned:source.OppositeAligned},index,true);
  });
  view.replaceChildren(container);
  const session=createLyricsAnimationSession(type,lines);
  return {...session,rows};
}
