import { localizeDocument } from "../../utils/i18n/runtime.ts";
import { $quickControlIds } from "../../utils/stores.ts";
import { controlId, normalizeQuickControls } from "./ControlLayout.ts";
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
    button.role = 'menuitem'; button.className = 'sl-fork-menu-item';
    const text = doc.createElement('span'); text.textContent = label; button.append(text);
    menu.append(button);
  };
  for (const button of buttons) addRow(button, labels[button.id] ?? button.id);
  const cover = doc.createElement('button'); cover.type = 'button'; cover.innerHTML = Icons.NowBar;
  addRow(cover, 'Cover Only');
  cover.role = 'menuitemcheckbox';
  cover.setAttribute('aria-checked', String(page.classList.contains('SL_CoverOnly')));
  cover.onclick = () => { page.classList.toggle('SL_CoverOnly'); cover.setAttribute('aria-checked', String(page.classList.contains('SL_CoverOnly'))); };
  const load = doc.createElement('button'); load.type = 'button'; load.innerHTML = Icons.LoadTTML;
  addRow(load, 'Load TTML File');
  load.onclick = () => {
    const input = doc.createElement('input'); input.type = 'file'; input.accept = '.ttml';
    input.onchange = async () => {
      const file = input.files?.[0]; const uri = SpotifyPlayer.GetUri();
      if (!file || !uri) return;
      try {
        const parsed = await ParseTTML(await file.text());
        if (!parsed?.Result) throw new Error('Could not parse TTML');
        const data = { ...parsed.Result, uri };
        await ProcessLyrics(data);
        if (SpotifyPlayer.GetUri() !== uri) return;
        await ApplyLyrics([data, 200]);
        toast.success('TTML applied for this playback');
      } catch (error) { toast.error((error as Error).message); }
    };
    input.click();
  };
  if (!buttons.some(b => b.id === 'LyricsManager')) {
    const manager = doc.createElement('button'); manager.type = 'button'; manager.innerHTML = Icons.LoadTTML;
    addRow(manager, 'Lyrics Manager'); manager.onclick = () => OpenLyricsDBPanel(doc);
  }
  if (!buttons.some(b => b.id === 'CacheAction')) {
    const cache = doc.createElement('button'); cache.type = 'button'; cache.innerHTML = Icons.ClearCache;
    addRow(cache, 'Clear Cached Lyrics'); cache.onclick = () => { void RemoveCurrentLyrics_AllCaches(true); };
  }
  CreativeMenuRows(menu, page, addRow);
  AddReviewMenuRows(menu, addRow);
  // Keep the screenshot's primary controls first, and settings/close last.
  const order = ['CinemaView', 'NowBarToggle'];
  order.forEach((id, index) => { const item = menu.querySelector('#' + id); if (item) menu.insertBefore(item, menu.children[index] ?? null); });
  menu.insertBefore(cover, menu.children[2] ?? null);
  menu.insertBefore(load, menu.querySelector('#LyricsManager, #CacheAction, #SettingsToggle'));
  for (const id of ['SettingsToggle', 'Close']) { const item = menu.querySelector('#' + id); if (item) menu.append(item); }
  const toggle = doc.createElement('button'); toggle.type = 'button'; toggle.className = 'ViewControl sl-fork-menu-toggle';
  toggle.textContent = '•••'; toggle.setAttribute('aria-label', 'Lyrics page controls');
  toggle.setAttribute('aria-haspopup', 'menu'); toggle.setAttribute('aria-expanded', 'false');
  const close = (focus = false) => { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); if (focus && toggle.isConnected) toggle.focus(); };
  const items = () => Array.from(menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  const open = () => {
    menu.hidden = false; toggle.setAttribute('aria-expanded', 'true');
    const rect = toggle.getBoundingClientRect();
    menu.style.left = `${toggle.offsetLeft + toggle.offsetWidth / 2}px`;
    menu.style.setProperty('--menu-shift', '0px');
    const bounds = menu.getBoundingClientRect();
    const shift = Math.max(12 - bounds.left, Math.min(0, win.innerWidth - 12 - bounds.right));
    menu.style.setProperty('--menu-shift', `${shift}px`);
    menu.style.bottom = rect.top > win.innerHeight / 2 ? 'calc(100% + 10px)' : 'auto';
    menu.style.top = rect.top > win.innerHeight / 2 ? 'auto' : 'calc(100% + 10px)';
    menu.style.transformOrigin = rect.top > win.innerHeight / 2 ? 'center bottom' : 'center top';
    if (!win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      menu.getAnimations().forEach(animation => animation.cancel());
      menu.animate([
        { opacity: 0, scale: '0.96', translate: rect.top > win.innerHeight / 2 ? '0 6px' : '0 -6px' },
        { opacity: 1, scale: '1', translate: '0 0' },
      ], { duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    }

    items()[0]?.focus();
  };
  toggle.onclick = () => menu.hidden ? open() : close(true);
  menu.addEventListener('click', () => close());
  win.addEventListener('resize', closeOnResize);
  function closeOnResize() { close(); }
  const outside = (event: Event) => { if (!controls.contains(event.target as Node)) close(); };
  const keys = (event: KeyboardEvent) => {
    if (menu.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
    if (event.key === 'Tab') close();
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); const list = items(); const index = list.indexOf(doc.activeElement as HTMLButtonElement);
      list[event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
    }
  };
  controls.classList.add('sl-fork-controls'); controls.append(toggle, menu);
  const quickbar = doc.createElement('div'); quickbar.className='sl-quick-controls'; quickbar.role='toolbar'; quickbar.setAttribute('aria-label','Quick lyrics controls');
  controls.insertBefore(quickbar, toggle);
  const allRows=Array.from(menu.querySelectorAll<HTMLButtonElement>('button'));
  allRows.forEach(row=>row.dataset.menuRole=row.role);
  const syncPressed=()=>quickbar.querySelectorAll<HTMLButtonElement>('button[aria-checked]').forEach(row=>row.setAttribute('aria-pressed',row.getAttribute('aria-checked')!));
  const placeControls=(ids: string[])=>{
    const pinned=new Set(normalizeQuickControls(ids));
    for(const row of allRows){
      const quick=pinned.has(row.dataset.controlId!);
      row.classList.toggle('sl-quick-control',quick);
      if(quick){row.role='button';row.setAttribute('aria-label',row.dataset.controlLabel!);row.title=row.dataset.controlLabel!;quickbar.append(row);}
      else {row.role=row.dataset.menuRole!;row.removeAttribute('aria-pressed');row.removeAttribute('aria-label');row.removeAttribute('title');menu.append(row);}
    }
    toggle.hidden = !menu.querySelector("button");
    syncPressed();close();
  };
  const unsubscribeQuick=$quickControlIds.subscribe(placeControls);
  const pressedObserver=new MutationObserver(syncPressed);
  pressedObserver.observe(quickbar,{subtree:true,attributes:true,attributeFilter:['aria-checked']});
  quickbar.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const rows=Array.from(quickbar.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    if(!rows.length)return;event.preventDefault();const index=rows.indexOf(doc.activeElement as HTMLButtonElement);
    rows[event.key==='Home'?0:event.key==='End'?rows.length-1:(index+(event.key==='ArrowRight'?1:-1)+rows.length)%rows.length]?.focus();
  });
  const shortcuts = (event: KeyboardEvent) => {
    if (!page.isConnected || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]') || doc.querySelector('dialog[open]') || doc.querySelector('sl-generic-modal .sl-modal-overlay.Active')) return;
    const action = event.code === 'KeyK' ? controls.querySelector<HTMLButtonElement>('[data-vv-action="karaoke"]')
      : event.code === 'KeyR' ? controls.querySelector<HTMLButtonElement>('[data-vv-action="recording"]')
      : event.code === 'KeyT' ? controls.querySelector<HTMLButtonElement>('#RomanizationToggle') : null;
    if (event.code === 'KeyL') { event.preventDefault(); ScrollToCurrentActiveLine(); }
    else if (action) { event.preventDefault(); action.click(); }
  };
  doc.addEventListener('keydown', shortcuts);
  doc.addEventListener('pointerdown', outside); doc.addEventListener('keydown', keys, true);
  const observer = new MutationObserver(() => { if (!controls.isConnected) cleanup?.(); });
  observer.observe(doc.body, { childList: true, subtree: true });
  cleanup = () => { unsubscribeQuick(); pressedObserver.disconnect(); doc.removeEventListener('keydown', shortcuts); close(); win.removeEventListener('resize', closeOnResize); observer.disconnect(); doc.removeEventListener('pointerdown', outside); doc.removeEventListener('keydown', keys, true); cleanup = undefined; };
}
