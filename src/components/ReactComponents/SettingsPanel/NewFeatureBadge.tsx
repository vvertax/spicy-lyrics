/** Features introduced from 1.10.0 onward, verified against release history.
 * New catalog IDs or renamed controls do not make an existing feature new. */
const NEW_FEATURES = new Set<string>(
[
  // 1.10.0: subtitles, source details, scroll feedback and Ctrl + wheel.
  "subtitleBar",
  "sources-info",
  "lyrics-resume-indicator",
  "ctrlWheelLyricsZoom",
  "rendererVisualStyle",
  "lyricsSize",
  "syllableMerge",
  "syllablePace",
  "staticAutoScroll",
  "motionArtwork",
  "motionArtworkOnStage",
  "motionArtworkPriority",
  "ttmlReviewer",
  "interface-auto-queue",
  "musicReactiveBackground",
  "largerCinemaLyrics",
  "springLineSpacing",
  "portraitFullscreen",
  "romajiAsWritten",
  "nextUpCard",
  "playerBelowCover",
  "groupedViewControls",
  // 1.11.0: design selection, pronunciation rows, diagnostics and history.
  "Preload next song lyrics",
  "Interface Design",
  "Romanization Under the Lyrics",
  "Diagnostic report",
  "Settings history"
]);
export function isNewFeature(id: string | undefined): boolean { return Boolean(id && NEW_FEATURES.has(id)); }
export default function NewFeatureBadge() { return <span className="sl-sp-new-badge">New</span>; }
