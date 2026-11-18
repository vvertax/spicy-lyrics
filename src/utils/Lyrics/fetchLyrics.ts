import { nextLyricsCache } from "./PrefetchedLyrics.ts";
import { hasVisibleLyricsWindow, observeLyricsVisibility } from "../WindowActivity.ts";
import { checkRequest } from "./RequestAbort.ts";
import { beginSceneTrackChange } from "../../components/Utils/ScenePresentation.ts";
import Defaults, { isDev } from "../../components/Global/Defaults.ts";
import { $currentLyricsData, $currentLyricsType, $currentlyFetching } from "../stores.ts";
import { SpotifyPlayer } from "../../components/Global/SpotifyPlayer.ts";
import PageView, { PageContainer } from "../../components/Pages/PageView.ts";
import { JapaneseRomajiIsCurrent, ProcessLyrics } from "./ProcessLyrics.ts";
import { IsEmptyLyrics } from "./EmptyLines.ts";
import Logger from "../Logger.ts";
import { LocalLyricsManager } from "./manager/index.ts";
import { GetExpireStore } from "../../modules/Store.ts";
import { fetchLyricsFromProviders } from "./ExternalSources.ts";
import {
  normalizeLyricsSourceOrder,
  type LyricsSourceProviderId,
} from "./LyricsSourcePreferences.ts";

import { isCurrentTrack } from "./Sources/Track.ts";
import { LyricsQueueRetry } from "./LyricsQueueRetry.ts";
import { HideLoaderContainer, ShowLoaderContainer } from "./LyricsLoader.ts";
import { getRemoteConfig } from "../remoteConfig.ts";
import { SetShownNotice, SyncNoLyricsLayout } from "./LyricsNotice.ts";

export { LYRICS_QUEUE_MESSAGE, ShowQueueLoader } from "./LyricsLoader.ts";

const lyricsLogger = new Logger("Lyrics Pipeline");
const lyricsCacheLogger = new Logger("Lyrics Cache");

export const LyricsStore = GetExpireStore<any>("SpicyLyrics_LyricsStore_g2", 6, {
  Unit: "Days",
  get Duration() { return getRemoteConfig().cache.lyricsTtlDays; },
}, isDev as true);

export const SessionTTMLStore = new Map<string, any>();
const LYRICS_SOURCE_CACHE_VERSION = 4;
const controllers = new Set<AbortController>();
let pendingVisibility: { uri: string; resolve: (value: boolean) => void; promise: Promise<boolean> } | undefined;
function waitForLyricsActivity(uri: string): Promise<boolean> {
  if (!isCurrentTrack(uri)) return Promise.resolve(false);
  if (hasVisibleLyricsWindow()) return Promise.resolve(isCurrentTrack(uri));
  if (pendingVisibility?.uri === uri) return pendingVisibility.promise;
  pendingVisibility?.resolve(false);
  let resolve!: (value: boolean) => void;
  const promise = new Promise<boolean>(done => { resolve = done; });
  pendingVisibility = { uri, resolve, promise }; return promise;
}
observeLyricsVisibility(() => {
  if (!hasVisibleLyricsWindow()) { controllers.forEach(controller => controller.abort()); cancelPendingBackoff?.(); return; }
  const pending = pendingVisibility; pendingVisibility = undefined;
  pending?.resolve(isCurrentTrack(pending.uri));
});
const inFlightLyricsFetches = new Map<string, Promise<[object | string, number] | null>>();
export type FetchLyricsResult = [object | string, number] | null;
export type LyricsFetchFailure = { uri: string; source: string; detail?: string };
let lastFailure: LyricsFetchFailure | null = null;
function noteFailure(uri: string, source: string, detail?: unknown): void {
  lastFailure = { uri, source, detail: detail instanceof Error ? `${detail.name}: ${detail.message}` : detail === undefined ? undefined : String(detail) };
}
export function GetLastLyricsFailure(uri: string | undefined): LyricsFetchFailure | null {
  return uri && lastFailure?.uri === uri ? lastFailure : null;
}
let lastNetworkStageAt = -Infinity;
let cancelPendingBackoff: (() => void) | null = null;
function backOffIfSwitchingFast(): Promise<boolean> {
  const { rapidSwitchWindowMs, rapidSwitchBackoffMs } = getRemoteConfig().lyricsFetch;
  const now = performance.now();
  const switchingFast = now - lastNetworkStageAt < rapidSwitchWindowMs;
  lastNetworkStageAt = now;
  if (!switchingFast) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => { cancelPendingBackoff = null; resolve(true); }, rapidSwitchBackoffMs);
    cancelPendingBackoff = () => { clearTimeout(timer); cancelPendingBackoff = null; resolve(false); };
  });
}

