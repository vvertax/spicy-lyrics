import Fullscreen from "../components/Utils/Fullscreen.ts";
import {IsPIP} from "./adapters/PopupLyrics.ts";
import {EnableCompactMode,DisableCompactMode}from "../components/Utils/CompactMode.ts";
import {PopupModal}from "../components/Modal.ts";
import React from 'react';
import {createRoot} from 'react-dom/client';
import PageView,{PageContainer}from '../components/Pages/PageView.ts';
import ApplyLyrics from '../utils/Lyrics/Global/Applyer.ts';
import fetchLyrics from './adapters/fetchLyrics.ts';
import Defaults from '../components/Global/Defaults.ts';
import Global from '../components/Global/Global.ts';
import * as stores from '../utils/stores.ts';
import {openSettingsPanel}from '../utils/settings.ts';
import {quoteCard}from '../components/Utils/CreativeTools.ts';
import {reviewLyrics,compareTTML}from '../components/Utils/ReviewTools.ts';
import {openTTMLCheck}from '../components/Utils/TTMLCheckPanel.ts';
import {initSubtitleBar}from '../components/Utils/SubtitleBar.ts';
import {setExperiment}from '../utils/experiments.ts';
import {localizeDocument}from '../utils/i18n/runtime.ts';
import LoadFonts from '../components/Styling/Fonts.ts';
import {state,track,position,seek,next,toggle,events,uri,unavailable}from './environment.ts';
import {compareA,compareB}from './fixtures.ts';
import {onAnimationFrame}from '../utils/AnimationFrameLoop.ts';
import {ScrollToActiveLine}from '../utils/Scrolling/ScrollToActiveLine.ts';
import {ScrollSimplebar}from '../utils/Scrolling/Simplebar/ScrollSimplebar.ts';
import {beginSceneTrackChange}from '../components/Utils/ScenePresentation.ts';
import {OpenNowBar,UpdateNowBar}from '../components/Utils/NowBar.ts';
import {initNextLyricsPrefetch}from '../utils/Lyrics/PrefetchNextLyrics.ts';
import {rememberAuthor}from '../components/Utils/AuthorProfile.ts';
import {showIframeProfileModal}from '../components/ReactComponents/IframeProfile/IframeProfileModal.tsx';
import SLToaster from '../components/ReactComponents/SLToaster.tsx';
import './preview.css';
const stage=document.getElementById('preview-stage')!;
const t=(ru:string,en:string)=>stores.$uiLanguage.get()==='ru'?ru:en;
for(const [key,store]of Object.entries(stores)){if(!key.startsWith('$')||!store||typeof (store as any).get!=='function')continue;const target=key[1].toUpperCase()+key.slice(2);if(target in Defaults){const set=(value:any)=>{(Defaults as any)[target]=value;};set((store as any).get());(store as any).listen(set);}}
const parseOrder=(s:string)=>{try{Defaults.LyricsSourceOrder=JSON.parse(s)}catch{}};parseOrder(stores.$lyricsSourceOrder.get());stores.$lyricsSourceOrder.listen(parseOrder);
localizeDocument(document);LoadFonts();
const toastRoot=document.createElement('div');document.body.append(toastRoot);createRoot(toastRoot).render(React.createElement(SLToaster));
const notice=document.getElementById('preview-notice')!;let noticeTimer:any;
window.addEventListener('preview:notice',(event:any)=>{notice.textContent=event.detail;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.textContent='',5000);});
function button(label:string,action:()=>void){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action;return b;}

