const legacyCache = "SpicyLyrics_SyncedTrackAvailability";
const availabilityCache = "SpicyLyrics_ConfirmedSyncedTracks_v2";
const listeners = new Set<(id: string, confirmed: boolean) => void>();

export function isSyncedSpicyLyrics(lyrics: unknown): boolean {
  if (!lyrics || typeof lyrics !== "object") return false;
  const { source, Type, Content } = lyrics as { source?: string; Type?: string; Content?: unknown[] };
  return source === "spl" && (Type === "Line" || Type === "Syllable") && Array.isArray(Content) && Content.length > 0;
}

export async function rememberSpicyLyricsAvailability(id: string, lyrics: unknown) {
  if (!isSyncedSpicyLyrics(lyrics)) return;
  await rememberConfirmedTrack(id);
}

async function rememberConfirmedTrack(id: string) {
  const cache = await caches.open(availabilityCache);
  const key = "/synced/" + encodeURIComponent(id);
  if (await cache.match(key)) return;
  await cache.put(key, new Response("1"));
  for (const listener of listeners) listener(id, true);
}

export async function getSpicyLyricsAvailability(id: string) {
  const cache = await caches.open(availabilityCache);
  if (await cache.match("/synced/" + encodeURIComponent(id))) return true;
  // Expiry applied to cache freshness, not whether the community lyrics existed.
  const legacy = await (await caches.open(legacyCache)).match("/" + encodeURIComponent(id));
  const entry = await legacy?.json().catch(() => null);
  if (entry?.CacheVersion !== 1 || entry.Content !== true) return undefined;
  await rememberConfirmedTrack(id);
  return true;
}

export function onSpicyLyricsAvailability(listener: (id: string, confirmed: boolean) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
