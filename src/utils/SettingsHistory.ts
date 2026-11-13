import { atom } from "nanostores";
type Store={get:()=>any;set:(value:any)=>void};
type Change={key:string;before:any;after:any};
export type HistoryEntry={id:number;time:number;changes:Change[]};
const clone=(value:any)=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
export const historyKeyAllowed=(key:string)=>!/(token|secret|password|currentLyrics|currentlyFetching|Version|settingsMenuLocation|subtitlePanelVisible|buildChannel|songPlaybackOffsets)/i.test(key);
export class SettingsHistory {
  stores=new Map<string,Store>(); entries:HistoryEntry[]=[];cursor=0;revision=atom(0);active=false;applying=false;previewing=false;private saved:Record<string,any>|null=null;private serial=0;private groupBreak=false;
  register(key:string,store:Store){if(historyKeyAllowed(key))this.stores.set(key,store);}
  start(){this.active=true;}
  notify(){this.revision.set(this.revision.get()+1);}
  capture(key:string,before:any,after:any,now=Date.now()){
    if(!this.active||this.applying||this.previewing||!this.stores.has(key)||JSON.stringify(before)===JSON.stringify(after))return;
    if(this.cursor<this.entries.length)this.entries.splice(this.cursor);
    let entry=this.groupBreak?undefined:this.entries.at(-1);this.groupBreak=false;
    if(!entry||now-entry.time>450) {entry={id:++this.serial,time:now,changes:[]};this.entries.push(entry);}
    const existing=entry.changes.find(c=>c.key===key);if(existing)existing.after=clone(after);else entry.changes.push({key,before:clone(before),after:clone(after)});
    entry.time=now;entry.changes=entry.changes.filter(c=>JSON.stringify(c.before)!==JSON.stringify(c.after));
    if(!entry.changes.length)this.entries.pop();if(this.entries.length>40)this.entries.shift();this.cursor=this.entries.length;this.notify();
  }
  private apply(values:Record<string,any>){this.applying=true;try{for(const [key,value]of Object.entries(values))this.stores.get(key)?.set(clone(value));}finally{this.applying=false;}}
  undo(){this.endPreview();this.groupBreak=true;if(!this.cursor)return;this.apply(Object.fromEntries(this.entries[--this.cursor].changes.map(c=>[c.key,c.before])));this.notify();}
  redo(){this.endPreview();this.groupBreak=true;if(this.cursor>=this.entries.length)return;this.apply(Object.fromEntries(this.entries[this.cursor++].changes.map(c=>[c.key,c.after])));this.notify();}
  preview(entry:HistoryEntry){this.endPreview();this.groupBreak=true;this.saved=Object.fromEntries([...this.stores].map(([key,store])=>[key,clone(store.get())]));this.previewing=true;
    const values:Record<string,any>={};for(let i=this.cursor-1;i>=0;i--){const current=this.entries[i];for(const c of current.changes)values[c.key]=c.before;if(current.id===entry.id)break;}this.apply(values);this.notify();}
  endPreview(){if(!this.saved)return;const saved=this.saved;this.saved=null;this.apply(saved);this.previewing=false;this.notify();}
}
export const settingsHistory=new SettingsHistory();