function finishFetching(uri: string): void {
  if (isCurrentTrack(uri)) $currentlyFetching.set(false);
}

async function prepareLyricsForPresentation<T extends Record<string, any>>(lyrics: T, signal?: AbortSignal): Promise<T> {
  checkRequest(signal);
  const prepared =
    typeof structuredClone === "function"
      ? structuredClone(lyrics)
      : JSON.parse(JSON.stringify(lyrics));
  await ProcessLyrics(prepared);
  checkRequest(signal);
  return prepared;
}

export function getSongKey(uri: string): string {
  if (!uri || !uri.trim() || !uri.startsWith("spotify:")) return "";
  if (uri.startsWith("spotify:local:")) return uri;
  return uri.split(":")[2] ?? "";
}

export function getActiveLyricsSourceOrder(): LyricsSourceProviderId[] {
  const order = normalizeLyricsSourceOrder(Defaults.LyricsSourceOrder);
  const disabled = new Set(Defaults.DisabledLyricsSourceIds);
  return order.filter((provider) => !disabled.has(provider));
}

export function getLyricsSourceCacheSignature(): string {
  return JSON.stringify({
    version: LYRICS_SOURCE_CACHE_VERSION,
    writtenRomaji: JapaneseRomajiIsCurrent({ Language: "jpn", JapaneseRomaji: "written2" }),
    order: normalizeLyricsSourceOrder(Defaults.LyricsSourceOrder),
    disabled: Defaults.DisabledLyricsSourceIds,
    ignoreMusixmatchWordSync: Defaults.IgnoreMusixmatchWordSync,
    prioritizeAppleMusicQuality: Defaults.PrioritizeAppleMusicQuality,
  });
}

function isProviderFetchedLyricsCache(data: any): boolean {
  return !!data && typeof data === "object" && (
    typeof data.fetchProvider === "string" ||
    typeof data.source === "string" ||
    typeof data.sourceDisplayName === "string"
  );
}

function attachLyricsSourceCacheMetadata(lyrics: any): any {
  if (!isProviderFetchedLyricsCache(lyrics)) return lyrics;
  return {
    ...lyrics,
    LyricsSourceCacheSignature: getLyricsSourceCacheSignature(),
  };
}
/** Which stage last served lyrics, for the bug report: a cached copy is the usual suspect. */
let lastAnswer: { uri: string; from: "already loaded" | "Local DB" | "cache" | "API" } | null = null;

/** Where `uri`'s lyrics came from, or `null` if it hasn't been served lyrics. */
export function GetLyricsAnsweredFrom(uri: string | undefined): string | null {
  return uri && lastAnswer?.uri === uri ? lastAnswer.from : null;
}

/**
 * Whether `uri` is showing a "Just once" TTML upload. It exists only in
 * `$currentLyricsData`, so clearing that to refetch would replace it with the
 * song's normal lyrics.
 */
export function HoldsTemporaryUpload(uri: string | undefined): boolean {
  const saved = $currentLyricsData.get();
  if (uri && SessionTTMLStore.has(getSongKey(uri))) return true;
  if (!uri || !saved.startsWith("{")) return false;
  try {
    const data = JSON.parse(saved);
    return data?.temporaryUpload === true && data.uri === uri;
  } catch {
    return false;
  }
}

