import { onAnimationFrame } from "../../utils/AnimationFrameLoop.ts";

/** Caption follows the actual lower edge of the scaled and rotated cover. */
export function instrumentalArtworkFrame(width: number, height: number, level: number, phase: number) {
  const scale = 1 + level * (.062 + .009 * Math.sin(phase));
  const angle = level * .65 * Math.sin(phase * .73);
  const y = level * Math.min(12, height * .018) * (-.5 + .5 * Math.sin(phase * 1.13));
  const radians = angle * Math.PI / 180;
  const lowerEdge = (height * Math.cos(radians) + width * Math.abs(Math.sin(radians))) * scale / 2 - height / 2;
  const captionY = y + lowerEdge + level * Math.min(20, Math.max(10, height * .025));
  return { scale, angle, y, captionY };
}

/** One capped frame subscription, owned by the page, active only during entry, drift and return. */
export function createInstrumentalArtworkMotion(page: HTMLElement) {
  let cover: HTMLElement | null = null;
  let caption: HTMLElement | null = null;
  let observer: ResizeObserver | null = null;
  let unsubscribe: (() => void) | null = null;
  let targetWindow: Window | null = null;
  let width = 0, height = 0, level = 0, phase = 0, lastFrame: number | null = null;
  let active = false;

  const measure = () => {
    // Read untransformed dimensions together, never between frame writes.
    width = cover?.offsetWidth ?? 0; height = cover?.offsetHeight ?? 0;
  };
  function reset() {
    unsubscribe?.(); unsubscribe = null;
    observer?.disconnect(); observer = null;
    page.classList.remove("VV_InstrumentalMotion");
    for (const key of ["--vv-art-scale", "--vv-art-y", "--vv-art-angle"]) cover?.style.removeProperty(key);
    caption?.style.removeProperty("--vv-caption-y");
    cover = caption = null;
    level = phase = 0; lastFrame = null; active = false;
  }
  function frame(timestamp: number) {
    if (!page.isConnected || !cover?.isConnected || !caption?.isConnected ||
        page.ownerDocument.hidden || page.ownerDocument.defaultView !== targetWindow ||
        targetWindow?.matchMedia("(prefers-reduced-motion: reduce)").matches) { reset(); return; }
    const elapsed = lastFrame === null ? 0 : Math.max(0, Math.min(64, timestamp - lastFrame));
    lastFrame = timestamp;
    level += ((active ? 1 : 0) - level) * (1 - Math.exp(-elapsed / 145));
    if (!active && level < .0005) { reset(); return; }
    // Pause holds the drift in place; changing modes can still ease back to rest.
    if (Spicetify.Player.isPlaying()) phase += elapsed * Math.PI * 2 / 7200;
    const value = instrumentalArtworkFrame(width, height, level, phase);
    cover.style.setProperty("--vv-art-scale", String(value.scale));
    cover.style.setProperty("--vv-art-y", `${value.y}px`);
    cover.style.setProperty("--vv-art-angle", `${value.angle}deg`);
    caption.style.setProperty("--vv-caption-y", `${value.captionY}px`);
  }
  return {
    update(enabled: boolean, immediate = false) {
      if (immediate) { reset(); return; }
      if (cover && (page.ownerDocument.defaultView !== targetWindow || !cover.isConnected || !caption?.isConnected)) reset();
      active = enabled;
      if (!enabled || unsubscribe) return;
      cover = page.querySelector<HTMLElement>(".NowBar .Header .MediaBox .MediaImageContainer");
      caption = page.querySelector<HTMLElement>(".NowBar .Header > .Metadata");
      targetWindow = page.ownerDocument.defaultView;
      if (!cover || !caption || !targetWindow) { reset(); return; }
      measure();
      observer = new ResizeObserver(measure); observer.observe(cover);
      // Initialize at rest before enabling the CSS, avoiding a flash on entry.
      cover.style.setProperty("--vv-art-scale", "1");
      cover.style.setProperty("--vv-art-y", "0px");
      cover.style.setProperty("--vv-art-angle", "0deg");
      caption.style.setProperty("--vv-caption-y", "0px");
      page.classList.add("VV_InstrumentalMotion");
      unsubscribe = onAnimationFrame(frame, targetWindow);
    },
    destroy: reset,
  };
}
