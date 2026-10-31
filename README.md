# Spicy Lyrics — vvertax Edition

**English** · [Russian](./README-Rus.md)

An unofficial Spicetify extension for desktop Spotify, based on Spicy Lyrics and its forks.

## Features

- English and Russian interface with a saved language preference.

- Word-synced lyrics, multiple sources and customizable animations.
- Ruytha-style settings, custom fonts and hideable settings.
- Karaoke, recording mode and keyboard shortcuts.
- Configurable quick buttons: keep actions on the page or inside its menu.
- Quote cards with cover-based colors, PNG export and image copying.
- Author works lookup, lyric review notes and TTML A/B comparison.
- Automatic updates through the **vvertax Edition** build channel.

## Installation

Requires desktop Spotify and [Spicetify](https://spicetify.app).
Disable any other Spicy Lyrics extension before installing.

1. Download [spicy-lyrics-sl.mjs](https://lrc.vvrtx.lol/spicy-lyrics-sl.mjs).
2. Place it in your Spicetify **Extensions** folder. Run `spicetify -c` to locate the configuration file; the folder is beside it.
3. Run:

```powershell
spicetify config extensions spicy-lyrics-sl.mjs
spicetify apply
```

The loader selects **vvertax Edition** on first launch and loads updates when Spotify starts.

## Build from source

Requires Node.js 24 and npm.

```sh
npm ci
npm test
npm run build
```

Output: `dist/spicy-lyrics@<version>.mjs`. Install this file instead of the loader if you prefer a fixed local build.

## Credits

Based on [Spikerko](https://github.com/Spikerko/spicy-lyrics), [iPixelGalaxy](https://github.com/iPixelGalaxy/spicy-lyrics) and [Ruytha](https://github.com/Ruytha/spicy-lyrics-ruytha-edition).

[AGPL v3](LICENSE) · [Attribution](NOTICE.md) · [Changelog](CHANGELOG.md)