/**
 * The uri of the most recent fetch request. Unlike `inFlightUri` this is never
 * cleared, so a fetch that finishes *after* the one that superseded it still
 * sees that it lost the race.
 */
let latestRequestedUri: string | null = null;

function isLyricsCacheCompatible(data: any): boolean {
  if (!JapaneseRomajiIsCurrent(data)) return false;
  if (!isProviderFetchedLyricsCache(data)) return true;
  return JapaneseRomajiIsCurrent(data) && data.LyricsSourceCacheSignature === getLyricsSourceCacheSignature();
}

function setRomanizationClass(hasTransliterations: boolean | undefined): void {
  PageContainer?.classList.toggle("Lyrics_RomanizationAvailable", Boolean(hasTransliterations));
}

/**
 * Publish fetched lyrics and view controls. The applier finishes the loader
 * after the lyrics DOM is ready, including cache and local TTML results.
 */
async function presentLyrics(uri: string, lyricsData: any): Promise<void> {
  if (!isCurrentTrack(uri)) return;
  LyricsQueueRetry.NotifyResolved(uri);
  setRomanizationClass(lyricsData?.HasTransliterations);
  $currentLyricsType.set(lyricsData.Type);
  SetShownNotice(null);
  SyncNoLyricsLayout();
  PageView.AppendViewControls(true);
  finishFetching(uri);
}

type FetchLyricsOptions = {
  reloadLocalLyrics?: boolean;
  keepCurrentLyricsVisible?: boolean;
  signal?: AbortSignal;
};

async function presentStoredLyrics(
  uri: string,
  lyricsData: Record<string, any>, signal?: AbortSignal
): Promise<[object, number]> {
  const preparedLyrics = await prepareLyricsForPresentation(lyricsData, signal);
  if (isCurrentTrack(uri)) $currentLyricsData.set(JSON.stringify(preparedLyrics));
  lastAnswer = { uri, from: "already loaded" };
          await presentLyrics(uri, preparedLyrics);
  return [preparedLyrics, 200];
}

export default async function fetchLyrics(
  uri: string,
  options: FetchLyricsOptions = {}
): Promise<[object | string, number] | null> {
  if (!(await waitForLyricsActivity(uri))) return null;
  const fetchKey = getSongKey(uri) || uri;
  const existingFetch = inFlightLyricsFetches.get(fetchKey);
  if (existingFetch) {
    if (isCurrentTrack(uri) && !options.keepCurrentLyricsVisible) ShowLoaderContainer(uri);
    let result;
    try { result = await existingFetch; } catch (error) {
      if ((error as Error)?.name !== "AbortError") throw error;
      return fetchLyrics(uri, options);
    }
    return options.reloadLocalLyrics ? fetchLyrics(uri, options) : isCurrentTrack(uri) ? result : null;
  }
  if (options.reloadLocalLyrics && isCurrentTrack(uri)) $currentLyricsData.set("");

  const controller = new AbortController(); controllers.add(controller);
  const promise = fetchLyricsInternal(uri, { ...options, signal: controller.signal });
  inFlightLyricsFetches.set(fetchKey, promise);
  try {
    const result = await promise;
    checkRequest(controller.signal);
    return isCurrentTrack(uri) ? result : null;
  } catch (error) {
    if (!controller.signal.aborted) throw error;
    if (inFlightLyricsFetches.get(fetchKey) === promise) inFlightLyricsFetches.delete(fetchKey);
    controllers.delete(controller);
    if (!(await waitForLyricsActivity(uri))) return null;
    return fetchLyrics(uri, options);
  } finally {
    controllers.delete(controller);
    if (inFlightLyricsFetches.get(fetchKey) === promise) {
      inFlightLyricsFetches.delete(fetchKey);
    }
  }
}

