import { Icons } from "../Styling/Icons.ts";
import { getExperiments,isExperimentEnabled } from "../../utils/experiments.ts";
import { diagnosticErrors,redactDiagnostic } from "../../utils/DiagnosticLog.ts";
import { settingsHistory } from "../../utils/SettingsHistory.ts";
import { ProjectVersion } from "../../../project/config.ts";
import { $buildChannel,$uiLanguage } from "../../utils/stores.ts";
import { translateUi } from "../../utils/i18n/translate.ts";
import { getDisplayedLyrics } from "../../utils/Lyrics/DisplayedLyrics.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
export function buildDiagnosticReport(){
  const lyrics=getDisplayedLyrics(SpotifyPlayer.GetUri());
  const settings=Object.fromEntries([...settingsHistory.stores].filter(([key])=>/(anim|fps|frame|background|simple|split|scroll|experiment:)/i.test(key)&&!/(font|url|file|saved|selected)/i.test(key)).map(([key,store])=>[key,store.get()]));
  return JSON.stringify({version:ProjectVersion,channel:redactDiagnostic($buildChannel.get()),language:$uiLanguage.get(),lyrics:lyrics?{type:lyrics.Type,source:redactDiagnostic(String(lyrics.sourceDisplayName??lyrics.fetchProvider??lyrics.source??'unknown')),cache:!!lyrics.fromCache,local:!!lyrics.fromLocal}:null,settings,experiments:Object.fromEntries(getExperiments().map(exp=>[exp.id,isExperimentEnabled(exp.id)])),errors:diagnosticErrors()},null,2);
}
export function openDiagnostics(doc:Document=document){
  const t=(s:string)=>translateUi(s,$uiLanguage.get());const previous=doc.activeElement as HTMLElement|null;
  const root=doc.createElement('dialog');root.className='vv-review-dialog vv-diagnostics';root.setAttribute('data-i18n-ignore','');
  const mark=doc.createElement('img');mark.className='vv-diagnostics-mark';mark.alt='';mark.setAttribute('aria-hidden','true');mark.src=`data:image/svg+xml,${encodeURIComponent(Icons.LyricsPage.replace(/id="[^"]*"/g,""))}`;
  const header=doc.createElement('header');header.className='vv-diagnostics-header';
  const brand=doc.createElement('span');brand.className='vv-diagnostics-brand';brand.textContent='Spicy Lyrics';
  const heading=doc.createElement('h2');heading.id='vv-diagnostics-title';heading.textContent=t('Diagnostic report');root.setAttribute('aria-labelledby',heading.id);
  const text=doc.createElement('p');text.textContent=t('Review or edit the report before copying. Lyrics, account details and tokens are not included. Nothing is sent automatically.');
  const meta=doc.createElement('div');meta.className='vv-diagnostics-meta';
  for(const label of [`v${ProjectVersion}`,$buildChannel.get()]){const badge=doc.createElement('span');badge.textContent=label;meta.append(badge);}
  header.append(brand,heading,text,meta);
  const editor=doc.createElement('section');editor.className='vv-diagnostics-editor';
  const editorLabel=doc.createElement('div');editorLabel.className='vv-diagnostics-editor-label';
  const label=doc.createElement('label');label.htmlFor='vv-diagnostics-report';label.textContent=t('Report contents');const format=doc.createElement('span');format.textContent='JSON';editorLabel.append(label,format);
  const preview=doc.createElement('textarea');preview.id=label.htmlFor;preview.value=buildDiagnosticReport();preview.setAttribute('aria-label',t('Diagnostic report'));preview.spellcheck=false;preview.wrap='off';editor.append(editorLabel,preview);
  const footer=doc.createElement('footer');footer.className='vv-diagnostics-footer';
  const actions=doc.createElement('div');actions.className='vv-review-actions';const status=doc.createElement('p');status.className='vv-diagnostics-status';status.role='status';
  const copy=doc.createElement('button');copy.type='button';copy.className='vv-diagnostics-copy';copy.textContent=t('Copy report');copy.onclick=()=>{void doc.defaultView!.navigator.clipboard.writeText(preview.value).then(()=>{status.textContent=t('Report copied');status.dataset.error='false';}).catch(()=>{status.textContent=t('Clipboard unavailable.');status.dataset.error='true';});};
  const close=doc.createElement('button');close.type='button';close.textContent=t('Close');close.onclick=()=>root.close();
  const dismiss=doc.createElement('button');dismiss.type='button';dismiss.className='vv-diagnostics-close';dismiss.textContent='×';dismiss.setAttribute('aria-label',t('Close'));dismiss.onclick=()=>root.close();
  actions.append(close,copy);footer.append(status,actions);root.append(mark,header,editor,footer,dismiss);root.addEventListener('close',()=>{root.remove();previous?.focus();},{once:true});doc.body.append(root);root.showModal();dismiss.focus();preview.scrollTop=0;

}
