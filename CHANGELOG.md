# Changelog

## 1.12.0

- Add vvertax You, a Material Design 3 theme with Gray, Lavender, Green, and White palettes and a custom palette generated from one HEX color.
- Export animated lyrics quotes in MP4 or WebM with up to 24 timed lines over 60 seconds, animated dots during pauses, and optional Spotify audio capture or a local audio file.
- Trim video quotes with start and end markers and loop the preview with audio. The editor starts on the current lyric and keeps the draft when the song changes.
- Export video quotes in 9:16, 1:1, or 16:9. Choose a composition, move the cover, song details, and lyrics, and show safe zones in the vertical preview.
- Improve video export smoothness and support gradient backgrounds and the Spicy Lyrics watermark in video quotes.
- Import TTML or LRC by drag and drop, save lyrics per track, and back up or restore the local lyrics library.
- Add optional badges for playlist and album tracks with known synced Spicy Lyrics community lyrics. Badges survive lyrics cache eviction.
- Move subtitles out of Experiments and redesign their settings, close, and drag controls. Give subtitles and quote cards distinct icons.
- Reorder pinned quick controls by dragging them. Close the actions menu when opening Settings.
- Show Background and Effects as regular settings categories and fix the hidden settings list and its visibility icons.
- Keep syllable group growth centered and reduce layout work in Spring and Bloom while split-word spacing is enabled.
- Show the active update channel and installed hotfix in About. Deliver hotfixes without changing the version number, theme update dialogs, and confirm installation after restart.
- Add the missing colon after the songwriter credit label.

## 1.11.3

- Make the About Update button show the update notification instead of opening the build-channel selector.
- Fix clipped fullscreen Canvas buttons when the volume slider is below; center side volume sliders with matching insets.
- Match the TTML Reviewer, diagnostics, and settings history expand/collapse controls to Quick Controls.
- Remove unnecessary fades from popup track and artist names and improve dock spacing and alignment.
- Fix missing popup playback controls when fullscreen controls are set to stay visible.
- Fix popup background flickering when hovering over the playback panel.
- Add Russian translations for songwriter, community, contributor, source, and Up Next labels.

## 1.11.2

- Match the Background and Effects expand/collapse controls to Quick Controls, with circular arrow buttons and matching hints.

## 1.11.1

- Port Spicy Lyrics 6.5.0 features and 6.5.10 updates while preserving vvertax Edition functionality.
- Move Ctrl + wheel zoom into Lyrics settings, synchronize it with Lyrics Size, and refresh the scale reset badge.
- Expand diagnostics with a readable, editable report, copy actions, and the fork’s issue-tracker link.
- Add localized New badges for features introduced from 1.10.0 onward.
- Default increased Spring line spacing to Off without resetting saved choices.
- Fix fullscreen volume placement with Canvas and either cover position.
- Restore the 1.11.0 controls-menu appearance and fix clipped buttons, shared backdrops, and duplicate icons.
- Make related-setting links open the correct section, expand its group, and focus the target control.
- Fix settings navigation wrapping into clipped columns.
- Fix official Stable / Beta loading through the upstream loader.
- Keep the production channel pinned to its production host, separate from alternate release channels.
- Update Russian translations.

## 1.11.0

- Restore Popup typography by excluding PiP from full-page automatic compact sizing; restore the single original SimpleBar fade and unpinned credits. Isolate Ruytha settings styles from original mode and add a real-renderer popup preview.

- Isolate Popup quick-control geometry from the full-page menu; reset the legacy caption top anchor in Popup Dock and keep artist/year text in a non-collapsing row.

- Rebind visual timers and autoscroll when lyrics move into or out of Popup/Cinema windows, including a hidden host. Give Advanced, Settings History and About distinct category icons.

- Port Ruytha pronunciation rows with synchronized lead/backing romanization and Japanese word spacing; retain replacement mode. Make Escape leave recording mode before closing lyrics.

- Localize standalone loader recovery messages using the saved language, clarify the fork issue-tracker link and prevent operational help links to other forks.

- Add a saved interface design selector across extension windows: Ruytha styling or the original Spikerko presentation, keeping all fork controls. Improve animation preview insets and readable before/after settings history.

