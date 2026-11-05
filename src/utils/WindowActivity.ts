type Listener = () => void;
const windows = new Map<Window, { listeners: Set<Listener>; cleanup: () => void }>();
const listeners = new Set<Listener>();
const closedWindows = new WeakSet<Window>();
export const isWindowVisible = (win: Window): boolean => !win.closed && !closedWindows.has(win) && !win.document.hidden;
export function registerActivityWindow(win: Window): void {
  if (windows.has(win) || win.closed || closedWindows.has(win)) return;
  const local = new Set<Listener>();
  const paused = new Set<Animation>(), videos = new Set<HTMLVideoElement>();
  const sync = () => {
    const roots = win.document.querySelectorAll('#SpicyLyricsPage, #sl-subtitle-bar, sl-generic-modal.SpicyLyricsModal, .vv-ttml-check');
    if (!isWindowVisible(win)) {
      roots.forEach(root => {
        root.getAnimations({ subtree: true }).forEach(animation => { if (animation.playState === 'running') { animation.pause(); paused.add(animation); } });
        root.querySelectorAll('video').forEach(video => { if (!video.paused) { video.pause(); videos.add(video); } });
      });
    } else {
      paused.forEach(animation => { if (animation.playState === 'paused') animation.play(); }); paused.clear();
      videos.forEach(video => { if (video.isConnected && video.paused && (typeof Spicetify === "undefined" || Spicetify.Player?.isPlaying?.())) void video.play().catch(() => {}); }); videos.clear();
    }
    local.forEach(listener => listener()); listeners.forEach(listener => listener());
  };
  const close = () => { closedWindows.add(win); win.document.removeEventListener('visibilitychange', sync); windows.delete(win); local.forEach(listener => listener()); listeners.forEach(listener => listener()); };
  windows.set(win, { listeners: local, cleanup: close });
  win.document.addEventListener('visibilitychange', sync); win.addEventListener('pagehide', close, { once: true });
  listeners.forEach(listener => listener());
}
export function observeWindowVisibility(win: Window, listener: Listener): () => void {
  registerActivityWindow(win); const entry = windows.get(win); entry?.listeners.add(listener);
  return () => entry?.listeners.delete(listener);
}
export function hasVisibleLyricsWindow(): boolean {
  if (typeof window !== 'undefined') registerActivityWindow(window);
  return [...windows.keys()].some(isWindowVisible);
}
export function observeLyricsVisibility(listener: Listener): () => void {
  if (typeof window !== 'undefined') registerActivityWindow(window);
  listeners.add(listener); return () => listeners.delete(listener);
}
export function waitForVisibleLyrics(): Promise<void> {
  if (hasVisibleLyricsWindow()) return Promise.resolve();
  return new Promise(resolve => { const stop = observeLyricsVisibility(() => { if (hasVisibleLyricsWindow()) { stop(); resolve(); } }); });
}
/** Visual polling owns no timer while its document is hidden. */
export function visibleInterval(win: Window, callback: () => void, ms: number): () => void {
  let timer: number | undefined;
  const sync = () => {
    if (timer !== undefined) { win.clearInterval(timer); timer = undefined; }
    if (isWindowVisible(win)) timer = win.setInterval(callback, ms);
  };
  const stop = observeWindowVisibility(win, () => { sync(); if (isWindowVisible(win)) callback(); }); sync();
  return () => { stop(); if (timer !== undefined) win.clearInterval(timer); };
}

export function waitForWindowVisible(win: Window): Promise<void> {
  if (isWindowVisible(win)) return Promise.resolve();
  return new Promise(resolve => { const stop = observeWindowVisibility(win, () => {
    if (isWindowVisible(win) || win.closed || closedWindows.has(win)) { stop(); resolve(); }
  }); });
}
