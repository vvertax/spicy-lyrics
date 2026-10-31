import { createWordAnimationPreview } from "../../../utils/Lyrics/Animator/Lyrics/LyricsAnimator.ts";
import React, { useEffect, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import { $animatorValues } from "../../../utils/Lyrics/Animator/Tuning.ts";

export default function AnimatorPreview() {
  const tuning = useStore($animatorValues);
  const root = useRef<HTMLDivElement>(null);
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    const element = root.current; if (!element) return;
    const win = element.ownerDocument.defaultView!;
    if (win.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const liveLine = element.ownerDocument.querySelector<HTMLElement>('#SpicyLyricsPage .LyricsContent .line');
    element.style.fontFamily = liveLine ? win.getComputedStyle(liveLine).fontFamily : 'SpicyLyrics, sans-serif';
    const words = Array.from(element.querySelectorAll<HTMLElement>('.vv-preview-word'));
    const players = words.map((word, index) => createWordAnimationPreview(word, 600 + index * 700, 600 + (index+1) * 700));
    const started = win.performance.now(); let last = started; let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - started;
      const delta = Math.min((now-last)/1000, .05); last = now;
      players.forEach(play => play(elapsed, delta));
      if (elapsed < 6000) frame = win.requestAnimationFrame(tick);
    };
    frame = win.requestAnimationFrame(tick);
    return () => win.cancelAnimationFrame(frame);
  }, [tuning, replay]);
  return <div className="vv-animator-preview">
    <div className="vv-preview-text" ref={root} aria-label="Let the music move you">
      {'Let the music move you'.split(' ').map((word, index) => <span className="vv-preview-word" key={index} aria-hidden="true">{word}</span>)}
    </div>
    <div className="vv-preview-caption"><span>Live renderer · word timing, springs and glow</span><button type="button" className="sl-sp-btn" onClick={() => setReplay(value => value+1)}>Replay</button></div>
    <p className="vv-shortcut-help">Alt+Shift: K — Karaoke · R — Recording · T — Romanization · L — Current line. Escape exits recording.</p>
  </div>;
}