async function fetchLyricsInternal(
  uri: string,
  options: FetchLyricsOptions
): Promise<[object | string, number] | null> {
  checkRequest(options.signal);
  lyricsLogger.debug("Fetch requested", uri);
  cancelPendingBackoff?.();
  if (lastFailure?.uri === uri) lastFailure = null;
  const LyricsContent =
    PageContainer?.querySelector(".LyricsContainer .LyricsContent") ?? undefined;
  if (LyricsContent?.classList.contains("offline")) {
    LyricsContent.classList.remove("offline");
  }

  if (SpotifyPlayer.IsDJ()) {
    finishFetching(uri);
    return ["dj", 400];
  }

  // Ads (music ads, podcast pre-rolls) can be audio or video, so this goes before the media checks.
  if (SpotifyPlayer.GetContentType() === "ad") {
    $currentlyFetching.set(false);
    return ["ad", 400];
  }

  const mediaType = SpotifyPlayer.GetMediaType();

  if (mediaType && mediaType !== "audio") {
    $currentlyFetching.set(false);
    if (mediaType === "video") {
      return ["video-track", 400];
    } else if (mediaType === "mixed") {
      return ["mixed-track", 400];
    }
    return ["unknown-track", 400];
  }

  const isLocalTrack = uri.startsWith("spotify:local:");
  const contentType = SpotifyPlayer.GetContentType();
  if (!isLocalTrack && contentType !== "track") {
    $currentlyFetching.set(false);
    if (contentType === "episode") {
      return ["episode-track", 400];
    }
    return ["unknown-track", 400];
  }

  const songKey = getSongKey(uri);
  const trackId = isLocalTrack ? songKey : uri.split(":")[2];

  if (isCurrentTrack(uri)) $currentlyFetching.set(true);

  if (isCurrentTrack(uri) && !options.keepCurrentLyricsVisible) {
    beginSceneTrackChange(PageContainer, uri);
    LyricsContent?.classList.add("HiddenTransitioned");
    ShowLoaderContainer(uri);
  }


  // Check if there's already data in localStorage
  const savedLyricsData = $currentLyricsData.get();

  // Dev builds always refetch, except for an upload that nothing could refetch.
  if (savedLyricsData && (!isDev || HoldsTemporaryUpload(uri))) {
    try {
      if (!savedLyricsData.startsWith("NO_LYRICS:")) {
        const lyricsData = JSON.parse(savedLyricsData);
        // Return the stored lyrics if the ID matches the track ID
        if ((lyricsData?.id === trackId || lyricsData?.uri === uri) && isLyricsCacheCompatible(lyricsData)) {
          const preparedLyrics = await prepareLyricsForPresentation(lyricsData, options.signal);
          lastAnswer = { uri, from: "already loaded" };
          await presentLyrics(uri, preparedLyrics);
          return [preparedLyrics, 200];
        }
      }
    } catch (error) {
      checkRequest(options.signal);
      lyricsCacheLogger.error("Error parsing saved lyrics data", error);
      finishFetching(uri);
      HideLoaderContainer(uri);
    }
  }

  const sessionLyric = songKey ? SessionTTMLStore.get(songKey) : undefined;
  if (sessionLyric) {
    return presentStoredLyrics(uri, { ...sessionLyric, id: trackId, fromCache: true, fromLocal: true }, options.signal);
  }

  const localLyric = await LocalLyricsManager.get(uri, SpotifyPlayer.GetDuration());
  checkRequest(options.signal);
  if (localLyric) {
    lastAnswer = { uri, from: "Local DB" };
    return presentStoredLyrics(uri, { ...localLyric, id: trackId, fromLocal: true }, options.signal);
  }

  // Local files have no real track id (uri.split(":")[2] is the URL-encoded
  // artist name), so they can't be looked up in LyricsStore or fetched from the
  // API. Bail out here — after LocalLyricsManager.get() (which serves any
  // user-uploaded TTML) but before the meaningless remote cache read.
  if (isLocalTrack) {
    finishFetching(uri);
    HideLoaderContainer(uri);
    return ["local-track", 400];
  }

  if (LyricsStore) {
    try {
      const lyricsFromCache = await LyricsStore.GetItem(trackId);
      checkRequest(options.signal);
      if (lyricsFromCache) {
        if (lyricsFromCache.Value === "NO_LYRICS") {
          finishFetching(uri);
          HideLoaderContainer(uri);
          noteFailure(uri, "lyrics cache");
          return ["lyrics-not-found", 404];
        }
        if (isLyricsCacheCompatible(lyricsFromCache)) {
          lastAnswer = { uri, from: "cache" };
          return await presentStoredLyrics(uri, { ...lyricsFromCache, fromCache: true }, options.signal);
        }
        void LyricsStore.RemoveItem(trackId).catch(() => {});
      }
    } catch (error) {
      checkRequest(options.signal);
      lyricsCacheLogger.error("Error parsing cache entry", error);
      await LyricsStore.RemoveItem(trackId).catch(() => {});
      noteFailure(uri, "lyrics cache", error);
      finishFetching(uri);
      HideLoaderContainer(uri);
      return ["unknown-error", 0];
    }
  }


  if (!navigator.onLine) {
    finishFetching(uri);
    HideLoaderContainer(uri);
    return ["offline", 400];
  }

  try {
    if (!isCurrentTrack(uri) || !(await backOffIfSwitchingFast()) || !isCurrentTrack(uri)) return null;
    const prefetched = await nextLyricsCache.take(uri,getLyricsSourceCacheSignature());
    checkRequest(options.signal);
    if(!isCurrentTrack(uri))return null;
    const providerResult = prefetched ?? await fetchLyricsFromProviders(
      uri,
      getActiveLyricsSourceOrder(),
      { signal: options.signal },
    );
    checkRequest(options.signal);
    if (!isCurrentTrack(uri)) return null;
    if (providerResult?.status === 503) {
      finishFetching(uri);
      LyricsQueueRetry.HandleQueued(uri);
      return ["lyrics-queued", 503];
    }
    const lyrics = providerResult?.lyrics;

    if (lyrics === null || lyrics === undefined || lyrics === "") {
      noteFailure(uri, "API", "no provider returned lyrics");
      HideLoaderContainer(uri);
      finishFetching(uri);
      return ["lyrics-not-found", 404];
    }

    const romanizedInFull = await ProcessLyrics(lyrics);
    checkRequest(options.signal);

    if (IsEmptyLyrics(lyrics)) {
      lyricsLogger.warn("Lyrics payload had no renderable lines after pruning");
      noteFailure(uri, "API", "no renderable lines after pruning");
      HideLoaderContainer(uri);
      finishFetching(uri);
      return ["lyrics-not-found", 404];
    }

    const lyricsWithId = attachLyricsSourceCacheMetadata({ ...lyrics, id: trackId });
    if (isCurrentTrack(uri)) $currentLyricsData.set(JSON.stringify(lyricsWithId));

    // The request already completed, so cache it either way — even if the user
    // has skipped on, the next play of this track gets a cache hit. Lyrics whose
    // romanization was cut short (the Japanese dictionary still loading, say)
    // aren't cached, so the next play romanizes them in full.
    if (LyricsStore && romanizedInFull) {
      try {
        await LyricsStore.SetItem(trackId, lyricsWithId);
      } catch (error) {
        lyricsCacheLogger.error("Error saving lyrics to cache", error);
      }
    }

    lastAnswer = { uri, from: "API" };
    await presentLyrics(uri, lyricsWithId);
    return [{ ...lyricsWithId, fromCache: false }, 200];
  } catch (error) {
    checkRequest(options.signal);
    lyricsLogger.error("Error fetching lyrics", error);
    noteFailure(uri, "API", error);
    finishFetching(uri);
    HideLoaderContainer(uri);
    return ["unknown-error", 0];
  }
}

/**
 * Clear the lyrics container content
 */
export function ClearLyricsPageContainer(): void {
  const lyricsContent = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .LyricsContent"
  );
  if (lyricsContent) {
    lyricsContent.innerHTML = "";
  }
  PageContainer?.querySelector<HTMLElement>(".LyricsContainer .LyricsPinnedFooter")?.replaceChildren();
}
