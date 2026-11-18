import { settingInSection } from "./hiddenSettings.ts";
import { useContext as useRevealedContext } from "react";
import { RevealedSettingContext } from "./components.tsx";
import { useStore } from "@nanostores/react";
import React from "react";
import { toast } from "sonner";
import { SaveFontFile, FONT_FILE_FAMILY } from "../../../utils/fonts/FontFile.ts";
import { INTERFACE_DESIGNS, VVERTAX_YOU_PALETTES, normalizeVvertaxYouPalette, type InterfaceDesign } from "../../../utils/InterfaceDesign.ts";
import { CustomPaletteColor } from "./CustomPaletteColor.tsx";
import {
  $settingsDesign,
  $vvertaxYouPalette,
  $coverArtAnimation,
  $smoothSceneTransitions,
  $allowHidingSettings,
  $animationFpsCap,
  $animationFpsCapEnabled,
  $customFont,
  $customFontEnabled,
  $showNpvDynamicBg,
  $staticBackgroundBlur,
  $staticBackgroundMode,
  $hiddenSettingIds,
  $pinnedFooterMode,
} from "../../../utils/stores.ts";
import { matches, Row, SectionTitle, Select, Slider, Toggle } from "./components.tsx";
import { ExperimentSettings } from "./ExperimentsPanel.tsx";

const SECTION_NAME = "Appearance";
const FPS_CAP_DESCRIPTION = "Limit how often lyrics, animated backgrounds, and smooth scrolling redraw. Turn off to redraw on every display refresh.";
const FPS_SLIDER_DESCRIPTION = "Frames per second while the cap is on.";
const bgModeOptions = ["default", "legacy", "auto", "artistHeader", "coverArt", "color", "none"];
const bgModeLabels = ["Default", "Legacy", "Auto", "Artist Header", "Cover Art", "Color", "None (Transparent)"];
const designDescription = "Choose the style of Spicy Lyrics windows and controls.";
const paletteDescription = "Choose the color palette for vvertax You.";

interface Props {
  showSectionTitle?: boolean;
  query: string;
  sectionFilter: string;
  showHidden?: boolean;
}

