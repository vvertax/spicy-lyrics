import { registerDesignDocument, setInterfaceDesign } from "./InterfaceDesign.ts";
import { settingsHistory } from "./SettingsHistory.ts";
import { atom, computed, type WritableAtom } from "nanostores";
import { ProjectVersion } from "../../project/config.ts";
import { SETTING_IDS } from "../components/ReactComponents/SettingsPanel/hiddenSettings.ts";

export const SETTINGS_KEY = "SL:settings";

function readSettingsBlob(): Record<string, any> {
  try {
    const raw = Spicetify.LocalStorage.get(SETTINGS_KEY);
    if (raw === null || raw === undefined) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, any>
      : {};
  } catch {
    return {};
  }
}

function saveSettingsBlob(obj: Record<string, any>) {
  try {
    Spicetify.LocalStorage.set(SETTINGS_KEY, JSON.stringify(obj));
  } catch (error) {
    console.warn("Spicy Lyrics: could not save settings", error);
  }
}

function migrateSettingsKeys(blob: Record<string, any>): Record<string, any> {
  const renames: Record<string, string> = {
    "skip-spicy-font": "skipSpicyFont",
    show_npv_dynamic_bg: "showNpvDynamicBg",
    displayLyricsHoverPill: "lineHoverBackground",
    "experiment:duetLinePadding": "duetLinePadding",
  };
  let changed = false;
  if ("experiment:ctrlWheelLyricsZoom" in blob) {
    blob.ctrlWheelLyricsZoom ??= blob["experiment:ctrlWheelLyricsZoom"];
    delete blob["experiment:ctrlWheelLyricsZoom"];
    changed = true;
  }

  for (const [oldKey, newKey] of Object.entries(renames)) {
    if (oldKey in blob) {
      if (!(newKey in blob)) blob[newKey] = blob[oldKey];
      delete blob[oldKey];
      changed = true;
    }
  }
  // Combining the design switches must preserve either existing opt-out.
  const updateDesignKey = "experiment:newUpdatePromptDesign";
  if (updateDesignKey in blob) {
    if (blob[updateDesignKey] === false) blob["experiment:newSettingsDesign"] = false;
    delete blob[updateDesignKey];
    changed = true;
  }
  // The old "Join Split Words" toggle joined only evenly sung words, which is "steady".
  if ("joinSplitWords" in blob) {
    blob.syllableMerge ??= blob.joinSplitWords ? "steady" : "off";
    // Keep the fork's existing toggle as a compatibility alias.
    changed = true;
  }
  if (migrateRendererStyle(blob)) changed = true;
  if (changed) saveSettingsBlob(blob);
  return blob;
}

// The old Simple Lyrics Mode toggle became the Bloom style. Its refreshed look
// was an experiment; Bloom is that look, so whoever had Simple Lyrics Mode on
// gets Bloom whatever the experiment was set to. Exported for the migration test.
export function migrateRendererStyle(blob: Record<string, any>): boolean {
  let changed = false;
  if ("simpleLyricsMode" in blob) {
    blob.rendererVisualStyle ??= blob.simpleLyricsMode === true ? "bloom" : "spring";
    // Keep the fork's simple-mode setting and saved animation choices.
    changed = true;
  }
  if ("experiment:refreshedSimpleLyrics" in blob) {
    // Keep the fork's opt-out for its legacy renderer.
    changed = true;
  }
  if ("rendererVisualStyle" in blob && !RENDERER_VISUAL_STYLES.includes(blob.rendererVisualStyle)) {
    delete blob.rendererVisualStyle;
    changed = true;
  }
  return changed;
}

// How the synced lyrics move. "spring" is the original renderer; "bloom" fills
// each line behind one soft edge, swells held words letter by letter, and
// follows the song with a staggered scroll.
export type RendererVisualStyle = "spring" | "bloom";
export const RENDERER_VISUAL_STYLES: readonly RendererVisualStyle[] = ["spring", "bloom"];
export const RENDERER_VISUAL_STYLE_LABELS: Record<RendererVisualStyle, string> = {
  spring: "Spring (Default)",
  bloom: "Bloom",
};

