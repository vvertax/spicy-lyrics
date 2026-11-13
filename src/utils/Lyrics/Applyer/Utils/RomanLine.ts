// Pronunciation rows adapted from Ruytha's RomanLine.ts. Original lyric animation stays intact.
import { onAnimationFrame } from "../../../AnimationFrameLoop.ts";
import GetProgress from "../../../Gets/GetProgress.ts";
import { timeOffset } from "../../Animator/Shared.ts";
import { RomanizeBelow, RomanizedLine, RomanizedSyllableParts, type RomanPart } from "./PickDisplayText.ts";

type Row={parts:HTMLElement[];timing:RomanPart[];fills:number[]};
const rows=new Map<HTMLElement,Row>();
const loops=new Map<Window,()=>void>();
export function ClearRomanRows():void {
  for(const stop of loops.values())stop();loops.clear();
  for(const el of rows.keys()){el.parentElement?.classList.remove('HasRomanLine');el.remove();}rows.clear();
}
export function FillRomanRow(row:HTMLElement,parts:RomanPart[]):void {
  const entry:Row={parts:[],timing:parts,fills:parts.map(()=>-1)};
  row.replaceChildren();
  for(const part of parts){const span=row.ownerDocument.createElement('span');span.className='SL_RomanPart';span.textContent=part.text;row.append(span);entry.parts.push(span);}
  row.classList.add('SL_RomanSynced');rows.set(row,entry);
  const win=row.ownerDocument.defaultView!;
  if(!loops.has(win))loops.set(win,onAnimationFrame(()=>{
    const position=GetProgress()+timeOffset;
    for(const [element,entry] of rows){
      if(element.ownerDocument.defaultView!==win||!element.isConnected)continue;
      entry.timing.forEach((part,i)=>{
        const start=Math.round(part.start*1000),end=Math.max(start+1,Math.round(part.end*1000));
        const fill=Math.round(Math.max(0,Math.min(1,(position-start)/(end-start)))*1000)/1000;
        if(entry.fills[i]===fill)return;entry.fills[i]=fill;entry.parts[i].style.setProperty('--SL_RomanFill',String(fill));
      });
    }
  },win));
}
export function AppendRomanLine(element:HTMLElement,text:string,parts?:RomanPart[]):void {
  if(!text)return;
  const row=element.ownerDocument.createElement('div');row.className='SL_RomanLine';
  if(parts?.length)FillRomanRow(row,parts);else row.textContent=text;
  element.append(row);element.classList.add('HasRomanLine');
}
/** Align vocal groups with the same ordered lead/backing models used by the renderer. */
export function romanizationSources(lyrics:any):any[] {
  if(lyrics.Type==='Static')return lyrics.Lines??[];
  if(lyrics.Type==='Line')return (lyrics.Content??[]).filter((line:any)=>line.Type!=='Interlude');
  return (lyrics.Content??[]).filter((line:any)=>line.Lead).flatMap((line:any)=>[line.Lead,...(line.Background??[])]);
}
export function ApplyRomanRows(lyrics:any,models:{HTMLElement:HTMLElement;DotLine?:boolean}[],enabled:boolean):void {
  ClearRomanRows();if(!RomanizeBelow(enabled))return;
  const vocal=models.filter(line=>!line.DotLine),sources=romanizationSources(lyrics);
  sources.forEach((source:any,i:number)=>{
    const element=vocal[i]?.HTMLElement;if(!element)return;
    if(lyrics.Type==='Syllable'){
      const parts=RomanizedSyllableParts(source.Syllables??[]);AppendRomanLine(element,parts.map(part=>part.text).join('').trim(),parts);
    }else{
      const text=RomanizedLine(source);AppendRomanLine(element,text,lyrics.Type==='Line'?[{text,start:source.StartTime,end:source.EndTime}]:undefined);
    }
  });
}
