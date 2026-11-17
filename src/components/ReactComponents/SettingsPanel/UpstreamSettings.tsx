import { useStore } from "@nanostores/react";
import { $ctrlWheelLyricsZoom, $lyricsSize, $rendererVisualStyle, $motionArtwork, $motionArtworkOnStage, $motionArtworkPriority, $staticAutoScroll, $syllableMerge, $syllablePace } from "../../../utils/stores.ts";
import { $ttmlReviewer, setTtmlReviewer } from "../../../utils/ttmlReviewer.ts";
import { matches, Row, Select, Slider, Toggle } from "./components.tsx";

export default function UpstreamSettings({ query = "", sectionFilter = "" }: { query?: string; sectionFilter?: string }) {
  const size = useStore($lyricsSize);
  const wheelZoom = useStore($ctrlWheelLyricsZoom);
  const renderer = useStore($rendererVisualStyle);
  const motion = useStore($motionArtwork);
  const stage = useStore($motionArtworkOnStage);
  const priority = useStore($motionArtworkPriority);
  const scrolling = useStore($staticAutoScroll);
  const merge = useStore($syllableMerge);
  const pace = useStore($syllablePace);
  const reviewer = useStore($ttmlReviewer);
  const show = (section: string, label: string, description: string) => (!sectionFilter || sectionFilter === "All" || sectionFilter === section) && matches(query, label, description);
  return <>
    {show("Lyrics Display", "Renderer Style", "Spring keeps the fork animations. Bloom uses the new line sweep and syllable emphasis.") && <Row settingId="rendererVisualStyle" label="Renderer Style" description="Spring keeps the fork animations. Bloom uses the new line sweep and syllable emphasis."><Select value={renderer} options={["spring", "bloom"]} labels={["Spring", "Bloom"]} onChange={v => $rendererVisualStyle.set(v as "spring" | "bloom")} /></Row>}
    {show("Lyrics Display", "Lyrics Size", "Scale lyrics in every view.") && <Row settingId="lyricsSize" label="Lyrics Size" description="Scale lyrics in every view."><Slider value={size} min={50} max={200} step={5} defaultValue={100} unit="%" editable onChange={v => $lyricsSize.set(v)} /></Row>}
    {show("Lyrics Display", "Ctrl + Wheel Lyrics Zoom", "Resize lyrics with Ctrl and the mouse wheel. Use the scale badge to reset to 100%.") && <Row settingId="ctrlWheelLyricsZoom" label="Ctrl + Wheel Lyrics Zoom" description="Resize lyrics with Ctrl and the mouse wheel. Use the scale badge to reset to 100%."><Toggle checked={wheelZoom} onChange={value => $ctrlWheelLyricsZoom.set(value)} /></Row>}
    {show("Lyrics Display", "Syllable Merge", "Choose which split words Bloom joins. Original timing remains available with Off.") && <Row settingId="syllableMerge" label="Syllable Merge" description="Choose which split words Bloom joins. Original timing remains available with Off." disabled={renderer !== "bloom"} disabledReason="Select Bloom to use this setting."><Select value={merge} options={["off", "full", "steady", "held"]} labels={["Off", "All words", "Steady words", "Held words"]} onChange={v => $syllableMerge.set(v as typeof merge)} /></Row>}
    {show("Lyrics Display", "Syllable Pace", "Time the letters of joined Bloom words by their original syllables.") && <Row settingId="syllablePace" label="Syllable Pace" description="Time the letters of joined Bloom words by their original syllables." disabled={renderer !== "bloom"} disabledReason="Select Bloom to use this setting."><Toggle checked={pace} onChange={v => $syllablePace.set(v)} /></Row>}
    {show("Playback", "Unsynced Auto-scroll", "Scroll unsynced lyrics with the music. Advanced mode follows detected vocals when available.") && <Row settingId="staticAutoScroll" label="Unsynced Auto-scroll" description="Scroll unsynced lyrics with the music. Advanced mode follows detected vocals when available."><Select value={scrolling} options={["off", "basic", "advanced"]} labels={["Off", "Basic", "Advanced"]} onChange={v => $staticAutoScroll.set(v as typeof scrolling)} /></Row>}
    {show("Background", "Motion Artwork", "Play animated album artwork when available.") && <Row settingId="motionArtwork" label="Motion Artwork" description="Play animated album artwork when available."><Toggle checked={motion} onChange={v => $motionArtwork.set(v)} /></Row>}
    {show("Background", "Motion Artwork on Stage", "Allow animated album artwork to fill Canvas Stage.") && <Row settingId="motionArtworkOnStage" label="Motion Artwork on Stage" description="Allow animated album artwork to fill Canvas Stage." disabled={!motion} disabledReason="Turn on Motion Artwork to use this setting."><Toggle checked={stage} onChange={v => $motionArtworkOnStage.set(v)} /></Row>}
    {show("Background", "Artwork Priority", "Choose what plays when a song has both Canvas and motion artwork.") && <Row settingId="motionArtworkPriority" label="Artwork Priority" description="Choose what plays when a song has both Canvas and motion artwork." disabled={!motion || !stage} disabledReason="Turn on Motion Artwork on Stage to use this setting."><Select value={priority} options={["motion", "canvas"]} labels={["Motion Artwork", "Spotify Canvas"]} onChange={v => $motionArtworkPriority.set(v as typeof priority)} /></Row>}
    {show("TTML Reviewer", "TTML Reviewer", "Temporarily use neutral timing and visuals for reviewing TTML. Turning it off restores your saved settings.") && <Row settingId="ttmlReviewer" label="TTML Reviewer" description="Temporarily use neutral timing and visuals for reviewing TTML. Turning it off restores your saved settings."><Toggle checked={reviewer} onChange={setTtmlReviewer} /></Row>}
  </>;
}