const _settings: Record<string, any> = migrateSettingsKeys(readSettingsBlob());

/**
 * Every persisted atom and its default, so the bug report can list what someone
 * changed and TTML Reviewer mode can put values back through the atoms. Writing the
 * blob instead wouldn't do: the atoms keep their values in memory and would save
 * theirs over it on their next change.
 */
export const PersistedSettings = new Map<
  string,
  {
    get: () => unknown;
    set: (value: any) => void;
    /** Whether the blob holds a value, as opposed to it never having been set. */
    isStored: () => boolean;
    /** Back to never having been set, so a later change of default still reaches it. */
    unset: () => void;
    defaultValue: unknown;
  }
>();

function registerPersisted<T>(key: string, store: WritableAtom<T>, defaultValue: T) {
  PersistedSettings.set(key, {
    get: () => store.get(),
    set: (value) => store.set(value),
    isStored: () => _settings[key] !== undefined,
    unset: () => {
      store.set(defaultValue);
      delete _settings[key];
      saveSettingsBlob(_settings);
    },
    defaultValue,
  });
}

/**
 * An atom backed by the settings blob. Exported so feature modules (e.g.
 * `experiments.ts`) can register their own persisted settings without having to
 * add a line here for every one.
 */
export function persistAtom<T>(key: string, defaultValue: T) {
  const store = atom<T>(_settings[key] !== undefined ? _settings[key] : defaultValue);
  settingsHistory.register(key,store);
  store.listen((v, previous) => {
    settingsHistory.capture(key,previous,v);
    if(settingsHistory.previewing)return;
    _settings[key] = v;
    saveSettingsBlob(_settings);
  });
  registerPersisted(key, store, defaultValue);
  return store;
}

// Setting atoms (persisted)
// Upstream shares this setting but cannot read Pixel Edition's "legacy" or
// "default" values. Keep its value compatible and retain Legacy separately.
const STATIC_BACKGROUND_MODE_KEY = "staticBackgroundMode";
const PIXEL_LEGACY_BACKGROUND_KEY = "pixelLegacyBackground";
const SHARED_STATIC_BACKGROUND_MODES = new Set([
  "off",
  "auto",
  "artistHeader",
  "coverArt",
  "color",
  "none",
]);

function readStaticBackgroundMode(): string {
  const styleModes: Record<string, string> = {
    dynamic: "off", artist: "artistHeader", cover: "coverArt", color: "color", none: "none",
  };
  const sharedMode = styleModes[_settings.backgroundStyle] ?? _settings[STATIC_BACKGROUND_MODE_KEY];
  const remembersLegacy = _settings[PIXEL_LEGACY_BACKGROUND_KEY] === true;
  let effectiveMode = "default";
  let compatibleMode = sharedMode;
  let compatibleLegacyMarker = remembersLegacy;

  if (sharedMode === "legacy") {
    effectiveMode = "legacy";
    compatibleMode = "off";
    compatibleLegacyMarker = true;
  } else if (sharedMode === "default") {
    compatibleMode = "off";
    compatibleLegacyMarker = false;
  } else if (sharedMode === "off") {
    effectiveMode = remembersLegacy ? "legacy" : "default";
  } else if (typeof sharedMode === "string" && SHARED_STATIC_BACKGROUND_MODES.has(sharedMode)) {
    effectiveMode = sharedMode;
    compatibleLegacyMarker = false;
  } else if (sharedMode !== undefined) {
    compatibleMode = "off";
    compatibleLegacyMarker = false;
  } else if (remembersLegacy) {
    compatibleLegacyMarker = false;
  }

  if (
    compatibleMode !== sharedMode ||
    compatibleLegacyMarker !== remembersLegacy
  ) {
    _settings[STATIC_BACKGROUND_MODE_KEY] = compatibleMode;
    _settings[PIXEL_LEGACY_BACKGROUND_KEY] = compatibleLegacyMarker;
    saveSettingsBlob(_settings);
  }

  return effectiveMode;
}

