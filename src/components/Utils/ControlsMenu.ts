import { prepareMenuButton, controlMenuPlacement } from "./ControlPresentation.ts";
import { bindLyricsExtras } from "./LyricsExtras.ts";
import { $subtitlesEnabled } from "../../utils/stores.ts";
import Fullscreen from "./Fullscreen.ts";
import { bindTTMLDrop } from "./TTMLDrop.ts";
import { bindLineActions } from "./LineActions.ts";
import { localizeDocument } from "../../utils/i18n/runtime.ts";
import { $quickControlIds, $quickControlOrder } from "../../utils/stores.ts";
import { controlId, normalizeQuickControls, orderedQuickControls, moveQuickControl } from "./ControlLayout.ts";
import { AddReviewMenuRows } from "./ReviewTools.ts";
import { ScrollToCurrentActiveLine } from "../../utils/Scrolling/ScrollToActiveLine.ts";
import { CreativeMenuRows } from "./CreativeTools.ts";
import { RemoveCurrentLyrics_AllCaches } from "../../utils/LyricsCacheTools.ts";
import { Icons } from "../Styling/Icons.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { OpenLyricsDBPanel } from "../../utils/openLyricsDBPanel.tsx";
import { ParseTTML } from "../../utils/Lyrics/manager/parseTTML.ts";
import { ProcessLyrics } from "../../utils/Lyrics/ProcessLyrics.ts";
import ApplyLyrics from "../../utils/Lyrics/Global/Applyer.ts";
import { toast } from "sonner";

