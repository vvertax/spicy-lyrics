// [Spicy Lyrics vE] loader. Install this file, not another Spicy Lyrics loader.
const FORK_RELEASE_HOST = "lrc.vvrtx.lol";
(async () => {
  while (!globalThis.Spicetify?.LocalStorage) await new Promise(resolve => setTimeout(resolve, 100));
  const storage = Spicetify.LocalStorage;
  const alternate = FORK_RELEASE_HOST !== "lrc.vvrtx.lol";
  const initialChannel = alternate ? "vvertax Edition Dev" : "vvertax Edition";
  if (alternate) {
    let custom = {};
    try { const saved = JSON.parse(storage.get("SpicyLyrics-customChannels") ?? "{}"); if (saved && typeof saved === "object" && !Array.isArray(saved)) custom = saved; } catch {}
    custom[initialChannel] = [FORK_RELEASE_HOST, FORK_RELEASE_HOST];
    storage.set("SpicyLyrics-customChannels", JSON.stringify(custom));
  }
  // First install joins its explicit channel; subsequent starts preserve explicit channel choices.
  if (storage.get("SpicyLyrics-sl-loader-initialized") !== "1") {
    storage.set("SpicyLyrics-buildChannel", initialChannel);
    storage.set("SpicyLyrics-sl-loader-initialized", "1");
  }
  if (storage.get("SpicyLyrics-buildChannel") === "SL") storage.set("SpicyLyrics-buildChannel", "vvertax Edition");
  await import(`https://${FORK_RELEASE_HOST}/entrypoint.mjs?v=${Date.now()}`);
})().catch(error => {
  console.error("[Spicy Lyrics vE] Loader failed", error);
  let language;
  try { language = JSON.parse(globalThis.Spicetify?.LocalStorage?.get?.("SL:settings") ?? "{}")?.uiLanguage; } catch { /* Use the system language when settings cannot be read. */ }
  const russian = language === "ru" || (language !== "en" && globalThis.navigator?.language?.toLowerCase().startsWith("ru"));
  globalThis.Spicetify?.showNotification?.(russian
    ? `[Spicy Lyrics vE]: не удалось загрузить ${FORK_RELEASE_HOST}. Проверьте подключение и перезапустите Spotify.`
    : `[Spicy Lyrics vE]: could not load ${FORK_RELEASE_HOST}. Check your connection and restart Spotify.`, true);
});