- Add a lazy-loaded browser preview on the website using the production lyric renderer, settings and creative tools, with isolated local demo data and original font assets.

- Add session settings history with grouped undo/redo and a temporary before/after preview that does not persist preview values.
- Explain unavailable settings inline and link to their controlling settings, including hidden controls found through search.
- Add a locally generated, editable diagnostic report with source status, animation settings and redacted recent extension errors.
- Preload one upcoming queue track while a lyrics window is visible; reuse its request on playback and cancel obsolete work.
- Move Experiments from Advanced into its own settings category, preserving individual experiment choices and search.

## 1.10.2

- Rebuild lyric review with searchable vocal rows, independent backing-vocal timing and identities, a dedicated note editor and explicit preview seeking. Existing notes and exports remain supported.

- Refresh native author profile cards with the Spicy Lyrics palette, clearer hierarchy and a decorative corner logo.

- Align TTML comparison rows by text and timing instead of index, preserving matches through insertions, deletions and global retiming.
- Show concurrent text, timing, syllable-boundary, voice and backing-vocal differences, with a 10 ms timing threshold.
- Highlight changed lyric segments without replacing their animator; add expandable A/B details, category counts and filters, and previous/next navigation without seeking Spotify.
- Preserve line translations and romanization in parsed word-synced TTML for comparison.

## 1.10.1

- Match subtitle letter line-box metrics to the main lyrics renderer, removing extra baseline displacement during nested scaling; keep the original shared animation curves.
- Avoid repeated tape geometry reads during held subtitle words while retaining the production word and letter animator.
- Show the resume countdown only when the current target differs from the last automatic scroll target; group its setting under Scrolling.
- Replace retired author embeds with native metadata cards and explicit links to the full public profile; stop relying on internal profile lookup requests.
- Remove the Ruytha star texture from modal surfaces while preserving the original Spicy Lyrics watermark.

## 1.10.0

- Hide the resume countdown when automatic following cannot resume for a distant line; soften its opacity, remove the duplicate Sources heading and avoid repeated unchanged DOM writes in source details and subtitle controls.

- Place source diagnostics with the lyric credits, show only remaining seconds above the return arrow, and style subtitle layout controls with translucent preset buttons and a labelled width slider.

- Hide the Favorites tab until it has entries; reveal star controls only in an explicit favorites-editing mode beside Hide Settings.
- Keep subtitle visibility separate from the experiment, with a menu/quick action, saved drag/resize layout, presets and reset.
- Smoothly shrink the subtitle panel after wrapped lines without replacing its continuous tape.
- Add optional displayed-source details and autoscroll-resume feedback, and an opt-in Ctrl+wheel lyric zoom experiment with reset.

- Suspend visual frame loops, UI polling, extension-owned animations and decorative video in hidden windows; keep visible PiP/Cinema independent of host visibility.
- Defer lyrics, background and artist-image work while hidden, cancel automatic provider requests without error notices and fetch only the current track on return.
- Load romanization dictionaries/packages on demand and retain functional playback controls, line repeat and local presence heartbeats.

- Add an opt-in glass bottom subtitles bar with cover artwork, current/next lyrics, upward reel transitions, a subtle Spicy Lyrics watermark, the production word/letter animator and click-to-seek while browsing Spotify.
- Animate subtitle panel entry/exit and text fades, including track changes, playback endings, close; cancel stale transitions safely and respect reduced motion.
- Scroll subtitles on one continuous tape with persistent rows, stable type size and a single outer viewport; measure the full height of wrapped lyrics so words are not clipped inside a line.
- Temporarily disable backing vocals in floating subtitles to prevent reel-height jumps; keep the implementation with restoration comments. Normal-page backing vocals remain available.
- Fix subtitle split-word geometry, promote the upcoming line immediately during gaps and keep reel transitions on transform/opacity, then smoothly settle the viewport height after the tape stops.
- Add local TTML inspection for empty lines, invalid/reversed timings, words outside lead timing and long instrumental gaps, with an interactive preview.
- Add persistent favorite settings, star controls and a dedicated Favorites tab.
- Translate the new controls into Russian.

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