let cleanup: (() => void) | undefined;
export function BuildControlsMenu(controls: HTMLElement, page: HTMLElement) {
  cleanup?.();
  const doc = controls.ownerDocument;
  localizeDocument(doc);
  const win = doc.defaultView!;
  const menu = doc.createElement('div');
  menu.className = 'sl-fork-menu'; menu.role = 'menu'; menu.hidden = true;
  const labels: Record<string, string> = {
    CinemaView: 'Cinema View', NowBarToggle: 'NowBar', CompactModeToggle: 'Compact Mode',
    RomanizationToggle: 'Romanization', NowBarSideToggle: 'Swap NowBar Side',
    FullscreenToggle: 'Fullscreen', LyricsManager: 'Lyrics Manager', CacheAction: 'Clear Cached Lyrics',
    SettingsToggle: 'Settings', Close: 'Close Page',
  };
  const buttons = Array.from(controls.querySelectorAll<HTMLButtonElement>('button'));
  const addRow = (button: HTMLButtonElement, label: string) => {
    (button as HTMLButtonElement & { _tippy?: { destroy(): void } })._tippy?.destroy();
    button.dataset.controlId = controlId(button.id, label);
    button.dataset.controlLabel = label;
    const pressed = prepareMenuButton(button);
    button.role = pressed === null ? 'menuitem' : 'menuitemcheckbox'; button.className = 'sl-fork-menu-item';
    const text = doc.createElement('span'); text.textContent = label; button.append(text);
    menu.append(button);
  };
  for (const button of buttons) addRow(button, labels[button.id] ?? button.id);
  const cover = doc.createElement('button'); cover.type = 'button'; cover.innerHTML = Icons.CoverOnly;
  addRow(cover, 'Cover Only');
  cover.role = 'menuitemcheckbox';
  cover.setAttribute('aria-checked', String(page.classList.contains('SL_CoverOnly')));
  cover.onclick = () => { page.classList.toggle('SL_CoverOnly'); cover.setAttribute('aria-checked', String(page.classList.contains('SL_CoverOnly'))); };
  const load = doc.createElement('button'); load.type = 'button'; load.innerHTML = Icons.LoadTTML;
  addRow(load, 'Load TTML File');
  const loadFile=async(file:File)=>{
    const uri=SpotifyPlayer.GetUri();if(!uri)return;
    try{
      if(file.size>5*1024*1024)throw new Error('TTML must be smaller than 5 MB');
      const parsed=await ParseTTML(await file.text());if(!parsed?.Result)throw new Error('Could not parse TTML');
      const data={...parsed.Result,uri};await ProcessLyrics(data);
      if(SpotifyPlayer.GetUri()!==uri)return;await ApplyLyrics([data,200]);toast.success('TTML applied for this playback');
    }catch(error){toast.error((error as Error).message);}
  };
  load.onclick=()=>{const input=doc.createElement('input');input.type='file';input.accept='.ttml';input.onchange=()=>{if(input.files?.[0])void loadFile(input.files[0]);};input.click();};
  const unbindDrop=bindTTMLDrop(page,file=>{void loadFile(file);});
  const unbindLines=bindLineActions(page);
  const unbindExtras=bindLyricsExtras(page);
  if (!buttons.some(b => b.id === 'LyricsManager')) {
    const manager = doc.createElement('button'); manager.type = 'button'; manager.innerHTML = Icons.LyricsManager;
    addRow(manager, 'Lyrics Manager'); manager.onclick = () => OpenLyricsDBPanel(doc);
  }
  if (!buttons.some(b => b.id === 'CacheAction')) {
    const cache = doc.createElement('button'); cache.type = 'button'; cache.innerHTML = Icons.ClearCache;
    addRow(cache, 'Clear Cached Lyrics'); cache.onclick = () => { void RemoveCurrentLyrics_AllCaches(true); };
  }
  const subtitles = doc.createElement('button'); subtitles.type = 'button'; subtitles.id = 'subtitles'; subtitles.innerHTML = Icons.Subtitles;
  addRow(subtitles, 'Subtitles'); subtitles.role = 'menuitemcheckbox';
  const stopSubtitleVisible = $subtitlesEnabled.subscribe(value => subtitles.setAttribute('aria-checked', String(value)));
  subtitles.onclick = () => $subtitlesEnabled.set(!$subtitlesEnabled.get());
  CreativeMenuRows(menu, page, addRow);
  AddReviewMenuRows(menu, addRow);
  // Keep the screenshot's primary controls first, and settings/close last.
  const order = ['CinemaView', 'NowBarToggle'];
  order.forEach((id, index) => { const item = menu.querySelector('#' + id); if (item) menu.insertBefore(item, menu.children[index] ?? null); });
  menu.insertBefore(cover, menu.children[2] ?? null);
  menu.insertBefore(load, menu.querySelector('#LyricsManager, #CacheAction, #SettingsToggle'));
  for (const id of ['SettingsToggle', 'Close']) { const item = menu.querySelector('#' + id); if (item) menu.append(item); }
  const toggle = doc.createElement('button'); toggle.type = 'button'; toggle.className = 'ViewControl sl-fork-menu-toggle';
  toggle.innerHTML = Icons.More; toggle.setAttribute('aria-label', 'Lyrics page controls');
  toggle.setAttribute('aria-haspopup', 'menu'); toggle.setAttribute('aria-expanded', 'false');
  const close = (focus = false) => { if (typeof menu.hidePopover === 'function' && menu.matches(':popover-open')) menu.hidePopover(); menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); if (focus && toggle.isConnected) toggle.focus(); };
  const items = () => Array.from(menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).filter(button => !button.hidden);
  const open = () => {
    menu.hidden = false; toggle.setAttribute('aria-expanded', 'true');
    if (typeof menu.showPopover === 'function' && !menu.matches(':popover-open')) menu.showPopover();
    const rect = toggle.getBoundingClientRect();
    menu.style.maxHeight = `${Math.max(1, win.innerHeight - 24)}px`;
    const bounds = menu.getBoundingClientRect();
    const placement = controlMenuPlacement(rect, bounds.width, bounds.height, { width: win.innerWidth, height: win.innerHeight });
    menu.style.left = `${placement.left}px`;
    menu.style.top = `${placement.top}px`;
    menu.style.bottom = 'auto';
    menu.style.maxHeight = `${placement.maxHeight}px`;
    menu.style.transformOrigin = placement.opensAbove ? 'right bottom' : 'right top';
    if (!win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      menu.getAnimations().forEach(animation => animation.cancel());
      menu.animate([
        { opacity: 0, scale: '0.96', translate: placement.opensAbove ? '0 6px' : '0 -6px' },
        { opacity: 1, scale: '1', translate: '0 0' },
      ], { duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    }

    items()[0]?.focus();
  };
  toggle.onclick = () => menu.hidden ? open() : close(true);
  menu.addEventListener('click', () => close());
  win.addEventListener('resize', closeOnResize);
  function closeOnResize() { close(); }
  const outside = (event: Event) => { if (!controls.contains(event.target as Node) && !menu.contains(event.target as Node)) close(); };
  const keys = (event: KeyboardEvent) => {
    if (menu.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
    if (event.key === 'Tab') close();
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); const list = items(); const index = list.indexOf(doc.activeElement as HTMLButtonElement);
      list[event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
    }
  };
  const exitFullscreen = doc.createElement('button');
  exitFullscreen.type = 'button'; exitFullscreen.className = 'ViewControl sl-fullscreen-exit';
  exitFullscreen.innerHTML = Icons.CloseFullscreen;
  exitFullscreen.setAttribute('aria-label', 'Exit Fullscreen'); exitFullscreen.title = 'Exit Fullscreen';
  exitFullscreen.onclick = () => { close(); void Fullscreen.Close(); };
  controls.classList.add('sl-fork-controls'); controls.append(exitFullscreen, toggle);
  // A top-layer sibling can blur the page instead of the fading toolbar's backdrop root.
  if (typeof menu.showPopover === 'function') menu.popover = 'manual';
  page.append(menu);
  const quickbar = doc.createElement('div'); quickbar.className='sl-quick-controls'; quickbar.role='toolbar'; quickbar.setAttribute('aria-label','Quick lyrics controls');
  controls.insertBefore(quickbar, exitFullscreen);
  const allRows=Array.from(menu.querySelectorAll<HTMLButtonElement>('button'));
  const orderAction = doc.createElement("button");
  orderAction.type = "button";
  orderAction.className = "sl-fork-menu-item sl-quick-order";
  orderAction.role = "menuitem";
  orderAction.textContent = "Reorder quick controls";
  menu.append(orderAction);
  const done = doc.createElement("button");
  done.type = "button";
  done.className = "sl-quick-done";
  done.textContent = "Done";
  done.hidden = true;
  controls.insertBefore(done, toggle);
  allRows.forEach(row=>row.dataset.menuRole=row.role);
  const syncPressed=()=>quickbar.querySelectorAll<HTMLButtonElement>('button[aria-checked]').forEach(row=>row.setAttribute('aria-pressed',row.getAttribute('aria-checked')!));
  const available = () => Array.from(quickbar.querySelectorAll<HTMLButtonElement>("button:not(:disabled):not([hidden])"));
  const idsOf = (rows: HTMLButtonElement[]) => rows.map(row => row.dataset.controlId!);
  let draft: string[] | null = null;
  let editedId: string | undefined;
  let drag: { id: number; x: number; y: number; order: string[] } | null = null;
  let frame = 0;
  const currentOrder = () => orderedQuickControls(normalizeQuickControls($quickControlIds.get()), $quickControlOrder.get(), idsOf(allRows));
  const placeControls=()=>{
    const order = draft ?? currentOrder();
    const pinned=new Set(order);
    for(const row of allRows){
      const quick=pinned.has(row.dataset.controlId!);
      row.classList.toggle('sl-quick-control',quick);
      row.classList.toggle('ViewControl',quick);
      row.classList.toggle('sl-fork-menu-item',!quick);
      if(quick){row.role='button';row.setAttribute('aria-label',row.dataset.controlLabel!);row.title=row.dataset.controlLabel!;}
      else {row.role=row.dataset.menuRole!;row.removeAttribute('aria-pressed');row.removeAttribute('aria-label');row.removeAttribute('title');menu.insertBefore(row, orderAction);}
    }
    order.forEach((id, index) => {
      const button = allRows.find(row => row.dataset.controlId === id);
      if (button && quickbar.children[index] !== button) quickbar.insertBefore(button, quickbar.children[index] ?? null);
    });
    orderAction.hidden = available().length < 2;
    toggle.hidden = Boolean(draft) || !items().length;
    syncPressed();close();
  };
  const stopDrag = () => { drag = null; win.cancelAnimationFrame(frame); };
  const finishOrder = (save: boolean) => {
    const order = draft;
    if (!order) return;
    stopDrag();
    draft = null;
    delete controls.dataset.editing;
    done.hidden = true;
    if (save) $quickControlOrder.set(order);
    placeControls();
    (available().find(row => row.dataset.controlId === editedId) ?? toggle).focus();
  };
  orderAction.onclick = () => {
    draft = currentOrder();
    controls.dataset.editing = "true";
    done.hidden = false;
    placeControls();
    editedId = available()[0]?.dataset.controlId;
    available()[0]?.focus();
  };
  done.onclick = () => finishOrder(true);
  const cancelEditing = (event: KeyboardEvent) => {
    if (!draft || event.key !== "Escape") return;
    event.preventDefault(); event.stopImmediatePropagation(); finishOrder(false);
  };
  win.addEventListener("keydown", cancelEditing, true);
  function reorderQuickButton(to: string) {
    if (!draft || !editedId) return;
    const order = moveQuickControl(draft, idsOf(available()), editedId, to);
    if (order === draft) return;
    const focused = doc.activeElement as HTMLElement;
    draft = order;
    placeControls();
    if (quickbar.contains(focused)) focused.focus({ preventScroll: true });
  }
  function reorderUnderPointer() {
    if (!drag) return;
    const row = doc.elementFromPoint(drag.x, drag.y)?.closest<HTMLButtonElement>(".sl-quick-control");
    if (row && available().includes(row)) reorderQuickButton(row.dataset.controlId!);
  }
  function dragFrame() {
    if (!drag) return;
    const rect = quickbar.getBoundingClientRect();
    if (drag.x < rect.left + 22) quickbar.scrollLeft -= 8;
    if (drag.x > rect.right - 22) quickbar.scrollLeft += 8;
    reorderUnderPointer();
    frame = win.requestAnimationFrame(dragFrame);
  }
  quickbar.addEventListener("click", event => {
    if (draft) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!menu.hidden && (event.target as Element).closest(".sl-quick-control")) close();
  }, true);
  quickbar.onpointerdown = event => {
    const row = (event.target as Element).closest<HTMLButtonElement>(".sl-quick-control");
    if (!draft || drag || event.button !== 0 || !row || !available().includes(row)) return;
    event.preventDefault();
    editedId = row.dataset.controlId;
    row.focus({ preventScroll: true });
    quickbar.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, order: draft };
    frame = win.requestAnimationFrame(dragFrame);
  };
  quickbar.onpointermove = event => {
    if (drag?.id === event.pointerId) { drag.x = event.clientX; drag.y = event.clientY; }
  };
  quickbar.onpointerup = event => {
    if (drag?.id !== event.pointerId) return;
    drag.x = event.clientX; drag.y = event.clientY;
    reorderUnderPointer(); stopDrag();
  };
  const cancelDrag = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    draft = drag.order; stopDrag(); placeControls();
  };
  quickbar.onpointercancel = quickbar.onlostpointercapture = cancelDrag;
  const unsubscribeQuick=$quickControlIds.subscribe(() => {
    if (draft) finishOrder(false);
    else placeControls();
  });
  const unsubscribeOrder=$quickControlOrder.listen(placeControls);
  const pressedObserver=new MutationObserver(syncPressed);
  pressedObserver.observe(quickbar,{subtree:true,attributes:true,attributeFilter:['aria-checked']});
  quickbar.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const rows=Array.from(quickbar.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).filter(button => !button.hidden);
    if(!rows.length)return;event.preventDefault();
    const index = rows.indexOf((event.target as Element).closest<HTMLButtonElement>("button") ?? doc.activeElement as HTMLButtonElement);
    if (draft && index >= 0) {
      event.stopPropagation();
      editedId = rows[index].dataset.controlId;
      const target = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : index + (event.key === "ArrowRight" ? 1 : -1);
      if (rows[target]) reorderQuickButton(rows[target].dataset.controlId!);
      return;
    }
    rows[event.key==='Home'?0:event.key==='End'?rows.length-1:(index+(event.key==='ArrowRight'?1:-1)+rows.length)%rows.length]?.focus();
  });
  const shortcuts = (event: KeyboardEvent) => {
    if (!page.isConnected || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]') || doc.querySelector('dialog[open]') || doc.querySelector('sl-generic-modal .sl-modal-overlay.Active')) return;
    const action = allRows.find(row => event.code === 'KeyK' ? row.dataset.vvAction === 'karaoke' : event.code === 'KeyR' ? row.dataset.vvAction === 'recording' : event.code === 'KeyT' ? row.id === 'RomanizationToggle' : false);
    if (event.code === 'KeyL') { event.preventDefault(); ScrollToCurrentActiveLine(); }
    else if (action) { event.preventDefault(); action.click(); }
  };
  doc.addEventListener('keydown', shortcuts);
  doc.addEventListener('pointerdown', outside); doc.addEventListener('keydown', keys, true);
  const observer = new MutationObserver(() => { if (!controls.isConnected) cleanup?.(); });
  observer.observe(doc.body, { childList: true, subtree: true });
  cleanup = () => { stopDrag(); unbindExtras(); stopSubtitleVisible(); unbindDrop();unbindLines();unsubscribeQuick();unsubscribeOrder(); pressedObserver.disconnect(); doc.removeEventListener('keydown', shortcuts); close(); menu.remove(); win.removeEventListener('resize', closeOnResize); win.removeEventListener("keydown", cancelEditing, true); observer.disconnect(); doc.removeEventListener('pointerdown', outside); doc.removeEventListener('keydown', keys, true); cleanup = undefined; };
}
