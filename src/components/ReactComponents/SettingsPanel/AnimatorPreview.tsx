import { renderComparisonLyrics } from "../../Utils/ComparisonRenderer.ts";
import React, { useEffect, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import { $animatorValues, $animatorPreset } from "../../../utils/Lyrics/Animator/Tuning.ts";
import { $simpleLyricsMode, $spaceGravityMode, $splitWordMotion } from "../../../utils/stores.ts";
import { onAnimationFrame } from "../../../utils/AnimationFrameLoop.ts";
import { timeOffset } from "../../../utils/Lyrics/Animator/Shared.ts";

export const animationPreviewLyrics = () => ({Type:"Syllable", Content:[{Lead:{StartTime:.6,EndTime:6.6,Syllables:[
  {Text:"Let",StartTime:.6,EndTime:1.1},
  {Text:"the",StartTime:1.1,EndTime:1.5},
  {Text:"mu",StartTime:1.5,EndTime:1.95,IsPartOfWord:true},
  {Text:"sic",StartTime:1.95,EndTime:2.5},
  {Text:"move",StartTime:2.5,EndTime:4.4},
  {Text:"you",StartTime:4.4,EndTime:6.6},
]}}]});

export default function AnimatorPreview() {
  const tuning = useStore($animatorValues), preset = useStore($animatorPreset);
  const simple = useStore($simpleLyricsMode), gravity = useStore($spaceGravityMode), splits = useStore($splitWordMotion);
  const root = useRef<HTMLDivElement>(null);
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    const element = root.current; if (!element) return;
    const win = element.ownerDocument.defaultView!;
    const liveLine = element.ownerDocument.querySelector<HTMLElement>('#SpicyLyricsPage .LyricsContent .line');
    element.style.fontFamily = liveLine ? win.getComputedStyle(liveLine).fontFamily : 'SpicyLyrics, sans-serif';
    const session = renderComparisonLyrics(element, animationPreviewLyrics(), () => {});
    // A demo is not a seek control and must not inherit the current song's offset.
    for (const row of session.rows) { row.element.removeAttribute('role'); row.element.removeAttribute('tabindex'); row.element.removeAttribute('title'); row.element.onclick=null; row.element.onkeydown=null; }
    let elapsed=0, last:number|undefined;
    session.animate(-timeOffset);
    const reduced = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { session.animate(7200-timeOffset); return () => session.destroy(); }
    const stop=onAnimationFrame(now => {
      if (last!==undefined) elapsed+=Math.min(now-last,50);
      last=now;session.animate(elapsed-timeOffset);
      if (elapsed>=7400) stop();
    },win);
    return () => { stop(); session.destroy(); };
  }, [tuning, preset, simple, gravity, splits, replay]);
  return <div className="vv-animator-preview">
    <div className="vv-preview-text" aria-label="Let the music move you"><div className="vv-preview-renderer" ref={root} aria-hidden="true" /></div>
    <div className="vv-preview-caption"><span>Live renderer · words, letters, held notes and split words</span><button type="button" className="sl-sp-btn" onClick={() => setReplay(value => value+1)}>Replay</button></div>
    <p className="vv-shortcut-help">Alt+Shift: K — Karaoke · R — Recording · T — Romanization · L — Current line. Escape exits recording.</p>
  </div>;
}
