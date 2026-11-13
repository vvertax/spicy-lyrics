import { getExperiments } from "../../../utils/experiments.ts";
import { SETTING_LABELS } from "./SettingLabels.ts";
import { useEffect,useRef } from "react";
import { useStore } from "@nanostores/react";
import { settingsHistory as history } from "../../../utils/SettingsHistory.ts";
import { $uiLanguage } from "../../../utils/stores.ts";
import { translateUi } from "../../../utils/i18n/translate.ts";
export default function HistoryPanel(){
  const host=useRef<HTMLDivElement|null>(null);
  useStore(history.revision);const language=useStore($uiLanguage);const t=(s:string)=>translateUi(s,language);
  useEffect(()=>{const doc=host.current!.ownerDocument,window=doc.defaultView!,document=doc;const release=()=>history.endPreview();window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);window.addEventListener('blur',release);document.addEventListener('visibilitychange',release);return()=>{release();window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);window.removeEventListener('blur',release);document.removeEventListener('visibilitychange',release);};},[]);
  useEffect(()=>{const modal=host.current?.closest('sl-generic-modal')??host.current?.closest('.sl-sp-panel');if(history.previewing)modal?.classList.add('VV_HistoryPeek');return()=>modal?.classList.remove('VV_HistoryPeek');},[history.previewing]);
  const label=(key:string)=>t(SETTING_LABELS[key]??(key.startsWith('experiment:')?getExperiments().find(exp=>exp.id===key.slice(11))?.label:undefined)??key.replace(/^experiment:/,'').replace(/([a-z])([A-Z])/g,'$1 $2'));
  const backgrounds:Record<string,string>={default:'Default',off:'Default',legacy:'Legacy',auto:'Auto',artistHeader:'Artist Header',coverArt:'Cover Art',color:'Color',none:'None (Transparent)'};
  const value=(v:any,key:string)=>v===undefined?t('Default'):typeof v==='boolean'?t(v?'On':'Off'):typeof v==='string'?(key==='settingsDesign'?t(v==='original'?'Original Spicy Lyrics':'Ruytha Fork'):key==='staticBackgroundMode'?t(backgrounds[v]??v):v):JSON.stringify(v);
  return <div ref={host} className="vv-history" data-i18n-ignore=""><p>{t('Last 40 changes in this session. Tokens, track data and build channels are excluded.')}</p><div className="vv-history-actions"><button className="sl-sp-btn" disabled={!history.cursor||history.previewing} onClick={()=>history.undo()}>{t('Undo')}</button><button className="sl-sp-btn" disabled={history.cursor===history.entries.length||history.previewing} onClick={()=>history.redo()}>{t('Redo')}</button></div>
    {!history.entries.length&&<p>{t('Change a setting to start its history.')}</p>}
    {[...history.entries].reverse().map(entry=><article className="sl-sp-card vv-history-entry" key={entry.id}><header className="vv-history-heading"><time dateTime={new Date(entry.time).toISOString()}>{new Date(entry.time).toLocaleTimeString(language)}</time><span className="vv-history-status" data-applied={history.entries.indexOf(entry)<history.cursor}>{history.entries.indexOf(entry)<history.cursor?t('Applied'):t('Undone')}</span></header>
    {entry.changes.map(c=><div className="vv-history-change" key={c.key}><strong>{label(c.key)}</strong><div className="vv-history-values"><span className="vv-history-before">{value(c.before,c.key)}</span><span className="vv-history-arrow" aria-hidden="true">→</span><span className="vv-history-after">{value(c.after,c.key)}</span></div></div>)}
    {history.entries.indexOf(entry)<history.cursor&&<button className="sl-sp-btn" onPointerDown={e=>{e.preventDefault();history.preview(entry);}} onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();history.preview(entry);}}} onKeyUp={()=>history.endPreview()} onBlur={()=>history.endPreview()}>{t('Hold to compare before changes')}</button>}</article>)}
  </div>;
}
