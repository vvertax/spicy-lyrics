import { visibleInterval } from "../../utils/WindowActivity.ts";
import { $smoothSceneTransitions, $lyricsRendererPaused } from "../../utils/stores.ts";
import { isExperimentEnabled } from "../../utils/experiments.ts";
import { getDisplayedLyrics } from "../../utils/Lyrics/DisplayedLyrics.ts";
import { LyricsObject } from "../../utils/Lyrics/lyrics.ts";
import GetProgress from "../../utils/Gets/GetProgress.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { createInstrumentalArtworkMotion } from "./InstrumentalArtworkMotion.ts";
import { isInstrumentalBreak } from "./InstrumentalBreak.ts";

type Scene = { uri?: string; pending?: string; outgoing?: HTMLElement; animations: Set<Animation>; timer: (() => void) | 0; unsubscribe?: () => void; artwork: ReturnType<typeof createInstrumentalArtworkMotion>; cancelReveal?: () => void; outgoingUntil?: number };
const scenes = new WeakMap<HTMLElement, Scene>();
const reduced = (page: HTMLElement) => page.ownerDocument.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches;

function animate(scene: Scene, element: HTMLElement, frames: Keyframe[], duration: number): void {
  const animation = element.animate(frames, { duration, easing: "cubic-bezier(.4,0,.2,1)" });
  scene.animations.add(animation);
  void animation.finished.catch(() => {}).finally(() => { scene.animations.delete(animation); });
}

export function mountScenePresentation(page: HTMLElement): void {
  unmountScenePresentation(page);
  const scene: Scene = { uri: SpotifyPlayer.GetUri(), animations: new Set(), timer: 0, artwork: createInstrumentalArtworkMotion(page) };
  scenes.set(page, scene);
  scene.unsubscribe = $smoothSceneTransitions.listen(enabled => {
    if (enabled) return;
    scene.cancelReveal?.();
    scene.outgoing?.remove(); scene.outgoing = undefined;
    scene.animations.forEach(animation => animation.cancel());
  });
  scene.timer = visibleInterval(page.ownerDocument.defaultView!,() => {
    if (!page.isConnected) { unmountScenePresentation(page); return; }
    const data = getDisplayedLyrics(SpotifyPlayer.GetUri());
    const layoutEligible = !reduced(page) && !page.ownerDocument.hidden && !$lyricsRendererPaused.get() &&
      page.classList.contains("NowBarStatus__Open") &&
      !page.matches(".CardMode, .CompactMode, .ForcedCompactMode, .VV_ComparingTTML, .CanvasImmersive, .VV_Recording") &&
      !page.querySelector(".LyricsContainer.LoadingLyrics");
    const eligible = layoutEligible && isExperimentEnabled("instrumentalArtwork") && data && data.Type !== "Static";
    const lines = data?.Type === "Syllable" ? LyricsObject.Types.Syllable.Lines : LyricsObject.Types.Line.Lines;
    const active = Boolean(eligible && isInstrumentalBreak(lines, GetProgress()));
    scene.artwork.update(active, !layoutEligible);
    page.classList.toggle("VV_InstrumentalArtwork", active);
  }, 150);
}

