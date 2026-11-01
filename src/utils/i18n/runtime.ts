import { $uiLanguage } from "../stores.ts";
import { translateUi } from "./translate.ts";
const scope='.sl-modal,.sl-ldb-root,.sl-build-channel-panel,[data-sonner-toast],.LyricsSkeleton,.loaderContainer,.sl-profile-dialog,.sl-update-toast,.LyricsNotice,.sl-sp-panel,.slm,.sl-ldb-upload-root,.sl-notice,.vv-quote-dialog,.vv-review-dialog,.vv-page-comparison,.sl-modal-header,.sl-fork-menu,.sl-quick-controls,.tippy-box';
const exclude='[data-i18n-ignore],script,style,.sl-build-channel-option-title,.sl-build-channel-select option,.line,.word,.letter,.SongInfo,.vv-quote-lines,.vv-split-line,.vv-preview-text,.vv-review-notes article > p,.vv-review-notes article > strong,.sl-ldb-row__info,.sl-ldb-upload-subtitle,.vv-split-track,.vv-split-filename';
type Source={original:string;rendered:string};
const sources=new WeakMap<Node,Source>();
const attributes=new WeakMap<Element,Map<string,Source>>();
const installed=new WeakSet<Document>();
export function localizeDocument(doc:Document) {
  if(installed.has(doc))return;installed.add(doc);
  function translateNode(node:Node){
    const parent=node.nodeType===3?node.parentElement:node as Element;
    if(!parent?.closest(scope)||parent.closest(exclude))return;
    if(node.nodeType===3&&node.nodeValue?.trim()&&!parent.closest('input,textarea')){
      const current=node.nodeValue;const saved=sources.get(node);
      const original=saved&&saved.rendered===current?saved.original:current;
      const rendered=translateUi(original,$uiLanguage.get());sources.set(node,{original,rendered});
      if(current!==rendered)node.nodeValue=rendered;
    }
    if(node.nodeType===1){
      const element=node as Element;let saved=attributes.get(element);if(!saved){saved=new Map();attributes.set(element,saved);}
      for(const name of ['placeholder','title','aria-label']){
        const current=element.getAttribute(name);if(!current)continue;const previous=saved.get(name);
        const original=previous&&previous.rendered===current?previous.original:current;
        const rendered=translateUi(original,$uiLanguage.get());saved.set(name,{original,rendered});
        if(current!==rendered)element.setAttribute(name,rendered);
      }
    }
  }
  function scan(node:Node){translateNode(node);const walker=doc.createTreeWalker(node,1|4);let child;while((child=walker.nextNode()))translateNode(child);}
  const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='childList')record.addedNodes.forEach(scan);else translateNode(record.target);}});
  observer.observe(doc.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
  const unsubscribe=$uiLanguage.subscribe(()=>doc.querySelectorAll(scope).forEach(scan));
  doc.defaultView?.addEventListener('pagehide',()=>{observer.disconnect();unsubscribe();},{once:true});
}
