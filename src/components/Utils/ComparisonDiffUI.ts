import { comparisonDifference } from "./ReviewModel.ts";
import { compareTTMLData, comparisonText, characterEdits, DIFF_CATEGORIES, type DiffCategory, type DiffPair, type DiffChange } from "./ComparisonDiff.ts";
import { $uiLanguage } from "../../utils/stores.ts";
import { translateUi } from "../../utils/i18n/translate.ts";
import type { renderComparisonLyrics } from "./ComparisonRenderer.ts";
type Row=ReturnType<typeof renderComparisonLyrics>["diffRows"][number];
type Side={data:any;view:HTMLElement;renderer?:ReturnType<typeof renderComparisonLyrics>;manualUntil:number;followed:number};
const labels:Record<DiffCategory,string>={text:"Text",timing:"Timing",splits:"Splits",voice:"Voice / side",background:"Backing vocals",added:"Added",removed:"Removed"};
export function bindComparisonDiff(host:HTMLElement,sides:Record<string,Side>) {
  const doc=host.ownerDocument,win=doc.defaultView!;
  const t=(s:string)=>translateUi(s,$uiLanguage.get());
  const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const root=node("div");root.className="vv-diff-controls";root.setAttribute("data-i18n-ignore","");
  const toggle=node("input");toggle.type="checkbox";const title=node("span");const enable=node("label");enable.append(toggle,title);
  const summary=node("span");summary.className="vv-diff-summary";summary.role="status";
  const previous=node("button"),next=node("button"),counter=node("span");previous.type=next.type="button";counter.className="vv-diff-position";
  const filters=node("details"),filterTitle=node("summary"),filterBody=node("div");filters.className="vv-diff-filters";filters.append(filterTitle,filterBody);
  const categoryInputs=new Map<DiffCategory,{input:HTMLInputElement;caption:HTMLElement}>();
  for(const category of DIFF_CATEGORIES){const label=node("label"),input=node("input"),caption=node("span");input.type="checkbox";input.checked=true;label.dataset.category=category;label.append(input,caption);filterBody.append(label);categoryInputs.set(category,{input,caption});input.onchange=()=>render();}
  const mode=node("select");mode.className="vv-diff-mode";
  const simple=node("option"),detailed=node("option");simple.value="simple";detailed.value="detailed";mode.append(simple,detailed);mode.value="detailed";mode.onchange=()=>render();
  root.append(enable,mode,summary,previous,counter,next,filters);host.append(root);
  let pairs:DiffPair[]=[],visible:DiffPair[]=[],index=-1,aData:any,bData:any;
  const decorations:HTMLElement[]=[];const marked=new Set<HTMLElement>();
  const clear=()=>{decorations.splice(0).forEach(el=>el.remove());for(const el of marked){delete el.dataset.comparisonDiff;delete el.dataset.diffCurrent;}marked.clear();};
  const mark=(el:HTMLElement,category:DiffCategory)=>{const set=new Set((el.dataset.comparisonDiff??"").split(" ").filter(Boolean));set.add(category);el.dataset.comparisonDiff=[...set].join(" ");marked.add(el);};
  const rows=(side:Side)=>side.renderer?.diffRows??[];
  const findRow=(label:string,pair:DiffPair,background?:number)=>{const source=label==="A"?pair.a:pair.b;return source===undefined?undefined:rows(sides[label]).find(row=>row.sourceIndex===source&&row.backgroundIndex===background);};
  const changedText=(row:Row,a:string,b:string,label:string)=>{
    const edits=characterEdits(a,b),ranges:{start:number;end:number}[]=[];let position=0;
    for(const edit of edits){const relevant=edit.kind==="equal"||edit.kind===(label==="A"?"removed":"added");if(!relevant)continue;if(edit.kind!=="equal")ranges.push({start:position,end:position+edit.text.length});position+=edit.text.length;}
    const text=label==="A"?a:b;let cursor=0;for(const segment of row.segments){const start=text.indexOf(segment.text,cursor);if(start<0)continue;const end=start+segment.text.length;cursor=end;if(ranges.some(r=>r.start<end&&r.end>start))mark(segment.element,"text");}
  };
  const detail=(change:DiffChange)=>{
    const item=node("div");item.className="vv-diff-change";item.dataset.category=change.category;
    const location=[change.backgroundA!==undefined||change.backgroundB!==undefined?t("Backing vocals"):t("Lead vocal"),change.partA!==undefined||change.partB!==undefined?`${t("Syllable")} A${change.partA===undefined?"—":change.partA+1} «${change.partTextA??""}» / B${change.partB===undefined?"—":change.partB+1} «${change.partTextB??""}»`:""].filter(Boolean).join(" · ");
    item.append(node("strong",`${t(change.field)} · ${location}`));
    const values=node("div");values.className="vv-diff-values";values.setAttribute("data-i18n-ignore","");
    for(const label of ["A","B"]){const line=node("div");line.append(node("b",`${label} `));
      if(change.edits){for(const edit of change.edits){if(edit.kind===(label==="A"?"added":"removed"))continue;const fragment=node(edit.kind==="equal"?"span":label==="A"?"del":"ins",edit.text.replace(/ /g,"·").replace(/\n/g,"↵\n"));line.append(fragment);}}
      else { let value=(label==="A"?change.before:change.after)||"∅"; if(change.category==="voice"||change.field==="Synchronization type")value=t(value); if(change.category==="timing"&&$uiLanguage.get()==="ru")value=value.replace(/ms/g,"мс"); line.append(node("span",value)); }values.append(line);
    }item.append(values);return item;
  };
  const navigate=(direction:number)=>{
    if(!visible.length)return;index=(index+direction+visible.length)%visible.length;const pair=visible[index];
    for(const el of marked)delete el.dataset.diffCurrent;
    for(const label of ["A","B"]){const side=sides[label];let row=findRow(label,pair);
      if(!row){const at=pairs.indexOf(pair);for(let distance=1;distance<pairs.length&&!row;distance++)for(const candidate of [pairs[at+distance],pairs[at-distance]])if(candidate){row=findRow(label,candidate);if(row)break;}}
      if(!row)continue;row.element.dataset.diffCurrent="true";marked.add(row.element);side.manualUntil=win.performance.now()+4000;side.followed=-1;
      const bounds=row.element.getBoundingClientRect(),viewport=side.view.getBoundingClientRect();side.view.scrollTo({top:side.view.scrollTop+bounds.top-viewport.top-side.view.clientHeight*.35,behavior:win.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
    }counter.textContent=`${index+1} / ${visible.length}`;
  };
  previous.onclick=()=>navigate(index<0?0:-1);next.onclick=()=>navigate(1);
  function render(){
    clear();index=-1;simple.textContent=t("Basic differences");detailed.textContent=t("Detailed differences");mode.setAttribute("aria-label",t("Difference display"));title.textContent=t("Highlight differences");filterTitle.textContent=t("Difference filters");previous.textContent=`‹ ${t("Previous difference")}`;next.textContent=`${t("Next difference")} ›`;
    const ready=!!sides.A?.data&&!!sides.B?.data,enabled=toggle.checked&&ready;
    mode.hidden=!toggle.checked;mode.disabled=!ready;toggle.disabled=!ready;for(const el of [summary,previous,next,counter,filters])el.hidden=!enabled;
    const counts=Object.fromEntries(DIFF_CATEGORIES.map(category=>[category,pairs.filter(p=>p.categories.includes(category)).length]));
    categoryInputs.forEach(({caption},category)=>caption.textContent=`${t(labels[category])} (${counts[category]})`);
    if(!enabled){visible=[];return;}
    if(mode.value==="simple") {
      filters.hidden=true;previous.hidden=next.hidden=counter.hidden=true;
      let count=0;
      const a=sides.A.data.Content??[],b=sides.B.data.Content??[];
      for(let i=0;i<Math.max(a.length,b.length);i++) {
        const difference=comparisonDifference(a[i],b[i]);if(!difference)continue;count++;
        for(const label of ["A","B"]) { const row=rows(sides[label]).find(r=>r.sourceIndex===i&&r.backgroundIndex===undefined);if(row)mark(row.element,difference==="missing"?(label==="A"?"removed":"added"):difference as DiffCategory); }
      }
      summary.textContent=`${t("Changed lines")}: ${count} · ${t("Text / timing")}`;visible=[];return;
    }
    const selected=(category:DiffCategory)=>categoryInputs.get(category)!.input.checked;
    visible=pairs.filter(p=>p.categories.some(selected));
    summary.textContent=`${t("Changed pairs")}: ${pairs.filter(p=>p.a!==undefined&&p.b!==undefined&&p.changes.length).length} · ${t("Added")}: ${counts.added} · ${t("Removed")}: ${counts.removed} · ${t("Visible differences")}: ${visible.length}`;
    counter.textContent=`0 / ${visible.length}`;previous.disabled=next.disabled=!visible.length;
    for(const pair of visible){const changes=pair.changes.filter(c=>selected(c.category)||(selected("background")&&(c.backgroundA!==undefined||c.backgroundB!==undefined)));
      for(const label of ["A","B"]){const lead=findRow(label,pair);if(!lead)continue;
        for(const category of pair.categories.filter(selected))mark(lead.element,category);
        const details=node("details");details.className="vv-diff-details";details.setAttribute("data-i18n-ignore","");
        const caption=node("summary");for(const category of pair.categories.filter(selected)){const badge=node("span",t(labels[category]));badge.className="vv-diff-badge";badge.dataset.category=category;caption.append(badge);}caption.append(node("span",t("Details A → B")));details.append(caption);
        for(const change of changes){details.append(detail(change));const background=label==="A"?change.backgroundA:change.backgroundB;const row=findRow(label,pair,background);if(!row)continue;
          if(background!==undefined)mark(row.element,change.category);
          const part=label==="A"?change.partA:change.partB;
          if(part!==undefined){const segment=row.segments.find(s=>s.index===part);if(segment)mark(segment.element,change.category);}
          else if(change.category==="text"&&change.field==="Text")changedText(row,change.before,change.after,label);
          else if(["added","removed","splits"].includes(change.category)||change.field==="Added backing vocal"||change.field==="Removed backing vocal")for(const segment of row.segments)mark(segment.element,change.category);
        }
        details.addEventListener("click",e=>e.stopPropagation());details.addEventListener("keydown",e=>e.stopPropagation());lead.element.after(details);decorations.push(details);
      }
    }
  }
  toggle.onchange=render;
  const stopLanguage=$uiLanguage.listen(render);
  const refresh=()=>{if(aData!==sides.A?.data||bData!==sides.B?.data){aData=sides.A?.data;bData=sides.B?.data;pairs=aData&&bData?compareTTMLData(aData,bData):[];}render();};
  refresh();return {refresh,destroy(){clear();stopLanguage();root.remove();}};
}
