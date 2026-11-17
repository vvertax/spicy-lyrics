/** Keep an externally positioned control inside the visible page, even when its cover is scaled. */
export function volumeSliderShift(rect: { left: number; right: number; width: number }, page: { left: number; right: number }, viewportWidth: number, previous: number, cssWidth: number): number {
  const inset = 12;
  const scale = cssWidth > 0 && rect.width > 0 ? rect.width / cssWidth : 1;
  const left = Math.max(0, page.left) + inset;
  const right = Math.min(viewportWidth, page.right) - inset;
  if (![left, right, rect.left, rect.right, scale].every(Number.isFinite) || right <= left) return previous;
  const naturalLeft = rect.left - previous * scale;
  const naturalRight = rect.right - previous * scale;
  return Math.round((naturalLeft < left ? left - naturalLeft : naturalRight > right ? right - naturalRight : 0) / scale * 100) / 100;
}

export function keepVolumeSliderInView(slider: HTMLElement, page: HTMLElement): () => void {
  const win = slider.ownerDocument.defaultView!;
  let frame: number | null = null;
  let shift = 0;
  const update = () => {
    frame = null;
    if (!slider.isConnected || slider.offsetWidth === 0) return;
    const next = volumeSliderShift(slider.getBoundingClientRect(), page.getBoundingClientRect(), slider.ownerDocument.documentElement.clientWidth || win.innerWidth, shift, slider.offsetWidth);
    if (next !== shift) { shift = next; slider.style.setProperty("--fullscreen-volume-shift", `${shift}px`); }
  };
  const schedule = () => { if (frame === null) frame = win.requestAnimationFrame(update); };
  const Observer = (win as Window & typeof globalThis).ResizeObserver;
  const observer = new Observer(schedule);
  observer.observe(page); observer.observe(slider); if (slider.parentElement) observer.observe(slider.parentElement);
  win.addEventListener("resize", schedule);
  // Side changes and cover transitions can move the anchor without resizing it.
  const onLayoutEnd = (event: Event) => { if ((event.target as Element)?.closest?.(".NowBar")) schedule(); };
  page.addEventListener("transitionend", onLayoutEnd);
  page.addEventListener("animationend", onLayoutEnd);
  schedule();
  return () => { observer.disconnect(); win.removeEventListener("resize", schedule); page.removeEventListener("transitionend", onLayoutEnd); page.removeEventListener("animationend", onLayoutEnd); if (frame !== null) win.cancelAnimationFrame(frame); };
}
