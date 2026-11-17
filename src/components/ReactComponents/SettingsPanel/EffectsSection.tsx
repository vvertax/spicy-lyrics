import { useContext as useRevealedContext } from "react";
import { RevealedSettingContext } from "./components.tsx";
import AnimatorPreview from "./AnimatorPreview.tsx";
import { useStore } from "@nanostores/react";
import React from "react";
import { $allowHidingSettings, $hiddenSettingIds, $memeFormat, $simpleLyricsMode, $simpleLyricsModeRenderingType, $spaceGravityMode } from "../../../utils/stores.ts";
import { $animatorPreset, type AnimatorPreset } from "../../../utils/Lyrics/Animator/Tuning.ts";
import { matches, Row, SectionTitle, Select, Toggle } from "./components.tsx";

const SECTION_NAME = "Effects";
const simpleOptions = ["Off", "calculate", "animate"];
const simpleLabels = ["Off", "Calculate", "Animate"];
const wordOptions = ["Off", "Gibberish", "all lowercase", "ALL UPPERCASE"];

export default function EffectsSection({ query, sectionFilter, showHidden = false, onManageAnimator }: { query: string; sectionFilter: string; showHidden?: boolean; onManageAnimator?: () => void }) {
  const revealedSetting = useRevealedContext(RevealedSettingContext);
  const allowHidingSettings = useStore($allowHidingSettings);
  const hiddenIds = useStore($hiddenSettingIds);
  const memeFormat = useStore($memeFormat);
  const simpleLyricsMode = useStore($simpleLyricsMode);
  const simpleLyricsModeRenderingType = useStore($simpleLyricsModeRenderingType);
  const spaceGravityMode = useStore($spaceGravityMode);
  const animatorPreset = useStore($animatorPreset);
  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;
  const visible = (id: string) => id === revealedSetting || (showHidden ? hiddenIds.includes(id) : !allowHidingSettings || !hiddenIds.includes(id) || Boolean(query.trim()));
  const gravity = visible("lyrics-space-gravity") && matches(query, "Space Gravity Mode", "Let word-synced lyrics drift and tumble freely while their timing animations continue.");
  const words = visible("lyrics-word-filters") && matches(query, "Unique Word Filters", "Transform every lyric word.");
  const simple = visible("lyrics-simple-mode") && matches(query, "Simple Lyrics Mode", "Off, Calculate, or Animate simple lyric transitions.");
  const animator = visible("effects-animator-presets") && matches(query, "Animator Presets", "Choose Default, Pixel, or Custom animator behavior.");
  if (!gravity && !words && !simple && !animator) return null;
  const simpleValue = simpleLyricsMode ? simpleLyricsModeRenderingType : "Off";
  const setSimple = (value: string) => { if (value === "Off") $simpleLyricsMode.set(false); else { $simpleLyricsModeRenderingType.set(value); $simpleLyricsMode.set(true); } };
  return <><SectionTitle>Effects</SectionTitle>
    {gravity && <Row settingId="lyrics-space-gravity" label="Space Gravity Mode" description="Let word-synced lyrics drift and tumble freely while their timing animations continue."><Toggle checked={spaceGravityMode} onChange={(value) => $spaceGravityMode.set(value)} /></Row>}
    {words && <Row settingId="lyrics-word-filters" label="Unique Word Filters" description="Transform every lyric word."><Select value={wordOptions.includes(memeFormat) ? memeFormat : "Off"} options={wordOptions} onChange={(value) => $memeFormat.set(value)} /></Row>}
    {simple && <Row settingId="lyrics-simple-mode" label="Simple Lyrics Mode" description="Off disables Simple Lyrics Mode. Calculate and Animate choose how simple lyric transitions render."><Select value={simpleValue} options={simpleOptions} labels={simpleLabels} onChange={setSimple} /></Row>}
    {animator && <Row settingId="effects-animator-presets" label="Animator Presets" description="Default matches upstream. Pixel keeps Spicy Lyrics behavior. Custom stores live tuning."><span style={{ display: "flex", gap: 8, alignItems: "center" }}><Select value={animatorPreset} options={["Default", "Pixel", "Custom"]} onChange={(value) => $animatorPreset.set(value as AnimatorPreset)} />{animatorPreset === "Custom" && <button className="sl-sp-btn" type="button" onClick={onManageAnimator}>Manage</button>}</span></Row>}
    {animator && <AnimatorPreview />}
  </>;
}
