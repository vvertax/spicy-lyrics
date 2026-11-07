import { quoteLineText } from "./QuoteText.ts";
export const DIFF_CATEGORIES = ["text", "timing", "splits", "voice", "background", "added", "removed"] as const;
export type DiffCategory = typeof DIFF_CATEGORIES[number];
export type TextEdit = { kind: "equal" | "removed" | "added"; text: string };
export type DiffChange = { category: DiffCategory; field: string; before: string; after: string; partA?: number; partB?: number; partTextA?: string; partTextB?: string; backgroundA?: number; backgroundB?: number; edits?: TextEdit[] };
export type DiffPair = { a?: number; b?: number; categories: DiffCategory[]; changes: DiffChange[] };
const parts = (line: any): any[] => line?.Lead?.Syllables ?? line?.Syllables ?? [];
export const comparisonText = (line: any): string => typeof line?.Text === "string" ? line.Text : quoteLineText(line?.Lead ? line : { Lead: { Syllables: parts(line) } });
const normalized = (text: string) => text.replace(/\s+/gu, " ").trim();
const ms = (value: unknown) => Number.isFinite(Number(value)) ? Math.round(Number(value) * 1000) : 0;
const times = (line: any) => { const lead = line?.Lead ?? line; return [ms(lead?.StartTime), ms(lead?.EndTime)]; };
export function formatDiffTime(value: number) { const sign = value < 0 ? "−" : ""; const n = Math.abs(Math.round(value)); return `${sign}${String(Math.floor(n / 60000)).padStart(2,"0")}:${String(Math.floor(n / 1000) % 60).padStart(2,"0")}.${String(n % 1000).padStart(3,"0")}`; }
export function characterEdits(a: string, b: string): TextEdit[] {
  if (a === b) return [{ kind: "equal", text: a }];
  const x = Array.from(a), y = Array.from(b); let prefix = 0, suffix = 0;
  while (prefix < x.length && prefix < y.length && x[prefix] === y[prefix]) prefix++;
  while (suffix < x.length-prefix && suffix < y.length-prefix && x[x.length-1-suffix] === y[y.length-1-suffix]) suffix++;
  const aa=x.slice(prefix,x.length-suffix),bb=y.slice(prefix,y.length-suffix), result: TextEdit[]=[];
  const add=(kind:TextEdit["kind"], text:string)=>{ if(!text)return;const last=result.at(-1);if(last?.kind===kind)last.text+=text;else result.push({kind,text}); };
  add("equal",x.slice(0,prefix).join(""));
  if(aa.length*bb.length>250000){add("removed",aa.join(""));add("added",bb.join(""));}
  else {
    const width=bb.length+1, table=new Uint32Array((aa.length+1)*width);
    for(let i=aa.length-1;i>=0;i--)for(let j=bb.length-1;j>=0;j--)table[i*width+j]=aa[i]===bb[j]?table[(i+1)*width+j+1]+1:Math.max(table[(i+1)*width+j],table[i*width+j+1]);
    let i=0,j=0;while(i<aa.length||j<bb.length){if(i<aa.length&&j<bb.length&&aa[i]===bb[j]){add("equal",aa[i++]);j++;}else if(i<aa.length&&(j===bb.length||table[(i+1)*width+j]>=table[i*width+j+1]))add("removed",aa[i++]);else add("added",bb[j++]);}
  }
  add("equal",suffix?x.slice(-suffix).join(""):"");return result;
}
const bigrams=(text:string)=>{const s=normalized(text);const set=new Set<string>();for(let i=0;i<s.length-1;i++)set.add(s.slice(i,i+2));if(s.length===1)set.add(s);return set;};
/** Weighted sequence alignment: text anchors survive inserts and global retiming. */
export function alignComparisonLines(a:any[],b:any[], text=(line:any)=>comparisonText(line)): {a?:number;b?:number}[] {
  const at=a.map(line=>normalized(text(line))),bt=b.map(line=>normalized(text(line)));
  const positions=new Map<string,number[]>();bt.forEach((s,i)=>positions.set(s,[...(positions.get(s)??[]),i]));
  const offsets:number[]=[];at.forEach((s,i)=>{const indexes=positions.get(s);if(s&&indexes?.length===1)offsets.push(times(b[indexes[0]])[0]-times(a[i])[0]);});offsets.sort((x,y)=>x-y);const shift=offsets.length?offsets[Math.floor(offsets.length/2)]:0;
  const ag=at.map(bigrams),bg=bt.map(bigrams);
  const cost=(i:number,j:number)=>{const distance=Math.abs(times(a[i])[0]+shift-times(b[j])[0]);if(at[i]===bt[j])return .06*Math.min(distance/5000,1);let common=0;for(const v of ag[i])if(bg[j].has(v))common++;const similarity=2*common/Math.max(1,ag[i].size+bg[j].size);return .2+.9*(1-similarity)+.2*Math.min(distance/2500,1);};
  const out:{a?:number;b?:number}[]=[];
  // Bound memory for unusually large files; local look-ahead still finds inserts.
  if(a.length*b.length>2000000){let i=0,j=0;while(i<a.length&&j<b.length){if(at[i]===bt[j]||cost(i,j)<.65){out.push({a:i++,b:j++});continue;}const nextB=bt.indexOf(at[i],j+1),nextA=at.indexOf(bt[j],i+1);if(nextB>=0&&(nextA<0||nextB-j<=nextA-i)){while(j<nextB)out.push({b:j++});}else if(nextA>=0){while(i<nextA)out.push({a:i++});}else out.push({a:i++,b:j++});}while(i<a.length)out.push({a:i++});while(j<b.length)out.push({b:j++});return out;}
  const n=a.length,m=b.length,width=m+1,dirs=new Uint8Array((n+1)*width);let previous=Float64Array.from({length:width},(_,j)=>j*.62);
  for(let i=1;i<=n;i++){const current=new Float64Array(width);current[0]=i*.62;for(let j=1;j<=m;j++){const pair=previous[j-1]+cost(i-1,j-1),remove=previous[j]+.62,add=current[j-1]+.62;current[j]=Math.min(pair,remove,add);dirs[i*width+j]=current[j]===pair?0:current[j]===remove?1:2;}previous=current;}
  let i=n,j=m;while(i||j){const d=!i?2:!j?1:dirs[i*width+j];if(d===0)out.push({a:--i,b:--j});else if(d===1)out.push({a:--i});else out.push({b:--j});}return out.reverse();
}
export function compareTTMLData(a:any,b:any): DiffPair[] {
  const left=a?.Content??[],right=b?.Content??[];
  return alignComparisonLines(left,right).map(pair=>{
    const changes:DiffChange[]=[];
    const add=(category:DiffCategory,field:string,before:unknown,after:unknown,location:Partial<DiffChange>={})=>changes.push({category,field,before:String(before??""),after:String(after??""),...(category==="text"?{edits:characterEdits(String(before??""),String(after??""))}:{}),...location});
    const compare=(x:any,y:any,location:Partial<DiffChange>={})=>{
      const ax=comparisonText(x),by=comparisonText(y);
      if(ax!==by)add("text","Text",ax,by,{...location,edits:characterEdits(ax,by)});
      const tx=times(x),ty=times(y);
      for(const [field,va,vb] of [["Start",tx[0],ty[0]],["End",tx[1],ty[1]],["Duration",tx[1]-tx[0],ty[1]-ty[0]]] as const)if(Math.abs(vb-va)>=10)add("timing",field,`${formatDiffTime(va)}`,`${formatDiffTime(vb)} (${vb-va>=0?"+":""}${vb-va} ms)`,location);
      if(Boolean(x?.OppositeAligned)!==Boolean(y?.OppositeAligned))add("voice","Voice / side",x?.OppositeAligned?"Right":"Left",y?.OppositeAligned?"Right":"Left",location);
      const xp=parts(x),yp=parts(y);
      const segmentation=(p:any[])=>p.map(q=>`${q.Text??""}${q.IsPartOfWord?" +":" |"}`).join(" ");
      if((ax===by&&segmentation(xp)!==segmentation(yp))||JSON.stringify(xp.map(p=>!!p.IsPartOfWord))!==JSON.stringify(yp.map(p=>!!p.IsPartOfWord))&&xp.length===yp.length)add("splits","Syllable boundaries",segmentation(xp),segmentation(yp),location);
      for(const field of ["TranslatedText","TransliteratedText"]) { const v=(line:any)=>line?.[field]??line?.Lead?.[field]??"";if(v(x)!==v(y))add("text",field,v(x),v(y),location); }
      for(const p of alignComparisonLines(xp,yp,part=>String(part.Text??""))){if(p.a===undefined||p.b===undefined)continue;const xx=xp[p.a],yy=yp[p.b],partLocation={...location,partA:p.a,partB:p.b,partTextA:String(xx.Text??""),partTextB:String(yy.Text??"")};
        for(const field of ["StartTime","EndTime"]){const u=ms(xx[field]),v=ms(yy[field]);if(Math.abs(v-u)>=10)add("timing",field,formatDiffTime(u),`${formatDiffTime(v)} (${v-u>=0?"+":""}${v-u} ms)`,partLocation);}
        const durationX=ms(xx.EndTime)-ms(xx.StartTime),durationY=ms(yy.EndTime)-ms(yy.StartTime);if(Math.abs(durationY-durationX)>=10)add("timing","Duration",formatDiffTime(durationX),`${formatDiffTime(durationY)} (${durationY-durationX>=0?"+":""}${durationY-durationX} ms)`,partLocation);
        if((xx.TransliteratedText??"")!==(yy.TransliteratedText??""))add("text","TransliteratedText",xx.TransliteratedText??"",yy.TransliteratedText??"",partLocation);
      }
    };
    if(pair.a===undefined)add("added","Added line","",comparisonText(right[pair.b!]));
    else if(pair.b===undefined)add("removed","Removed line",comparisonText(left[pair.a]),"");
    else {
      const x=left[pair.a],y=right[pair.b];compare(x,y);
      if(a.Type!==b.Type)add("splits","Synchronization type",a.Type,b.Type);
      const ab=x.Background??[],bb=y.Background??[];
      for(const p of alignComparisonLines(ab,bb)){const location={backgroundA:p.a,backgroundB:p.b};if(p.a===undefined)add("background","Added backing vocal","",comparisonText(bb[p.b!]),location);else if(p.b===undefined)add("background","Removed backing vocal",comparisonText(ab[p.a]),"",location);else compare(ab[p.a],bb[p.b],location);}
    }
    return {...pair,changes,categories:[...new Set([...changes.map(c=>c.category),...changes.some(c=>c.backgroundA!==undefined||c.backgroundB!==undefined)?["background" as const]:[]])]};
  });
}
