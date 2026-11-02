# Changelog

## 1.9.0

- Delay loading placeholders for fast responses from both cache and network, preserving the reveal deadline across repeated render calls and showing queue notices immediately.

- Align quick controls with the menu button, including when the quick strip has a scrollbar.
- Keep a dedicated Exit Fullscreen button immediately before the menu, independently of pinned action settings.
- Restore functional hidden-settings and animator navigation after returning from Experiments, Sources or the TTML Database.

- Fade outgoing lyrics and reveal the next song after loading, alongside existing cover, metadata and background transitions; add a persistent switch.
- Add Classic, Cover on Top, Poster and Typography quote-card compositions with automatic text fitting.
- Add cover artwork as a quote-card background with independent blur and darkening controls for preview, PNG and clipboard export.
- Save a per-song playback offset that replaces the global value, with an option to return to global timing.
- Add an opt-in instrumental artwork experiment with gentle floating, swaying and breathing during long gaps in synced vocals. Song information follows the cover with safe spacing; both return before singing resumes.

## 1.8.1

- Add centred split-word growth based on the actual width and animated scale of each syllable, including independently wrapped fragments.
- Add a persistent Split Word Motion toggle for normal lyrics and both TTML comparison columns.
- Fix automatic following in both comparison columns, including resuming after manual scrolling.
- Fix quote cards, review notes and line actions reporting missing lyrics when the displayed text is available but the fetch cache is empty.
- Style quote-card selection checkboxes and appearance switches with lavender controls.
- Make Quick Controls visibly expandable with a bordered header, arrow and configuration hint.
- Remove the star pattern from Experiments, Hidden Settings, Build Channel, Sources, TTML Database and Animator Behavior panels.
- Complete missing Russian labels, descriptions, errors, notifications and dynamic tooltips; fix localization in channel and TTML dialogs while preserving user content.

## 1.8.0

- Keep dominant muted cover colors from being displaced by small, highly saturated details in quote palettes.

- Make Quick Controls collapsible, expanding automatically when matching settings search.

- Make Escape with Exit Fully close the lyrics page in one action without waiting for an interruptible fullscreen exit animation.

- Make quote-card gradients optional (solid by default) and preserve the cover hue in gradients for brighter artwork.

- Build quote-card gradients from the cover accent and a separate dark base, preserving colors such as red on black artwork.

- Preserve vivid cover-art hues in quote cards instead of letting neutral background colors dominate the palette.

- Restyle author search and recreate its embedded profile on each search; prevent embedded pages from opening browser popups.

- Drop TTML onto the lyrics page or either comparison column.
- Add a lyric-line context menu for copying, external translation, quote cards, review notes and line repeat.
- Add persistent, optional duet voice colors in Lyrics settings.

- Show a minimal no-lyrics message instead of hiding it when detailed notices are disabled; keep loading errors detailed.

## 1.7.1


- Translate update dialogs and notifications into Russian, including dynamic version text and patch-notes links.

## 1.7.0

- Move TTML A/B comparison onto the lyrics page with a shared track background, Spicy Lyrics controls, and the production lyric animator running independently for A and B.
- Restore the normal page when leaving comparison or changing tracks.
- Remove excessive hover bloom from active lyrics and style the quick-controls scrollbar.
- Remove the settings/update design toggle and translate the frame-rate description.
- Make quote-card watermarks lighter on near-black cover-derived backgrounds.
- Use a lavender Copy details button and localize lyrics notices, errors and copy feedback for Russian.

## 1.6.4

- Give karaoke, recording, quote cards, author search, lyrics review and TTML comparison distinct icons.
- Use separate cover-only and lyrics-manager icons in the menu and quick controls.

## 1.6.3

- Use the original Pixel ViewControl appearance for pinned actions: matching sizes, glass surfaces and icon styles.
- Remove the shared capsule background and keep menu-only styling off quick buttons.

## 1.6.2

- Fix quick controls collapsing into a narrow strip above the menu button.
- Keep pinned controls in one scrollable row and remaining actions inside the menu.

## 1.6.1

- Use this fork's changelog for update notes and show notes for its own version series.
- Replace Pixel fork issue/help links with this repository.
- Preserve official Spicy Lyrics services, support links and upstream attribution.

## 1.6.0

- Add persistent English/Russian interface language selection and localized settings search.
- Translate interface controls without translating song lyrics or creator names.
- Add a bilingual Material You download page with light/dark themes at hosting/index.html.

## 1.5.0

- Show TTML A/B simultaneously in a split-screen comparison view.
- Independent word highlighting and auto-scroll with common playback controls.
- Highlight text/timing differences and add review notes for each side.
- Keep comparison isolated from the main lyrics and reject edits after track changes.

## 1.4.0

- Choose which lyrics-menu actions appear as quick buttons in Settings > Interface > Quick Controls.
- Keep remaining actions in the menu and preserve selection between sessions.

## 1.3.3

- Copy quote cards as PNG images to the clipboard without downloading.

## 1.3.2

- Redesign the quote card editor with separate selection and preview panes.
- Select up to 12 lines / 1800 characters, with square, portrait, story and automatic formats.
- Prevent export when text cannot fit at a readable size.

## 1.3.1

- Restore iPixel styling for the Load TTML window while retaining the settings theme.

## 1.3.0

- Find author works through the official profile embed.
- Local lyric review notes with timestamps and report export.
- Compare TTML A/B without seeking; restore original lyrics on close.
- Prepare repository documentation, licensing, dependency lock and CI.

## 1.2.x

- Quote text word boundaries, word wrapping, cover palette and text colors.
- Renderer-based word-animation preview, keyboard shortcuts and karaoke reveal improvements.

## 1.1.x

- Karaoke, recording mode and PNG quote cards.

## 1.0.x

- Own release numbering, vvertax Edition channel and API compatibility version.
- Settings/menu integration, fonts and creator marks.
