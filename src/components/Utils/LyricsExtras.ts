import { GetPageLyricsFooter, PinFooterDetailWithoutWriters, UnregisterLyricsFooterDetail } from "../../utils/Lyrics/Applyer/Credits/CreateLyricsFooter.ts";
import { toast } from "sonner";
import { $showLyricsSourceInfo, $showScrollResumeIndicator, $currentLyricsData, $uiLanguage } from "../../utils/stores.ts";
import { $experiment } from "../../utils/experiments.ts";
import { visibleInterval } from "../../utils/WindowActivity.ts";
import { getDisplayedLyrics } from "../../utils/Lyrics/DisplayedLyrics.ts";
import { getSongKey, LyricsStore, SessionTTMLStore } from "../../utils/Lyrics/fetchLyrics.ts";
import fetchLyrics from "../../utils/Lyrics/fetchLyrics.ts";
import { ApplyLyricsIfCurrent } from "../../utils/Lyrics/Global/Applyer.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { getScrollResumeState } from "../../utils/Scrolling/ScrollToActiveLine.ts";
import { triggerRemeasureLV } from "../../utils/Lyrics/LyricsVirtualizer.ts";
import { translateUi } from "../../utils/i18n/translate.ts";
export function bindLyricsExtras(page: HTMLElement) {
  const doc = page.ownerDocument, win = doc.defaultView!;
  const t = (s: string) => translateUi(s, $uiLanguage.get());
  const card = doc.createElement("div"); card.className = "LyricsProvider vv-source-info"; card.hidden = true;
  const info = doc.createElement("span"); info.setAttribute("data-i18n-ignore", "");
  const reload = doc.createElement("button"); reload.type = "button"; reload.textContent = t("Reload lyrics");
  card.append(info, reload);
  let sourceFooter: HTMLElement | undefined;
  reload.onclick = async () => {
    const uri = SpotifyPlayer.GetUri(); if (!uri) return; reload.disabled = true;
    try { await LyricsStore?.RemoveItem(getSongKey(uri)); if (uri !== SpotifyPlayer.GetUri()) return;
      $currentLyricsData.set(""); const data = await fetchLyrics(uri); await ApplyLyricsIfCurrent(uri, data);
    } catch (error) {
      console.warn("Spicy Lyrics: could not reload lyrics", error);
      if (uri === SpotifyPlayer.GetUri()) toast.error(t("Could not reload lyrics."));
    } finally { reload.disabled = false; }
  };
  const resume = doc.createElement("span"); resume.className = "vv-resume-indicator"; resume.hidden = true;
  resume.setAttribute("aria-hidden", "true"); resume.setAttribute("data-i18n-ignore", "");
  const zoom = doc.createElement("button"); zoom.type = "button"; zoom.className = "vv-zoom-badge"; zoom.hidden = true;
  page.append(zoom); let scale = 1, timer: number | undefined;
  const applyScale = () => { page.style.setProperty("--vv-lyrics-zoom", String(scale)); triggerRemeasureLV(); zoom.textContent = `${Math.round(scale * 100)}% · ${t("Reset")}`; };
  zoom.onclick = () => { scale = 1; applyScale(); zoom.hidden = true; };
  const wheel = (e: WheelEvent) => {
    if (!e.ctrlKey || e.metaKey || !$experiment("ctrlWheelLyricsZoom").get() ||
      !(e.target as Element)?.closest(".LyricsContainer") || (e.target as Element)?.closest("input,textarea,select,[contenteditable]")) return;
    e.preventDefault(); e.stopPropagation();
    scale = Math.round(Math.max(.6, Math.min(1.8, scale + (e.deltaY < 0 ? .05 : e.deltaY > 0 ? -.05 : 0))) * 100) / 100;
    applyScale(); zoom.hidden = false; win.clearTimeout(timer); timer = win.setTimeout(() => { zoom.hidden = true; }, 2000);
  };
  page.addEventListener("wheel", wheel, { passive: false, capture: true });
  const stopZoom = $experiment("ctrlWheelLyricsZoom").listen(enabled => { if (!enabled) { scale = 1; applyScale(); zoom.hidden = true; } });
  const setHidden = (element: HTMLElement, hidden: boolean) => { if (element.hidden !== hidden) element.hidden = hidden; };
  let signature = "";
  const stopTick = visibleInterval(win, () => {
    const uri = SpotifyPlayer.GetUri(), data = getDisplayedLyrics(uri);
    const footer = GetPageLyricsFooter(page);
    if (footer !== sourceFooter) {
      if (sourceFooter) UnregisterLyricsFooterDetail(card, sourceFooter);
      card.remove(); sourceFooter = footer;
      if (footer) { footer.append(card); PinFooterDetailWithoutWriters(card, footer); }
    }
    setHidden(card, !$showLyricsSourceInfo.get() || !data || !sourceFooter);
    if (!card.hidden) {
      const local = Boolean(data.fromLocal) || Boolean(uri && SessionTTMLStore.has(getSongKey(uri))) || Boolean(data.uri && !data.fetchProvider && !data.source);
      const source = local ? t("Local TTML") : String(data.sourceDisplayName ?? data.fetchProvider ?? data.source ?? t("Unknown source"));
      const type = t(data.Type === "Syllable" ? "Word synced" : data.Type === "Line" ? "Line synced" : "Unsynced");
      const value = `${source} · ${type}${data.fromCache ? ` · ${t("Cache")}` : data.fetchProvider && !local ? ` · ${t("Network")}` : ""}`;
      if (signature !== value) { signature = value; info.textContent = value; }
      const label = t("Reload lyrics"); if (reload.textContent !== label) reload.textContent = label;
    }
    const arrow = page.querySelector<HTMLButtonElement>("#ScrollToActiveLyric");
    if (arrow && resume.parentElement !== arrow) arrow.append(resume);
    const state = getScrollResumeState();
    setHidden(resume, !$showScrollResumeIndicator.get() || !state.active || !state.eligible || state.remaining <= 0);
    if (!resume.hidden) {
      const seconds = (Math.ceil(state.remaining / 100) / 10).toFixed(1).replace(".", $uiLanguage.get() === "ru" ? "," : ".");
      const value = `${seconds} ${$uiLanguage.get() === "ru" ? "с" : "s"}`;
      if (resume.textContent !== value) resume.textContent = value;
    }
  }, 100);
  return () => { stopTick(); stopZoom(); win.clearTimeout(timer); page.removeEventListener("wheel", wheel, true); if (sourceFooter) UnregisterLyricsFooterDetail(card, sourceFooter); card.remove(); resume.remove(); zoom.remove(); page.style.removeProperty("--vv-lyrics-zoom"); };
}