export const $staticBackgroundMode = (() => {
  const store = atom<string>(readStaticBackgroundMode());
  settingsHistory.register("staticBackgroundMode",store);
  store.listen((mode,previous) => {
    settingsHistory.capture("staticBackgroundMode",previous,mode);
    if(settingsHistory.previewing)return;
    const legacy = mode === "legacy";
    const sharedMode = legacy || mode === "default" || mode === "off"
      ? "off"
      : SHARED_STATIC_BACKGROUND_MODES.has(mode)
        ? mode
        : "off";
    _settings[STATIC_BACKGROUND_MODE_KEY] = sharedMode;
    _settings[PIXEL_LEGACY_BACKGROUND_KEY] = legacy;
    _settings.backgroundStyle = backgroundStyleForMode(mode) === "legacy" ? "dynamic" : backgroundStyleForMode(mode);
    saveSettingsBlob(_settings);
  });
  return store;
})();
// Blur radius (px) applied to image-based static backgrounds — not the "color" mode.
export const $staticBackgroundBlur = persistAtom<number>("staticBackgroundBlur", _settings.backgroundBlur ?? 0);
export type BackgroundStyle = "dynamic" | "artist" | "cover" | "color" | "none" | "legacy";
export const BACKGROUND_STYLES: readonly BackgroundStyle[] = ["dynamic", "artist", "cover", "color", "none", "legacy"];
function backgroundStyleForMode(mode: string): BackgroundStyle {
  if (mode === "auto" || mode === "artistHeader") return "artist";
  if (mode === "coverArt") return "cover";
  if (mode === "color" || mode === "none" || mode === "legacy") return mode;
  return "dynamic";
}
export const $backgroundStyle = computed($staticBackgroundMode, backgroundStyleForMode);
export const $backgroundBlur = $staticBackgroundBlur;
$staticBackgroundBlur.listen((value) => {
  if(settingsHistory.previewing)return;
  _settings.backgroundBlur = value;
  saveSettingsBlob(_settings);
});
export const $simpleLyricsMode = persistAtom<boolean>("simpleLyricsMode", false);
export const $simpleLyricsModeRenderingType = persistAtom<string>("simpleLyricsModeRenderingType", "calculate");

// Lyrics text size as a percentage of what each view uses by default.
export const $lyricsSize = persistAtom<number>("lyricsSize", 100);
export const $ctrlWheelLyricsZoom = persistAtom<boolean>("ctrlWheelLyricsZoom", true);
export const $rendererVisualStyle = persistAtom<RendererVisualStyle>("rendererVisualStyle", "spring");
export const isBloomRenderer = (): boolean => $rendererVisualStyle.get() === "bloom";

