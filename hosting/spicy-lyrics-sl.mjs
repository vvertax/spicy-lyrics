// Spicy Lyrics loader. Install this file, not another Spicy Lyrics loader.
(async () => {
  while (!globalThis.Spicetify?.LocalStorage) await new Promise(resolve => setTimeout(resolve, 100));
  const storage = Spicetify.LocalStorage;
  // First install joins SL; subsequent starts preserve explicit channel choices.
  if (storage.get("SpicyLyrics-sl-loader-initialized") !== "1") {
    storage.set("SpicyLyrics-buildChannel", "vvertax Edition");
    storage.set("SpicyLyrics-sl-loader-initialized", "1");
  }
  await import(`https://lrc.vvrtx.lol/entrypoint.mjs?v=${Date.now()}`);
})().catch(error => {
  console.error("[Spicy Lyrics] Loader failed", error);
  globalThis.Spicetify?.showNotification?.("Spicy Lyrics: could not load lrc.vvrtx.lol. Check your connection and restart Spotify.", true);
});
