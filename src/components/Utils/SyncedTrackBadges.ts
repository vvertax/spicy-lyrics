import { $experiment } from "../../utils/experiments.ts";
import { getSpicyLyricsAvailability, isSyncedSpicyLyrics, onSpicyLyricsAvailability, rememberSpicyLyricsAvailability } from "../../utils/Lyrics/SyncedTrackAvailability.ts";
import { translateUi } from "../../utils/i18n/translate.ts";
import { $uiLanguage } from "../../utils/stores.ts";
import { Icons } from "../Styling/Icons.ts";

const LIST = '[data-testid="playlist-tracklist"], [data-testid="album-tracklist"], [data-testid="track-list"], .main-trackList-trackList';
const ROW = '[data-testid="tracklist-row"], .main-trackList-trackListRow';
const TITLE = '[data-testid="internal-track-link"], [data-testid="track-name"], .main-trackList-rowTitle';
const BADGE = "sl-synced-track-badge";

type RowProps = { uri?: unknown; trackUri?: unknown; track?: { uri?: unknown }; item?: { uri?: unknown };
  children?: { props?: RowProps } | Array<{ props?: RowProps }> };
type Fiber = { memoizedProps?: RowProps; return?: Fiber };

function spotifyTrackId(value: unknown) {
  return typeof value === "string" ? value.match(/^(?:spotify:track:|\/track\/|https:\/\/open\.spotify\.com\/track\/)([a-zA-Z0-9]{22})(?:[?#].*)?$/)?.[1] : undefined;
}

function propsTrackId(props: RowProps | undefined) {
  if (!props) return undefined;
  return [props.uri, props.trackUri, props.track?.uri, props.item?.uri].map(spotifyTrackId).find(Boolean);
}

export function getTracklistRowId(row: HTMLElement) {
  const title = row.querySelector(TITLE);
  const attributes = [row.getAttribute("data-uri"), row.getAttribute("data-track-uri"),
    title?.getAttribute("href"), title?.getAttribute("data-uri"), title?.querySelector("a")?.getAttribute("href")];
  const directId = attributes.map(spotifyTrackId).find(Boolean);
  if (directId) return directId;

  // Recent clients often render a plain title and keep the URI on the React row.
  const reactRow = row as unknown as Record<string, unknown>;
  const keys = Object.keys(reactRow);
  const propsKey = keys.find(key => key.startsWith("__reactProps$"));
  const props = propsKey ? reactRow[propsKey] as RowProps : undefined;
  const children = Array.isArray(props?.children) ? props.children : [props?.children];
  const propsId = propsTrackId(props) ?? children.map(child => propsTrackId(child?.props)).find(Boolean);
  if (propsId) return propsId;
  const fiberKey = keys.find(key => key.startsWith("__reactFiber$"));
  let fiber = fiberKey ? reactRow[fiberKey] as Fiber : undefined;
  for (let depth = 0; fiber && depth < 4; depth++, fiber = fiber.return) {
    const id = propsTrackId(fiber.memoizedProps);
    if (id) return id;
  }
  return undefined;
}

export function observeSyncedTrackBadges(doc: Document, root: HTMLElement, readCachedLyrics: (id: string) => Promise<unknown>) {
  const view = doc.defaultView!;
  const displayed = new Map<HTMLElement, HTMLElement>();
  const results = new Map<string, { confirmed: boolean; checked: number }>();
  const pending = new Set<string>();
  let stopped = false;
  let frame = 0;
  const label = () => translateUi("Synced community lyrics from Spicy Lyrics", $uiLanguage.get());

  function clear(row: HTMLElement) {
    displayed.get(row)?.remove();
    displayed.delete(row);
  }

  function schedule() {
    if (!stopped && !frame) frame = view.requestAnimationFrame(refresh);
  }

  async function check(id: string) {
    if (pending.has(id)) return;
    pending.add(id);
    const previous = results.get(id);
    try {
      let confirmed = await getSpicyLyricsAvailability(id);
      if (!confirmed) {
        const lyrics = await readCachedLyrics(id);
        confirmed = isSyncedSpicyLyrics(lyrics);
        if (confirmed) void rememberSpicyLyricsAvailability(id, lyrics).catch(() => {});
      }
      if (!stopped && previous === results.get(id)) results.set(id, { confirmed, checked: Date.now() });
    } catch {
      if (!stopped && previous === results.get(id)) results.set(id, { confirmed: false, checked: Date.now() });
    } finally {
      pending.delete(id);
      schedule();
    }
  }

  function refresh() {
    frame = 0;
    const rows = [...root.querySelectorAll<HTMLElement>(ROW)].filter(row => row.closest(LIST));
    const present = new Set(rows);
    for (const row of displayed.keys()) if (!present.has(row)) clear(row);
    const activeIds = new Set<string>();
    for (const row of rows) {
      const id = getTracklistRowId(row);
      const title = row.querySelector<HTMLElement>(TITLE);
      if (id) activeIds.add(id);
      const result = id ? results.get(id) : undefined;
      if (id && (!result || Date.now() - result.checked >= 60_000)) void check(id);
      if (!id || !title || !result?.confirmed) { clear(row); continue; }
      let badge = displayed.get(row);
      if (badge?.dataset.trackId !== id || badge.parentElement !== title) {
        clear(row);
        badge = doc.createElement("span");
        badge.className = BADGE;
        badge.dataset.trackId = id;
        badge.setAttribute("role", "img");
        badge.innerHTML = Icons.LyricsPage.replace(/ (?:id|class)="[^"]*"/g, "");
        title.append(badge);
        displayed.set(row, badge);
      }
      const titleText = label();
      if (badge.title !== titleText) {
        badge.title = titleText;
        badge.setAttribute("aria-label", titleText);
      }
    }
    // Keep the scroll cache bounded, including when a long virtual list is traversed.
    if (results.size > 512) for (const id of results.keys()) if (!activeIds.has(id)) results.delete(id);
  }

  const observer = new MutationObserver(records => {
    if (records.some(record => {
      const element = record.target instanceof Element ? record.target : record.target.parentElement;
      return !element?.closest("." + BADGE);
    })) schedule();
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ["data-uri", "data-track-uri", "href", "aria-rowindex"] });
  const unsubscribe = onSpicyLyricsAvailability((id, confirmed) => {
    if (results.has(id) || pending.has(id)) { results.set(id, { confirmed, checked: Date.now() }); schedule(); }
  });
  const unlanguage = $uiLanguage.listen(schedule);
  const interval = view.setInterval(schedule, 60_000);
  schedule();
  return () => {
    stopped = true;
    view.cancelAnimationFrame(frame);
    view.clearInterval(interval);
    observer.disconnect();
    unsubscribe();
    unlanguage();
    for (const row of displayed.keys()) clear(row);
  };
}

export function initSyncedTrackBadges(readCachedLyrics: (id: string) => Promise<unknown>) {
  const history = Spicetify.Platform.History;
  let stop = () => {};
  function connect() {
    stop();
    stop = () => {};
    if (!/^\/(album|playlist)\//.test(history.location.pathname)) return;
    const start = () => {
      const root = document.querySelector<HTMLElement>("main, .Root__main-view");
      return root ? observeSyncedTrackBadges(document, root, readCachedLyrics) : null;
    };
    const cleanup = start();
    if (cleanup) { stop = cleanup; return; }
    const ready = new MutationObserver(() => {
      const cleanup = start();
      if (cleanup) { ready.disconnect(); stop = cleanup; }
    });
    ready.observe(document.body, { childList: true, subtree: true });
    stop = () => ready.disconnect();
  }
  let unlisten: (() => void) | undefined;
  $experiment("syncedLyricsTrackBadges").subscribe(enabled => {
    unlisten?.();
    unlisten = undefined;
    stop();
    stop = () => {};
    if (enabled) { unlisten = history.listen(connect); connect(); }
  });
}
