// [Spicy Lyrics vE] loader. Install this file, not another Spicy Lyrics loader.
(async () => {
  while (!globalThis.Spicetify?.LocalStorage) await new Promise(resolve => setTimeout(resolve, 100));
  const storage = Spicetify.LocalStorage;
  // First install joins vvertax Edition; subsequent starts preserve explicit channel choices.
  if (storage.get("SpicyLyrics-sl-loader-initialized") !== "1") {
    storage.set("SpicyLyrics-buildChannel", "vvertax Edition");
    storage.set("SpicyLyrics-sl-loader-initialized", "1");
  }
  await import(`https://lrc.vvrtx.lol/entrypoint.mjs?v=${Date.now()}`);
})().catch(error => {
  console.error("[Spicy Lyrics vE] Loader failed", error);
  let language;
  try { language = JSON.parse(globalThis.Spicetify?.LocalStorage?.get?.("SL:settings") ?? "{}")?.uiLanguage; } catch { /* Use the system language when settings cannot be read. */ }
  const russian = language === "ru" || (language !== "en" && globalThis.navigator?.language?.toLowerCase().startsWith("ru"));
  globalThis.Spicetify?.showNotification?.(russian
    ? "[Spicy Lyrics vE]: не удалось загрузить lrc.vvrtx.lol. Проверьте подключение и перезапустите Spotify."
    : "[Spicy Lyrics vE]: could not load lrc.vvrtx.lol. Check your connection and restart Spotify.", true);
});
