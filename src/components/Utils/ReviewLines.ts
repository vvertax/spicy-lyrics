import { quoteLineText } from "./QuoteText.ts";
export type ReviewLine = { key:string; index:number; backgroundIndex?:number; text:string; timeMs:number; endMs:number };
export function reviewLines(data:any):ReviewLine[] {
  const result:ReviewLine[]=[];
  const add=(part:any,index:number,backgroundIndex?:number)=>{
    const voice=part.Lead??part;
    result.push({key:`${index}:${backgroundIndex??"lead"}`,index,backgroundIndex,
      text:quoteLineText(part.Lead||typeof part.Text==="string"?part:{Lead:part}),
      timeMs:Math.round((voice.StartTime??part.StartTime??0)*1000),endMs:Math.round((voice.EndTime??part.EndTime??voice.StartTime??0)*1000)});
  };
  for(const [index,line] of (data.Content??[]).entries()) { add(line,index); for(const [bg,part] of (line.Background??[]).entries())add(part,index,bg); }
  return result;
}
export function reviewTime(ms:number) {const s=Math.max(0,ms)/1000;return `${Math.floor(s/60)}:${(s%60).toFixed(2).padStart(5,"0")}`;}
