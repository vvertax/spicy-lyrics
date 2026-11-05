import { waitForWindowVisible, visibleInterval } from "../../utils/WindowActivity.ts";
import { bindSubtitleLayout } from "./SubtitleLayout.ts";
import { createSubtitleReel } from "./SubtitleReel.ts";
import { createSubtitlePresence } from "./SubtitlePresence.ts";
import { onAnimationFrame } from "../../utils/AnimationFrameLoop.ts";
import { Icons } from "../Styling/Icons.ts";
import { $experiment } from "../../utils/experiments.ts";
import { $subtitlePanelVisible, $playbackOffset, $songPlaybackOffsets, $seekFadeCompensation, $uiLanguage, $simpleLyricsMode } from "../../utils/stores.ts";
import { effectiveOffset } from "../../utils/Lyrics/PlaybackOffsets.ts";
import { getDisplayedLyrics } from "../../utils/Lyrics/DisplayedLyrics.ts";
import fetchLyrics from "../../utils/Lyrics/fetchLyrics.ts";
import GetProgress from "../../utils/Gets/GetProgress.ts";
import { translateUi } from "../../utils/i18n/translate.ts";
import Global from "../Global/Global.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { subtitleAt, subtitleLines, subtitleBackingAt, type SubtitleLine } from "./SubtitleModel.ts";

// Temporarily disabled: backing parts change the tape height and make subtitles jump.
// To restore after fixing height stability, uncomment this import and the two
// subtitleBackingLines assignments below. Normal-page backing vocals are unaffected.
// import { subtitleBackingLines } from "./SubtitleModel.ts";