export function beginSceneTrackChange(page: HTMLElement | null, uri: string | undefined): void {
  if (!page || !uri) return;
  const scene = scenes.get(page);
  if (!scene || scene.uri === uri) return;
  scene.uri = uri;
  scene.cancelReveal?.();
  scene.pending = uri;
  scene.artwork.destroy();
  scene.outgoing?.remove();
  scene.outgoing = undefined;
  scene.animations.forEach(animation => animation.cancel());
  page.classList.remove("VV_InstrumentalArtwork");
  if (!$smoothSceneTransitions.get() || reduced(page) || page.ownerDocument.hidden || page.matches(".CardMode, .VV_ComparingTTML")) return;
  const content = page.querySelector<HTMLElement>(".LyricsContent");
  const container = page.querySelector<HTMLElement>(".LyricsContainer");
  if (content?.childElementCount && container && !container.classList.contains("LoadingLyrics")) {
    // A short-lived inert snapshot lets the real renderer and fetch continue immediately.
    // Never keep a second renderer alive or expose stale lyrics to the creative tools.
    const rect = content.getBoundingClientRect();
    const parent = container.getBoundingClientRect();
    const outgoing = page.ownerDocument.createElement("div");
    outgoing.className = "vv-scene-outgoing";
    outgoing.inert = true;
    outgoing.setAttribute("aria-hidden", "true");
    Object.assign(outgoing.style, { left: `${rect.left - parent.left}px`, top: `${rect.top - parent.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    const snapshot = content.cloneNode(true) as HTMLElement;
    snapshot.classList.remove("HiddenTransitioned", "InitialPositionPending");
    snapshot.removeAttribute("id");
    snapshot.querySelectorAll("[id]").forEach(element => element.removeAttribute("id"));
    const sources = [content, ...content.querySelectorAll<HTMLElement>("*")];
    const copies = [snapshot, ...snapshot.querySelectorAll<HTMLElement>("*")];
    const scrolls = sources.map((element, index) => ({ copy: copies[index], top: element.scrollTop, left: element.scrollLeft }));
    outgoing.append(snapshot);
    container.append(outgoing);
    // SimpleBar owns a nested scroll element. A cloned virtual list at scrollTop=0
    // often contains only the large spacer above the currently mounted lines.
    for (const { copy, top, left } of scrolls) { copy.scrollTop = top; copy.scrollLeft = left; }
    scene.outgoing = outgoing;
    scene.outgoingUntil = performance.now() + 440;
    animate(scene, outgoing, [{ opacity: 1, translate: "0 0" }, { opacity: 0, translate: "0 -10px" }], 420);
    window.setTimeout(() => { outgoing.remove(); if (scene.outgoing === outgoing) scene.outgoing = undefined; }, 440);
  }
  // NowBar already owns a cancellable metadata fade; keep it and the background crossfade intact.
}

/** Keep placeholders behind the outgoing text until its exit has finished. */
export function sceneLoaderDelay(page: HTMLElement | null, uri: string): number {
  if (!page || !$smoothSceneTransitions.get() || reduced(page)) return 0;
  const scene = scenes.get(page);
  return scene?.pending === uri && scene.outgoing
    ? Math.max(0, (scene.outgoingUntil ?? 0) - performance.now()) : 0;
}

export function revealSceneLyrics(page: HTMLElement, uri: string | undefined): void {
  const scene = scenes.get(page);
  if (!scene || !uri || scene.pending !== uri || SpotifyPlayer.GetUri() !== uri) return;
  scene.cancelReveal?.();
  if (!$smoothSceneTransitions.get() || reduced(page) || page.ownerDocument.hidden || page.matches(".CardMode, .VV_ComparingTTML")) { scene.pending = undefined; return; }
  const content = page.querySelector<HTMLElement>(".LyricsContent");
  if (!content) return;
  const container = page.querySelector<HTMLElement>(".LyricsContainer");
  let observer: MutationObserver | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    observer?.disconnect();
    if (timer !== undefined) clearTimeout(timer);
    if (scene.cancelReveal === cleanup) scene.cancelReveal = undefined;
  };
  const reveal = () => {
    if (scenes.get(page) !== scene || scene.pending !== uri || SpotifyPlayer.GetUri() !== uri || !page.isConnected) { cleanup(); return; }
    if (content.classList?.contains("InitialPositionPending") || content.classList?.contains("HiddenTransitioned") || container?.classList.contains("LoadingLyrics")) return;
    cleanup(); scene.pending = undefined;
    if (!$smoothSceneTransitions.get() || reduced(page)) return;
    animate(scene, content, [{ opacity: 0, translate: "0 12px" }, { opacity: 1, translate: "0 0" }], 650);
  };
  scene.cancelReveal = cleanup;
  reveal();
  if (scene.pending === uri) {
    // PositionInitialLyrics may still be scrolling the freshly mounted list.
    // Install its entrance when visibility is released, before the next paint.
    observer = new MutationObserver(reveal);
    observer.observe(content, { attributes: true, attributeFilter: ["class"] });
    if (container) observer.observe(container, { attributes: true, attributeFilter: ["class"] });
    timer = setTimeout(cleanup, 2000);
  }
}

export function unmountScenePresentation(page: HTMLElement | null): void {
  if (!page) return;
  const scene = scenes.get(page);
  if (scene) {
    scene.timer && scene.timer();
    scene.cancelReveal?.();
    scene.unsubscribe?.();
    scene.artwork.destroy();
    scene.outgoing?.remove();
    scene.animations.forEach(animation => animation.cancel());
    scenes.delete(page);
  }
  page.classList.remove("VV_InstrumentalArtwork");
}