function fitPreview(){if(!PageContainer)return;if(document.documentElement.clientWidth<650)EnableCompactMode();else DisableCompactMode();}
window.addEventListener('resize',fitPreview);
async function showLyrics(){if(!PageView.IsOpened){stage.replaceChildren();await PageView.Open(stage);}fitPreview();}
function settingsTab(label?:string){openSettingsPanel(document);if(label){const name=label==='History'?t('История настроек','Settings history'):label==='Experiments'?t('Эксперименты','Experiments'):label;Array.from(document.querySelectorAll<HTMLButtonElement>('.sl-sp-tab[role=tab]')).find(b=>b.textContent?.trim()===name)?.click();}}
async function feature(name:string){for(const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[open]'))dialog.close();if(PopupModal.isConnected){PopupModal.hide();await new Promise(resolve=>setTimeout(resolve,270));}if(name!=='compare')document.querySelector<HTMLButtonElement>('.vv-comparison-heading > button')?.click();if(name!=='subtitles')await showLyrics();
 if(name==='cinema'){if(Fullscreen.IsOpen)await Fullscreen.Close();else await Fullscreen.Open(true,false);}
 if(name==='romanization')PageContainer?.querySelector<HTMLButtonElement>('#RomanizationToggle')?.click();
 if(name==='recording')PageContainer?.querySelector<HTMLButtonElement>('[data-vv-action=recording]')?.click();
 if(name==='settings')settingsTab();
 if(name==='history')settingsTab('History');
 if(name==='experiments')settingsTab('Experiments');
 if(name==='cards')await quoteCard(document);
 if(name==='review')reviewLyrics(document);
 if(name==='check'){openTTMLCheck(document);const input=document.querySelector<HTMLInputElement>('.vv-ttml-check input[type=file]');if(input){const transfer=new DataTransfer();transfer.items.add(new File([compareA.replace('</div>','<p begin="30s" end="29s">Timing example</p></div>')],'demo-check.ttml',{type:'application/xml'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));}}
 if(name==='compare'){compareTTML(document);const inputs=document.querySelectorAll<HTMLInputElement>('.vv-page-comparison input[type=file]');for(const [i,input]of [...inputs].entries()){const transfer=new DataTransfer();transfer.items.add(new File([i?compareB:compareA],`demo-${i?'B':'A'}.ttml`,{type:'application/xml'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));}}
 if(name==='subtitles'){setExperiment('subtitleBar',true);stores.$subtitlePanelVisible.set(true);await PageView.Destroy();const hint=document.createElement('div');hint.className='preview-library';hint.textContent=t('Лирика остаётся рядом, пока вы выбираете музыку.','Lyrics stay with you while you browse music.');stage.replaceChildren(hint);}
 if(name==='author'){rememberAuthor({id:'11111',username:'demo',displayName:'Spicy Lyrics Demo',avatar:new URL(track().cover,location.href).href});showIframeProfileModal('11111',document,{signal:new AbortController().signal,onState:()=>{}});}
 if(name==='preload'){state.announcePrefetch=true;stores.$prefetchNextLyrics.set(true);window.dispatchEvent(new Event('online'));window.dispatchEvent(new CustomEvent('preview:notice',{detail:t('Готовим текст следующего демо-трека. Нажмите «Следующая» после уведомления.','Preparing next demo lyrics. Press Next after the notification.')}));}
}
function toolbar(){const host=document.getElementById('preview-tools')!;host.replaceChildren();for(const [id,ru,en]of [['lyrics','Лирика','Lyrics'],['cinema','Кинорежим','Cinema view'],['romanization','Романизация','Romanization'],['recording','Режим записи','Recording mode'],['settings','Настройки','Settings'],['subtitles','Субтитры','Subtitles'],['cards','Карточки','Cards'],['compare','TTML A/B','TTML A/B'],['review','Замечания','Review'],['check','Проверка TTML','Check TTML'],['history','История','History'],['experiments','Эксперименты','Experiments'],['author','Автор','Author'],['preload','Предзагрузка','Preload']])host.append(button(t(ru,en),()=>void feature(id)));host.append(button(t('Сбросить демо','Reset demo'),()=>window.dispatchEvent(new Event('preview:reset'))));}
toolbar();stores.$uiLanguage.listen(toolbar);
const player=document.getElementById('preview-player')!,title=document.createElement('span');title.className='preview-track-title';
const play=button(t('Воспроизвести','Play'),toggle),previous=button('‹',()=>next(-1)),skip=button('›',()=>next());previous.setAttribute('aria-label','Previous demo track');skip.setAttribute('aria-label','Next demo track');
const slider=document.createElement('input');slider.type='range';slider.min='0';slider.step='50';slider.setAttribute('aria-label','Playback position');slider.oninput=()=>seek(Number(slider.value));const time=document.createElement('span');time.className='preview-time';player.append(previous,play,skip,title,slider,time);
function updatePlayer(){title.textContent=track().title;slider.max=String(track().duration);slider.value=String(position());play.textContent=state.playing?t('Пауза','Pause'):t('Воспроизвести','Play');const s=Math.floor(position()/1000);time.textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
events.addEventListener('onplaypause',()=>{Global.Event.evoke('playback:state',null);updatePlayer();});state.onPosition=()=>{Global.Event.evoke('playback:state',null);updatePlayer();};
state.onTrack=()=>{beginSceneTrackChange(PageContainer,uri());Global.Event.evoke('playback:songchange',{data:Spicetify.Player.data});void fetchLyrics(uri()).then(async data=>{await ApplyLyrics(data);UpdateNowBar(true);});updatePlayer();};
window.addEventListener('preview:language',(event:any)=>{if(['ru','en'].includes(event.detail))stores.$uiLanguage.set(event.detail);});
window.addEventListener('preview:feature',(event:any)=>void feature(event.detail));
if(IsPIP){stage.classList.add('spicy-pip-wrapper');document.documentElement.dataset.popupPreview='true';}
await PageView.Open(stage);OpenNowBar(true);fitPreview();
if(IsPIP){await Fullscreen.Open(true,false);EnableCompactMode();}initSubtitleBar();initNextLyricsPrefetch();updatePlayer();
onAnimationFrame(()=>{updatePlayer();if(state.playing&&position()>=track().duration){if(state.loop==='track')seek(0);else next();}if(ScrollSimplebar)ScrollToActiveLine(ScrollSimplebar);});
window.addEventListener('keydown',e=>{if(e.altKey&&e.shiftKey){if(e.code==='KeyT')PageContainer?.querySelector<HTMLButtonElement>('#RomanizationToggle')?.click();if(e.code==='KeyK')PageContainer?.querySelector<HTMLButtonElement>('[data-vv-action=karaoke]')?.click();if(e.code==='KeyR')PageContainer?.querySelector<HTMLButtonElement>('[data-vv-action=recording]')?.click();}});
const initial=new URL(location.href).searchParams.get('feature');if(initial&&initial!=='lyrics')void feature(initial);
parent.postMessage({type:'SL_PREVIEW_READY'},location.origin);
