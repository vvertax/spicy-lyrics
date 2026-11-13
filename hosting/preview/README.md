# Browser preview

The preview bundles the production page, settings, lyric animator and creative tools. Only Spotify/environment boundaries are replaced by modules under `src/preview/adapters`.

Build with `node project/build-preview.mjs`. The normal extension build also runs this step. `project/prepare-hosting.mjs` copies the resulting `dist/preview` directory and the Material You host page into the deployment package; `--host=devlrc.vvrtx.lol` selects the separate development staging directory.

The first preview build retrieves the four original Spicy Lyrics font weights from the font service already used by the extension. Later builds reuse `.cache/preview-fonts`; generated fonts and bundles remain outside Git. Both the main and development site use relative preview paths.

Demo text and cover illustrations are original fixtures. Playback is a silent local clock. Source requests and Spotify authentication are replaced by demo transports. External links still require an explicit action. The online-counter overlay is never imported into the preview.

Storage is namespaced independently from site preferences, including IndexedDB lyric/font stores. Closing the host removes the iframe and its resources; offscreen or hidden previews suspend their visual loops and local playback clock.

Tests exercise storage isolation, player suspension, lazy hosting and the actual bundled production component graph. Browser verification covers the native settings, subtitles, PNG export and TTML comparison. This is separate from testing inside Spotify.
