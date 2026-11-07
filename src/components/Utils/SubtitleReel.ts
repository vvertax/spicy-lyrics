import { renderComparisonLyrics } from "./ComparisonRenderer.ts";
import { createSubtitleBacking } from "./SubtitleBacking.ts";
import type { SubtitleLine } from "./SubtitleModel.ts";

/** A single physical tape: existing rows never change size or get replaced when
 * promoted. Only this tape moves; only its outer viewport clips the content. */
export function createSubtitleReel(viewport: HTMLElement, seek: (line: SubtitleLine) => void) {
  const doc = viewport.ownerDocument, win = doc.defaultView!;
  const tape = doc.createElement("div"); tape.className = "sl-subtitle-tape"; viewport.append(tape);
  type Entry = { block: HTMLElement; lead: HTMLElement; backing: HTMLElement;
    session: ReturnType<typeof renderComparisonLyrics>; bg: ReturnType<typeof createSubtitleBacking> };
  const entries = new Map<SubtitleLine, Entry>();
  const backingParents = new Map<any, SubtitleLine>();
  let sizeMotion: Animation | undefined;
  let motion: Animation | undefined, revision = 0, target = 0, height = 0, dirty = true;
  let lastBackingCount = 0;
  let lastCurrent: SubtitleLine | undefined, lastNext: SubtitleLine | undefined;
  const observer = new ResizeObserver(() => { dirty = true; }); observer.observe(tape);
  const drop = (line: SubtitleLine, entry: Entry) => { entry.session.destroy(); entry.bg.clear(); entry.block.remove(); entries.delete(line); };
  const readY = () => {
    const transform = win.getComputedStyle(tape).transform;
    return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
  };
  return {
    update(lines: SubtitleLine[], current: SubtitleLine | undefined, next: SubtitleLine | undefined,
      backing: SubtitleLine[], data: any, position: number) {
      // A held lyric needs only its production animator. Do not flush style/layout
      // or reconcile the tape on every letter/spring frame.
      if (!dirty && current === lastCurrent && next === lastNext && !backing.length && !lastBackingCount) {
        for (const entry of entries.values()) entry.session.animate(position);
        return;
      }
      lastBackingCount = backing.length;
      const previousTop = current && entries.get(current)?.lead.getBoundingClientRect().top;
      const oldY = readY();
      const wanted = new Set<SubtitleLine>();
      if (current) {
        const index = lines.indexOf(current);
        if (index > 0) wanted.add(lines[index - 1]);
        wanted.add(current);
      }
      if (next) wanted.add(next);
      for (const part of backing) {
        let parent = lines.find(line => line.source === part.parent) ?? backingParents.get(part.parent);
        if (!parent) {
          parent = { text: "", start: part.activationStart ?? part.start, end: part.activationEnd ?? part.end, source: part.parent };
          backingParents.set(part.parent, parent);
        }
        wanted.add(parent);
      }
      let changed = current !== lastCurrent || next !== lastNext;
      for (const line of wanted) {
        if (entries.has(line)) continue;
        const block = doc.createElement("div"); block.className = "sl-subtitle-block";
        const lead = doc.createElement("div"); lead.className = "sl-subtitle-lead"; lead.hidden = !line.text;
        const bgHost = doc.createElement("div"); bgHost.className = "sl-subtitle-backing"; bgHost.hidden = true;
        block.append(lead, bgHost);
        const session = renderComparisonLyrics(lead, { ...data, Content: line.text ? [{ ...line.source, Background: [] }] : [] }, () => seek(line));
        session.rows.forEach(row => row.element.setAttribute("aria-label", line.text));
        entries.set(line, { block, lead, backing: bgHost, session, bg: createSubtitleBacking(bgHost, seek, renderComparisonLyrics) });
        changed = true;
      }
      const ordered = [...entries].sort((a, b) => a[0].start - b[0].start);
      ordered.forEach(([line, entry], index) => {
        if (tape.children[index] !== entry.block) tape.insertBefore(entry.block, tape.children[index] ?? null);
        entry.block.classList.toggle("sl-subtitle-current", line === current);
        entry.block.classList.toggle("sl-subtitle-next", line === next);
        entry.block.inert = !wanted.has(line);
        entry.session.animate(position);
        entry.bg.update(backing.filter(part => part.parent === line.source), data, position);
      });
      // Handle a backing-only file without manufacturing a visible lead row.
      if (!ordered.length) return;
      if (changed || dirty) {
        dirty = false;
        const tapeTop = tape.getBoundingClientRect().top;
        const focus = current ? entries.get(current) : undefined;
        let top = focus ? focus.lead.getBoundingClientRect().top - tapeTop : Infinity;
        let bottom = focus ? focus.block.offsetTop + focus.block.offsetHeight : 0;
        if (next) { const upcoming = entries.get(next)!; bottom = Math.max(bottom, upcoming.lead.offsetTop + upcoming.lead.offsetHeight + upcoming.block.offsetTop); }
        for (const [line, entry] of ordered) {
          if (!backing.some(part => part.parent === line.source) || entry.backing.hidden) continue;
          top = Math.min(top, entry.block.offsetTop + entry.backing.offsetTop);
          bottom = Math.max(bottom, entry.block.offsetTop + entry.backing.offsetTop + entry.backing.offsetHeight);
        }
        if (!Number.isFinite(top)) top = 0;
        const nextTarget = -Math.max(0, top - 8);
        const nextHeight = Math.max(50, bottom + nextTarget + 8);
        const sameTarget = Math.abs(nextTarget - target) < .5 && Math.abs(nextHeight - height) < .5;
        if (!sameTarget || changed) {
          const token = ++revision;
          const newTop = focus?.lead.getBoundingClientRect().top;
          const from = previousTop !== undefined && newTop !== undefined ? oldY + previousTop - newTop : nextTarget;
          motion?.cancel(); motion = undefined;
          tape.style.transform = `translateY(${nextTarget}px)`;
          const renderedHeight = viewport.getBoundingClientRect().height;
          sizeMotion?.cancel(); sizeMotion = undefined;
          viewport.style.height = `${Math.max(renderedHeight, nextHeight)}px`;
          target = nextTarget; height = nextHeight;
          const finish = () => {
            if (token !== revision) return;
            motion?.cancel(); motion = undefined;
            const anchor = focus?.block ?? ordered.find(([line]) => wanted.has(line))?.[1].block;
            const before = anchor?.offsetTop ?? 0;
            for (const [line, entry] of entries) if (!wanted.has(line)) drop(line, entry);
            const corrected = nextTarget + before - (anchor?.offsetTop ?? 0);
            tape.style.transform = `translateY(${corrected}px)`; target = corrected;
            const fromHeight = viewport.getBoundingClientRect().height;
            viewport.style.height = `${nextHeight}px`;
            if (!win.matchMedia("(prefers-reduced-motion: reduce)").matches && Math.abs(fromHeight - nextHeight) > .5)
              sizeMotion = viewport.animate([{ height: `${fromHeight}px` }, { height: `${nextHeight}px` }], { duration: 320, easing: "cubic-bezier(.22,1,.36,1)" });
            dirty = true;
          };
          if (previousTop !== undefined && !win.matchMedia("(prefers-reduced-motion: reduce)").matches && Math.abs(from - nextTarget) > .5) {
            motion = tape.animate([{ transform: `translateY(${from}px)` }, { transform: `translateY(${nextTarget}px)` }],
              { duration: 560, easing: "cubic-bezier(.25,.8,.25,1)" });
            motion.onfinish = finish;
          } else { finish(); }
        }
      }
      lastCurrent = current; lastNext = next;
    },
    clear() { sizeMotion?.cancel(); sizeMotion = undefined; revision++; motion?.cancel(); motion = undefined; for (const [line, entry] of entries) drop(line, entry);
      backingParents.clear(); lastBackingCount = 0; target = height = 0; dirty = true; lastCurrent = lastNext = undefined; tape.style.transform = "none"; viewport.style.height = ""; },
    destroy() { this.clear(); observer.disconnect(); tape.remove(); },
  };
}
