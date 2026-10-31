# Spicy Lyrics — vvertax Edition

**English** · [Russian](./README-Rus.md)

An unofficial Spicy Lyrics fork for desktop Spotify through Spicetify.
Built on iPixelGalaxy, with settings styling adapted from Ruytha and additional tools.
The extension is named **Spicy Lyrics** in the interface; its update channel is **vvertax Edition**.

## Features

- Multiple lyrics sources, source priorities, animator presets and hideable settings.
- Ruytha-style settings, a glass page menu, font files and installed system fonts.
- Karaoke with smooth line reveals and a recording mode that hides interface elements.
- PNG quote cards with selected lines, cover art, adaptive colors and creator credits.
- Keyboard shortcuts and a word-animation preview.
- Find author works by username through the official embedded profile page.
- Local line-review notes with report export.
- Compare two TTML files at the same playback position.

Author search depends on the availability of spicylyrics.org embeds. Recording mode hides the interface; it does not record video. The vvertax. and july creator marks are configured in source. New tools still need further verification inside Spotify.

## Installation

Requires desktop Spotify and [Spicetify](https://spicetify.app).
Disable other Spicy Lyrics extensions/loaders, including the Marketplace version.

1. Download [spicy-lyrics-sl.mjs](https://lrc.vvrtx.lol/spicy-lyrics-sl.mjs), or use the [loader included in this repository](hosting/spicy-lyrics-sl.mjs).
2. Place it in your Spicetify Extensions folder. Run `spicetify -c` to locate the configuration file; Extensions is beside it.
3. Run:

```powershell
spicetify config extensions spicy-lyrics-sl.mjs
spicetify apply
```

The loader fetches the current release from `lrc.vvrtx.lol`. It selects the built-in channel on first launch and preserves later choices. Switching to Stable/Beta or another channel loads that channel author's build.

## Development

Use Node.js 24 and npm. The extension depends on Spicetify globals inside Spotify.

```sh
npm ci
npm test
npm run lint
npm run build
```

`npm run dev` starts development mode with Spicetify installed.
To build without accessing a local Spotify installation, set `SPICETIFY_SKIP=true` (PowerShell: `$env:SPICETIFY_SKIP = "true"`).

Set the fork version in `project/config.ts` and update the matching versions in package.json and package-lock.json. `ApiCompatibilityVersion` tracks the upstream engine protocol separately; do not change it for every fork release.

## Keyboard shortcuts

In the lyrics view, use **Alt+Shift+K** for karaoke, **Alt+Shift+R** for recording mode, **Alt+Shift+T** for romanization and **Alt+Shift+L** to return to the current line. **Escape** exits recording mode. Shortcuts are ignored while typing or using dialogs.

## Credits and license

[Spikerko](https://github.com/Spikerko/spicy-lyrics), [iPixelGalaxy](https://github.com/iPixelGalaxy/spicy-lyrics), [Ruytha](https://github.com/Ruytha/spicy-lyrics-ruytha-edition). See [NOTICE.md](NOTICE.md).
Licensed under [GNU AGPL v3](LICENSE). Report fork-specific issues in this repository rather than upstream support channels.
