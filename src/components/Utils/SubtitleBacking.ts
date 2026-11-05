import type { renderComparisonLyrics } from "./ComparisonRenderer.ts";
import type { SubtitleLine } from "./SubtitleModel.ts";

/** One persistent animation session per backing part. A neighbouring part opening
 * or closing must not rebuild its words, reset springs, or delay its first note. */
export function createSubtitleBacking(host: HTMLElement, seek: (line: SubtitleLine) => void,
  render: typeof renderComparisonLyrics) {
  type Entry = { slot: HTMLElement; session: ReturnType<typeof renderComparisonLyrics>;
    animation?: Animation; visible: boolean; revision: number };
  const entries = new Map<SubtitleLine, Entry>();
  const reduced = () => host.ownerDocument.defaultView!.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const remove = (line: SubtitleLine, entry: Entry) => {
    entry.revision++; entry.animation?.cancel(); entry.session.destroy(); entry.slot.remove(); entries.delete(line);
    host.hidden = entries.size === 0;
  };
  return {
    update(active: SubtitleLine[], data: any, position: number) {
      const wanted = new Set(active);
      for (const line of active) {
        let entry = entries.get(line);
        if (!entry) {
          const slot = host.ownerDocument.createElement("div"); slot.className = "sl-subtitle-background-slot";
          const content = host.ownerDocument.createElement("div"); slot.append(content); host.append(slot); host.hidden = false;
          const session = render(content, { ...data, Content: [line.source] }, () => seek(line), { backgroundOnly: true });
          session.rows.forEach(row => row.element.setAttribute("aria-label", line.text));
          entry = { slot, session, visible: false, revision: 0 }; entries.set(line, entry);
        }
        if (!entry.visible) {
          const opacity = entry.animation ? host.ownerDocument.defaultView!.getComputedStyle(entry.slot).opacity : "0";
          entry.revision++; entry.animation?.cancel(); entry.visible = true; entry.slot.inert = false;
          if (!reduced()) entry.animation = entry.slot.animate([{ opacity }, { opacity: 1 }], { duration: 240, easing: "ease-out" });
        }
      }
      // A rewind may insert an earlier part after a surviving tail. Restore source
      // order only when necessary, without rebuilding or moving rows every frame.
      const slots = active.map(line => entries.get(line)!.slot);
      const currentOrder = Array.from(host.children).filter(slot => slots.includes(slot as HTMLElement));
      if (slots.some((slot, index) => slot !== currentOrder[index])) slots.forEach(slot => host.append(slot));
      for (const [line, entry] of entries) {
        // Keep the outgoing part's real animator alive throughout its fade.
        entry.session.animate(position);
        if (wanted.has(line) || !entry.visible) continue;
        entry.visible = false; entry.slot.inert = true;
        const token = ++entry.revision;
        const opacity = host.ownerDocument.defaultView!.getComputedStyle(entry.slot).opacity;
        entry.animation?.cancel();
        if (reduced()) { remove(line, entry); continue; }
        entry.animation = entry.slot.animate([{ opacity }, { opacity: 0 }], { duration: 180, easing: "ease-out", fill: "forwards" });
        entry.animation.onfinish = () => { if (entry.revision === token && !entry.visible) remove(line, entry); };
      }
    },
    clear() { for (const [line, entry] of entries) remove(line, entry); host.hidden = true; },
  };
}