export const $minimalLyricsMode = persistAtom<boolean>("minimalLyricsMode", false);
// Shows a word sung in syllables as one word when its parts line up evenly.
export const $splitWordMotion = persistAtom<boolean>("splitWordMotion", true);
export const $joinSplitWords = persistAtom<boolean>("joinSplitWords", false);
// Which words sung in syllables are shown as one word: none, all, those whose
// parts line up evenly, or those long enough to be drawn letter by letter.
export type SyllableMerge = "off" | "full" | "steady" | "held";
export const $syllableMerge = persistAtom<SyllableMerge>("syllableMerge", "off");
// A joined word drawn letter by letter times its letters by the syllables it
// was joined from, instead of spreading them evenly over the whole word.
export const $syllablePace = persistAtom<boolean>("syllablePace", false);
// Tinted box drawn behind a lyrics line while the pointer is over it.
export const $lineHoverBackground = persistAtom<boolean>("lineHoverBackground", true);
// Wide inset on the side a duet line leans away from, so the two voices read as
// separate columns. Off gives duet lines the same slight padding as every line.
export const $duetLinePadding = persistAtom<boolean>("duetLinePadding", true);
// When a song ends on a duet line sung from the right, the credits under it
// (writers, provider, community info) move to the right with it.
export const $creditsFollowLastLine = persistAtom<boolean>("creditsFollowLastLine", false);
export const $skipSpicyFont = persistAtom<boolean>("skipSpicyFont", false);
export const $showNpvDynamicBg = persistAtom<boolean>("showNpvDynamicBg", true);
// Never inject the lyrics card into the Now Playing sidebar at all.
export const $disableNpvLyrics = persistAtom<boolean>("disableNpvLyrics", false);
// Pull the whole NPV lyrics card out of the sidebar while the current track has
// no lyrics, instead of leaving it up showing the "no lyrics" notice.
export const $hideNpvLyricsWhenUnavailable = persistAtom<boolean>(
  "hideNpvLyricsWhenUnavailable",
  true
);
// Off: a song that simply has no lyrics (not found, local file, DJ, podcast...) shows
// only the song info instead of the notice. Errors still show theirs. The NPV card
// has its own switch above.
export const $showNoLyricsNotice = persistAtom<boolean>("showNoLyricsNotice", true);
// In Fullscreen and Cinema View, a song with no lyrics opens the queue in the lyrics column,
// and the next song with lyrics closes it again.
export const $showQueueWhenNoLyrics = persistAtom<boolean>("showQueueWhenNoLyrics", false);
// Hide Spotify's own lyrics button in the playback bar (ours is left alone).
export const $removeSpotifyLyricsButton = persistAtom<boolean>("removeSpotifyLyricsButton", false);
export const $lockedMediaBox = persistAtom<boolean>("lockedMediaBox", false);
// $popupLyricsAllowed: stored as actual boolean "popupLyricsAllowed" in the settings blob.
export const $popupLyricsAllowed = (() => {
  const initial: boolean =
    _settings["popupLyricsAllowed"] !== undefined ? _settings["popupLyricsAllowed"] : true;
  const store = atom<boolean>(initial);
  settingsHistory.register("popupLyricsAllowed",store);
  store.listen((v,previous) => {
    settingsHistory.capture("popupLyricsAllowed",previous,v);
    if(settingsHistory.previewing)return;
    _settings["popupLyricsAllowed"] = v;
    saveSettingsBlob(_settings);
  });
  registerPersisted("popupLyricsAllowed", store, true);
  return store;
})();
export const $externalCinemaLyricsAllowed = persistAtom<boolean>("externalCinemaLyricsAllowed", false);
export const $openProfilesInBrowser = persistAtom<boolean>("openProfilesInBrowser", false);
export const $viewControlsPosition = persistAtom<string>("viewControlsPosition", "Top");
export const $ttmlMakerMode = persistAtom<boolean>("ttmlMakerMode", true);
export const $developerMode = persistAtom<boolean>("developerMode", false);
export const $rememberSettingsMenuLocation = persistAtom<boolean>(
  "rememberSettingsMenuLocation",
  false
);
export const $showLyricsCacheActionButton = persistAtom<boolean>(
  "showLyricsCacheActionButton",
  false
);
export const $lyricsCacheAction = persistAtom<string>(
  "lyricsCacheAction",
  "all-current"
);
export const $rightAlignLyrics = persistAtom<boolean>("rightAlignLyrics", false);
export const $escapeKeyFunction = persistAtom<string>("escapeKeyFunction", "Default");
export const $buildChannel = persistAtom<string>("buildChannel", "vvertax Edition");
if ($buildChannel.get() === "SL") $buildChannel.set("vvertax Edition");
export type PinnedFooterMode = "Off" | "No Writers" | "Full";
export const $pinnedFooterMode = persistAtom<PinnedFooterMode>(
  "pinnedFooterMode",
  _settings["experiment:pinLyricsFooter"] ? "Full" : "Off",
);
export const $customFontEnabled = persistAtom<boolean>("customFontEnabled", false);
export const $customFont = persistAtom<string>("customFont", "");
export const $alwaysShowInFullscreen = persistAtom<string>("alwaysShowInFullscreen", "None");
export const $showVolumeSliderFullscreen = persistAtom<string>("showVolumeSliderFullscreen", "Off");
export const $releaseYearPosition = persistAtom<string>("releaseYearPosition", "Off");
export const $coverArtAnimation = persistAtom<boolean>("coverArtAnimation", true);
// Scatter word-synced lyrics into a floating physics field instead of line layout.
export const $spaceGravityMode = persistAtom<boolean>("spaceGravityMode", false);
export const $memeFormat = persistAtom<string>("memeFormat", "Off");
export const $showScrollToActiveButton = persistAtom<boolean>("showScrollToActiveButton", true);
export const $animateFullscreenClose = persistAtom<boolean>("animateFullscreenClose", false);
export const $enableExperimentalWordSync = persistAtom<boolean>("enableExperimentalWordSync", false);
export const $lyricsSourceOrder = persistAtom<string>(
  "lyricsSourceOrder",
  JSON.stringify(["spicy", "musixmatch", "apple", "spotify", "lrclib", "netease"])
);
export const $disabledLyricsSources = persistAtom<string>(
  "disabledLyricsSources",
  JSON.stringify(["lrclib", "netease"])
);
export const $ignoreMusixmatchWordSync = persistAtom<boolean>("ignoreMusixmatchWordSync", true);
export const $prioritizeAppleMusicQuality = persistAtom<boolean>("prioritizeAppleMusicQuality", true);
export const $musixmatchToken = persistAtom<string>("musixmatchToken", "");
// Reserved for upstream's in-artwork volume controller. This fork keeps its
// own placement selector, so the controller stays disabled.
export const $showVolumeSlider = persistAtom<boolean>("showVolumeSlider", false);
// The album's animated cover, played over the still one when it has one.
export const $motionArtwork = persistAtom<boolean>("motionArtwork", true);
// With Canvas Stage on, what plays when a song has both a Canvas and motion artwork.
export type MotionArtworkPriority = "motion" | "canvas";
export const $motionArtworkPriority = persistAtom<MotionArtworkPriority>("motionArtworkPriority", "motion");
// Motion artwork may fill the Canvas Stage (while Canvas Stage is on); off keeps it on the NowBar cover.
export const $motionArtworkOnStage = persistAtom<boolean>("motionArtworkOnStage", true);
// Volume band below the playback controls in Fullscreen / Cinema View / Popup Lyrics.