let initialized = false;
export function initSubtitleBar() {
  if (initialized) return;
  initialized = true;
  let stop: (() => void) | undefined;
  let removeClosing: (() => void) | undefined;
  const sync = () => {
    const enabled = $experiment("subtitleBar").get() && $subtitlePanelVisible.get();
    stop?.(); stop = undefined;
    if (!enabled) return;
    removeClosing?.(); removeClosing = undefined;
    const bar = document.createElement("section"); bar.id = "sl-subtitle-bar";
    bar.setAttribute("aria-label", "Lyrics subtitles");
    const watermark = document.createElement("div"); watermark.className = "sl-subtitle-watermark";
    watermark.setAttribute("aria-hidden", "true");
    watermark.innerHTML = Icons.LyricsPage.replace(/id="[^"]*"/g, "");
    const artwork = document.createElement("div"); artwork.className = "sl-subtitle-artwork";
    const image = document.createElement("img"); image.alt = ""; image.hidden = true;
    const fallback = document.createElement("span"); fallback.innerHTML = Icons.QuoteCard;
    artwork.append(image, fallback);
    image.onerror = () => { image.hidden = true; fallback.hidden = false; };
    const stage = document.createElement("div"); stage.className = "sl-subtitle-stage";
    const lyrics = document.createElement("div"); lyrics.className = "sl-subtitle-lyrics sl-lyrics-fragment";
    const close = document.createElement("button"); close.type = "button"; close.className = "sl-subtitle-close";
    close.innerHTML = Icons.Close; close.onclick = () => $subtitlePanelVisible.set(false);
    stage.append(lyrics); bar.append(watermark, artwork, stage, close); document.body.append(bar); bar.hidden = true;
    let uri: string | undefined, lines: SubtitleLine[] = [], backingLines: SubtitleLine[] = [], generation = 0, disposed = false;
    let source: any = null, loading = false, footer: Element | null = null;
    let unsubscribeFrame: (() => void) | undefined, simpleMode: boolean | undefined;
    const reel = createSubtitleReel(lyrics, line => seek(line));
    const clearRenderer = () => { reel.clear(); simpleMode = undefined; };
    const presence = createSubtitlePresence(bar, stage, clearRenderer);
    const hide = () => { unsubscribeFrame?.(); unsubscribeFrame = undefined; return presence.hide(); };
    const layout = bindSubtitleLayout(bar, artwork, close);
    const positionBar = () => layout.position();
    const observer = new ResizeObserver(positionBar); observer.observe(bar);

    const seek = (line?: SubtitleLine) => {
      if (!line || SpotifyPlayer.GetUri() !== uri) return;
      const offset = effectiveOffset($playbackOffset.get(), $songPlaybackOffsets.get(), uri);
      SpotifyPlayer.Seek(Math.max(0, line.start + offset - ($seekFadeCompensation.get() ? 300 : 0)));
    };
    const paint = () => {
      if (disposed || document.hidden || !presence.visible || bar.hidden || SpotifyPlayer.GetUri() !== uri) return;
      const position = GetProgress();
      const { current, next } = subtitleAt(lines, position);
      const activeBacking = subtitleBackingAt(backingLines, position);
      if (!current && !next && !activeBacking.length) { hide(); return; }
      if (simpleMode !== $simpleLyricsMode.get()) { reel.clear(); simpleMode = $simpleLyricsMode.get(); }
      lyrics.classList.toggle("SimpleLyricsMode", simpleMode);
      reel.update(lines, current, next, activeBacking, source, position);
    };
    const refresh = async () => {
      const requested = SpotifyPlayer.GetUri();
      await waitForWindowVisible(window);
      if (disposed || SpotifyPlayer.GetUri() !== requested) return;
      uri = requested;
      const token = ++generation;
      const exit = hide(); lines = []; backingLines = []; source = null; loading = true;
      const cover = SpotifyPlayer.GetCover?.("small");
      const coverUrl = cover?.startsWith("spotify:image:") ? `https://i.scdn.co/image/${cover.slice(14)}` : cover;
      image.hidden = !coverUrl || !/^https?:\/\//.test(coverUrl); fallback.hidden = !image.hidden;
      if (!image.hidden) image.src = coverUrl!;
      if (!requested) { loading = false; return; }
      const displayed = getDisplayedLyrics(requested);
      try {
        const data = displayed ?? (await fetchLyrics(requested, { keepCurrentLyricsVisible: true }))?.[0];
        await exit;
        if (disposed || token !== generation || SpotifyPlayer.GetUri() !== requested) return;
        source = data; lines = subtitleLines(data);
        // backingLines = subtitleBackingLines(data); // Disabled until reel height is stable.
      } catch { /* Keep unavailable lyrics out of the floating panel. */ }
      finally { if (!disposed && token === generation) loading = false; }
      tick();
    };
    const tick = () => {
      if (disposed) return;
      if (SpotifyPlayer.GetUri() !== uri) { void refresh(); return; }
      if (document.hidden) { hide(); return; }
      const displayed = getDisplayedLyrics(uri);
      if (!loading && displayed && source !== displayed) {
        clearRenderer(); source = displayed; lines = subtitleLines(displayed);
        // backingLines = subtitleBackingLines(displayed); // Disabled until reel height is stable.
      }
      const player = document.querySelector(".Root__now-playing-bar, .main-nowPlayingBar-nowPlayingBar");
      if (player !== footer) { observer.disconnect(); observer.observe(bar); footer = player; if (footer) observer.observe(footer); positionBar(); }
      if (loading || !footer || (!lines.length && !backingLines.length) || document.fullscreenElement || document.querySelector("#SpicyLyricsPage:not(.CardMode)")) { hide(); return; }
      const position = GetProgress();
      const available = subtitleAt(lines, position);
      if (!available.current && !available.next && !subtitleBackingAt(backingLines, position).length) { void hide(); return; }
      void presence.show();
      // The polling timer manages availability only; animation has one frame clock.
      if (!unsubscribeFrame) {
        paint();
        if (!bar.hidden) unsubscribeFrame = onAnimationFrame(paint, window);
      }
      close.title = translateUi("Hide subtitles", $uiLanguage.get()); close.setAttribute("aria-label", close.title);
      bar.setAttribute("aria-label", translateUi("Lyrics subtitles", $uiLanguage.get()));
    };
    const id = Global.Event.listen("playback:songchange", () => { void refresh(); });
    window.addEventListener("resize", positionBar);
    const stopTimer = visibleInterval(window, tick, 150);
    void refresh();
    stop = () => { disposed = true; generation++; const exit = hide(); stopTimer(); observer.disconnect(); layout.destroy();
      window.removeEventListener("resize", positionBar); Global.Event.unListen(id);
      const remove = () => { presence.destroy(); reel.destroy(); bar.remove(); if (removeClosing === remove) removeClosing = undefined; };
      removeClosing = remove; void exit.then(remove);
    };
  };
  $experiment("subtitleBar").listen(sync);
  $subtitlePanelVisible.subscribe(sync);
}