export default function AppearanceSection({ query, sectionFilter, showHidden = false, showSectionTitle = true }: Props) {
  const revealedSetting = useRevealedContext(RevealedSettingContext);
  const settingsDesign = useStore($settingsDesign);
  const palette = normalizeVvertaxYouPalette(useStore($vvertaxYouPalette));
  const coverArtAnimation = useStore($coverArtAnimation);
  const showDesign = sectionFilter !== "Background" && !showHidden;
  const designMatches = showDesign && matches(query, "Interface Design", designDescription);
  const paletteMatches = showDesign && settingsDesign === "vvertax-you" && matches(query, "Color Palette", paletteDescription);
  const smoothSceneTransitions = useStore($smoothSceneTransitions);
  const customFontEnabled = useStore($customFontEnabled);
  const customFont = useStore($customFont);
  const staticBackgroundMode = useStore($staticBackgroundMode);
  const staticBackgroundBlur = useStore($staticBackgroundBlur);
  const showNpvDynamicBg = useStore($showNpvDynamicBg);
  const pinnedFooterMode = useStore($pinnedFooterMode);
  const allowHidingSettings = useStore($allowHidingSettings);
  const hiddenSettingIds = useStore($hiddenSettingIds);
  const fpsCapEnabled = useStore($animationFpsCapEnabled);
  const fpsCap = useStore($animationFpsCap);

  if (!["All", SECTION_NAME, "Background"].includes(sectionFilter)) return null;

  const visible = (id: string) => settingInSection(id, sectionFilter) && (id === revealedSetting || (showHidden ? hiddenSettingIds.includes(id) : !allowHidingSettings || !hiddenSettingIds.includes(id) || Boolean(query.trim())));
  const scene = visible("appearance-scene-transitions") && matches(query, "Smooth Track Transitions", "Fade lyrics and song information when tracks change, alongside the background transition.");
  const r1 = visible("appearance-custom-font") && matches(query, "Use Custom Font", "Use a custom font instead of the bundled Spicy Lyrics font.");
  const r2 = visible("appearance-custom-font") && matches(query, "Font Name Font Preset Font File", "Font family name file ttf otf woff to use for lyrics.");
  const r3 = visible("appearance-background-type") && matches(query, "Background Type", "Choose the dynamic, legacy, static image, or color background.");
  const r4 = visible("appearance-npv-background") && matches(query, "Display Dynamic Background in Now Playing View", "Show the animated background in the Now Playing panel.");
  const blurApplies = ["auto", "artistHeader", "coverArt"].includes(staticBackgroundMode);
  const r6 = visible("appearance-background-blur") && matches(query, "Background Blur", "Soften the static background image.");
  const r7 = visible("appearance-pinned-footer") && matches(query, "Pinned Lyrics Footer", "Keep source and community credits visible. Full also pins writers.");
  const r8 = visible("appearance-sliderbar-styling") && matches(query, "New SliderBar Styling", "New glass-like style for the SliderBar. Disable to revert back to the original one.");
  const r9 = visible("appearance-fps-limit") && matches(query, "Limit Animation Frame Rate", FPS_CAP_DESCRIPTION);
  const r10 = visible("appearance-fps-cap") && matches(query, "Animation Frame Rate", FPS_SLIDER_DESCRIPTION);
  const cover = visible("appearance-cover-art-animation") && matches(query, "Cover Art Animation", "Animate cover art changes in the NowBar.");

  if (!designMatches && !paletteMatches && !scene && !r1 && !r2 && !r3 && !r4 && !r6 && !r7 && !r8 && !r9 && !r10 && !cover) return null;

  return (
    <>
      {showSectionTitle && <SectionTitle>{sectionFilter === "Background" ? "Background" : "Appearance"}</SectionTitle>}
      {cover && <Row settingId="appearance-cover-art-animation" label="Cover Art Animation" description="Animate cover art changes in the NowBar."><Toggle checked={coverArtAnimation} onChange={(value) => $coverArtAnimation.set(value)} /></Row>}
      {designMatches && <Row label="Interface Design" description={designDescription}>
        <Select label="Interface Design" value={settingsDesign} options={Object.keys(INTERFACE_DESIGNS)} labels={Object.values(INTERFACE_DESIGNS)} onChange={value => $settingsDesign.set(value as InterfaceDesign)} />
      </Row>}
      {paletteMatches && <Row label="Color Palette" description={paletteDescription} featureId="vvertaxYouPalette">
        <Select label="Color Palette" value={palette} options={Object.keys(VVERTAX_YOU_PALETTES)} labels={Object.values(VVERTAX_YOU_PALETTES)} onChange={value => $vvertaxYouPalette.set(normalizeVvertaxYouPalette(value))} />
      </Row>}
      {paletteMatches && palette === "custom" && <Row label="Palette color" description="Generate the interface colors from one HEX color." stacked><CustomPaletteColor /></Row>}
      {scene && <Row settingId="appearance-scene-transitions" label="Smooth Track Transitions" description="Fade lyrics and song information when tracks change, alongside the background transition."><Toggle checked={smoothSceneTransitions} onChange={value => $smoothSceneTransitions.set(value)} /></Row>}

      {r3 && (
        <Row settingId="appearance-background-type" label="Background Type" description="Choose the dynamic, legacy, static image, or color background.">
          <Select
            value={staticBackgroundMode === "off" ? "default" : staticBackgroundMode}
            options={bgModeOptions}
            labels={bgModeLabels}
            onChange={(v) => $staticBackgroundMode.set(v)}
          />
        </Row>
      )}

      {r6 && (
        <Row settingId="appearance-background-blur" label="Background Blur" description="Soften the static background image." disabled={!blurApplies} disabledReason="Choose an image background to adjust its blur." stacked>
          <Slider
            value={staticBackgroundBlur}
            min={0}
            max={48}
            step={1}
            defaultValue={0}
            unit="px"
            onChange={(v) => $staticBackgroundBlur.set(v)}
          />
        </Row>
      )}

      {r7 && (
        <Row settingId="appearance-pinned-footer" label="Pinned Lyrics Footer" description="Keep source and community credits visible. Full also pins writers.">
          <Select value={pinnedFooterMode} options={["Off", "No Writers", "Full"]} onChange={(value) => $pinnedFooterMode.set(value as typeof pinnedFooterMode)} />
        </Row>
      )}
      {r4 && (
        <Row settingId="appearance-npv-background"
          label="Display Dynamic Background in Now Playing View"
          description="Show the animated background in the Now Playing panel."
        >
          <Toggle checked={showNpvDynamicBg} onChange={(v) => $showNpvDynamicBg.set(v)} />
        </Row>
      )}
      {r8 && <ExperimentSettings experimentIds={["newProgressBarStyling"]} showBuiltIn={false} />}

      {r9 && (
        <Row settingId="appearance-fps-limit" label="Limit Animation Frame Rate" description={FPS_CAP_DESCRIPTION}>
          <Toggle checked={fpsCapEnabled} onChange={(value) => $animationFpsCapEnabled.set(value)} />
        </Row>
      )}

      {r10 && (
        <Row settingId="appearance-fps-cap" label="Animation Frame Rate" description={FPS_SLIDER_DESCRIPTION} disabled={!fpsCapEnabled} disabledReason="Enable the frame rate limit to change its value." stacked>
          <Slider value={fpsCap} min={15} max={240} step={5} defaultValue={60} unit="FPS"
            onChange={(value) => $animationFpsCap.set(value)} />
        </Row>
      )}

      {r1 && (
        <Row settingId="appearance-custom-font" label="Use Custom Font" description="Use a custom font instead of the bundled Spicy Lyrics font.">
          <Toggle checked={customFontEnabled} onChange={(v) => $customFontEnabled.set(v)} />
        </Row>
      )}

      {r2 && <Row settingId="appearance-font-preset" disabled={!customFontEnabled} disabledReason="Enable Use Custom Font to change this setting." label="Font Preset" description="Choose a preset (Geist, Inter, Bricolage and Poppins download online), enter an installed font name, or load a file.">
        <Select value={['Geist', 'Inter', 'Bricolage Grotesque', 'Poppins', 'Spotify Mix', 'Segoe UI', 'Arial', 'Georgia', 'Verdana', 'Trebuchet MS', FONT_FILE_FAMILY].includes(customFont) ? customFont : 'custom'}
          options={['Geist', 'Inter', 'Bricolage Grotesque', 'Poppins', 'Spotify Mix', 'Segoe UI', 'Arial', 'Georgia', 'Verdana', 'Trebuchet MS', FONT_FILE_FAMILY, 'custom']}
          labels={['Geist', 'Inter', 'Bricolage Grotesque', 'Poppins', 'Spotify Mix', 'Segoe UI', 'Arial', 'Georgia', 'Verdana', 'Trebuchet MS', 'From a File', 'Custom system font']}
          onChange={(value) => { if (value !== 'custom') $customFont.set(value); else $customFont.set(''); }} />
      </Row>}
      {r2 && <Row settingId="appearance-font-file" disabled={!customFontEnabled} disabledReason="Enable Use Custom Font to change this setting." label="Font File" description="TTF, OTF, WOFF or WOFF2. Saved locally for future sessions.">
        <button type="button" className="sl-sp-btn" onClick={() => {
          const input = document.createElement('input');
          input.type = 'file'; input.accept = '.ttf,.otf,.woff,.woff2';
          input.onchange = async () => {
            const file = input.files?.[0]; if (!file) return;
            try {
              await SaveFontFile(file);
              // Notify even when replacing a file while the file family is selected.
              $customFont.set(''); $customFont.set(FONT_FILE_FAMILY);
              toast.success(`Using ${file.name}`);
            } catch (error) { toast.error((error as Error).message); }
          };
          input.click();
        }}>Choose Font File</button>
      </Row>}
      {r2 && (
        <Row settingId="appearance-font-name" disabled={!customFontEnabled} disabledReason="Enable Use Custom Font to change this setting." label="Font Name" description="Enter the installed font family name to use for lyrics.">
          <input
            className="sl-sp-text-input"
            type="text"
            placeholder="Spotify Mix"
            value={customFont}
            onChange={(e) => $customFont.set(e.currentTarget.value)}
            spellCheck={false}
          />
        </Row>
      )}

    </>
  );
}