// Unsynced lyrics scroll through at the song's pace: "basic" follows loudness, "advanced" the voice.
export type StaticAutoScroll = "off" | "basic" | "advanced";
export const $staticAutoScroll = persistAtom<StaticAutoScroll>("staticAutoScroll", "off");
// Playback timing offset in milliseconds (bipolar: negative = earlier, positive = later)
export const $playbackOffset = persistAtom<number>("playbackOffset", 0);
export const $songPlaybackOffsets = persistAtom<Record<string, number>>("songPlaybackOffsets", {});
export const $smoothSceneTransitions = persistAtom<boolean>("smoothSceneTransitions", true);
export const $allowHidingSettings = persistAtom<boolean>("allowHidingSettings", false);
export const $hideHidingIcon = persistAtom<boolean>("hideHidingIcon", false);
const initialHiddenSettingIds = Array.isArray(_settings.hiddenSettingIds)
  ? _settings.hiddenSettingIds.filter((id): id is string => typeof id === "string" && SETTING_IDS.has(id))
  : [];
export const $hiddenSettingIds = persistAtom<string[]>("hiddenSettingIds", initialHiddenSettingIds);
// Clicking a line seeks this much earlier, so Spotify's ~300ms fade-in on seek
// doesn't swallow the start of the line.
export const $seekFadeCompensation = persistAtom<boolean>("seekFadeCompensation", true);
// Start auto-scrolling to a line this many ms before it becomes active.
export const $scrollLeadEnabled = persistAtom<boolean>("scrollLeadEnabled", false);
export const $scrollLeadMs = persistAtom<number>("scrollLeadMs", 250);
// Spring-driven auto-scroll instead of the browser's native smooth scroll.
export const $smoothScrolling = persistAtom<boolean>("smoothScrolling", false);
// A button back to the line being sung while a hand scroll has left it out of view.
export const $showScrollToActive = $showScrollToActiveButton;
// Frame rate cap for everything that redraws every frame (lyrics animation,
// animated background, smooth-scroll glide). On high refresh rate displays every
// extra frame is another repaint of the whole page, so this bounds the per-second
// work. Off by default, which draws on every display refresh as before; the
// slider value only applies once the cap is turned on.
export const $animationFpsCapEnabled = persistAtom<boolean>("animationFpsCapEnabled", false);
export const $animationFpsCap = persistAtom<number>("animationFpsCap", 60);

// Version atom — NOT persisted, set once at startup
export const $spicyLyricsVersion = atom<string>(
  (window as any)._spicy_lyrics_metadata?.LoadedVersion ?? ProjectVersion
);

// Runtime (ephemeral) atoms
export const $currentLyricsType = atom<string>("None");
export const $lyricsContainerExists = atom<boolean>(false);
// Keeps a mounted lyrics page idle while the NPV card body is collapsed.
// This is runtime-only: a new page always resumes rendering when it opens.
export const $lyricsRendererPaused = atom<boolean>(false);
export const $currentlyFetching = atom<boolean>(false);
export const $currentLyricsData = atom<string>("");

export const $quickControlIds = persistAtom<string[]>("quickControlIds", []);

export const $uiLanguage = persistAtom<"en" | "ru">("uiLanguage", typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en");

export const $duetColorsEnabled=persistAtom<boolean>("duetColorsEnabled",false);
export const $duetLeadColor=persistAtom<string>("duetLeadColor","#cdb4ff");
export const $duetOtherColor=persistAtom<string>("duetOtherColor","#ffb4cd");

export const $favoriteSettings = persistAtom<string[]>("favoriteSettings", []);

// Panel visibility is independent of the experimental feature's availability.
export const $subtitlePanelVisible = persistAtom<boolean>("subtitlePanelVisible", true);
export type SubtitleLayout = { anchor: "player" | "top" | "corner" | "free"; width: number; x: number; y: number };
export const $subtitleLayout = persistAtom<SubtitleLayout>("subtitleLayout", { anchor: "player", width: 780, x: .5, y: .5 });
export const $showLyricsSourceInfo = persistAtom<boolean>("showLyricsSourceInfo", false);
export const $showScrollResumeIndicator = persistAtom<boolean>("showScrollResumeIndicator", false);

export const $prefetchNextLyrics = persistAtom<boolean>("prefetchNextLyrics", true);

/** Settings appearance only; lyric rendering keeps its own style. */
export const $settingsDesign = persistAtom<"ruytha" | "original">("settingsDesign", "ruytha");

$settingsDesign.subscribe(setInterfaceDesign);
if (typeof document !== "undefined") registerDesignDocument(document);

/** Ruytha pronunciation row; the original replacement mode remains available. */
export const $romanizationBelow = persistAtom<boolean>("romanizationBelow", true);
export const $translationsBelow = persistAtom<boolean>("translationsBelow", false);

// Compatibility view for the fork's existing synchronized pronunciation rows.
export type RomanizationDisplay = "replace" | "underLine";
export const $romanizationDisplay = computed($romanizationBelow, below => below ? "underLine" : "replace");

// Register the fork's background adapter so reviewer mode restores its effective value.
registerPersisted("backgroundStyle", {
  get: () => $backgroundStyle.get(),
  set: (style: BackgroundStyle) => $staticBackgroundMode.set(({dynamic:"default",artist:"artistHeader",cover:"coverArt",color:"color",none:"none",legacy:"legacy"})[style]),
} as WritableAtom<BackgroundStyle>, "dynamic");
registerPersisted("backgroundBlur", $backgroundBlur, 0);

PersistedSettings.get("backgroundStyle")!.isStored = () => _settings.backgroundStyle !== undefined || _settings.staticBackgroundMode !== undefined || _settings.pixelLegacyBackground === true;
