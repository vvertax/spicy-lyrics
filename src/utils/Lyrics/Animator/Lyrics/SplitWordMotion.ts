/** Same centred layout rule as wordGrowthShifts in the supplied LyricsLineView.swift.
 * Widths are unscaled CSS pixels; growth comes from the renderer's current springs.
 */
export function wordGrowthShifts(widths: number[], growth: number[]): number[] {
  const extra = widths.map((width, i) => width * ((growth[i] ?? 1) - 1));
  const total = extra.reduce((sum, piece) => sum + piece, 0);
  let before = 0;
  return extra.map(piece => {
    const shift = before + piece / 2 - total / 2;
    before += piece;
    return shift;
  });
}

export function splitLiftShift(index: number, count: number, progress: number) {
  if (count < 2 || progress <= 0 || progress >= 1) return 0;
  return (2 * index / (count - 1) - 1) * .065 * Math.sin(Math.PI * progress);
}

type Part = { HTMLElement: HTMLElement; StartTime?: number; EndTime?: number; FlameGroup?: unknown };
type Glyph = { element: HTMLElement; width: number; originShift: number; left: number; scale: string; defaultScale: number };
type Word = { parent: HTMLElement; parts: Part[]; rows?: Glyph[][]; applied: boolean };
const groups = new WeakMap<HTMLElement, Word[]>();
const measuredWords = new WeakMap<Element, Word>();
const observers = new WeakMap<Document, ResizeObserver>();

function glyphGeometry(element: HTMLElement, style: CSSStyleDeclaration) {
  const pixels = (value: string) => Number.parseFloat(value) || 0;
  const left = pixels(style.paddingLeft) + pixels(style.borderLeftWidth);
  const right = pixels(style.paddingRight) + pixels(style.borderRightWidth);
  const width = Number.parseFloat(style.width);
  const borderBox = Number.isFinite(width)
    ? width + (style.boxSizing === "border-box" ? 0 : left + right)
    : element.offsetWidth;
  let wordGap = 0;
  if (element.classList && !element.classList.contains("PartOfWord") && !element.classList.contains("LastWordInLine")) {
    const suffix = element.ownerDocument.defaultView!.getComputedStyle(element, "::after");
    if (suffix.content === '""') {
      wordGap = pixels(suffix.marginLeft) + pixels(suffix.marginRight);
    }
  }
  // The word gap and compositing padding are outside the Swift layout item's
  // glyph width. CSS still scales the whole box about its centre.
  const direction = style.direction === "rtl" ? -1 : 1;
  return {
    width: Math.max(0, borderBox - left - right - wordGap),
    originShift: (right - left + direction * wordGap) / 2,
  };
}

function measureWord(word: Word): Glyph[][] {
  const document = word.parent.ownerDocument ?? word.parts[0].HTMLElement.ownerDocument;
  const view = document.defaultView!;
  let observer = observers.get(document);
  if (!observer && view.ResizeObserver) {
    observer = new view.ResizeObserver((entries, instance) => {
      for (const { target } of entries) {
        const measured = measuredWords.get(target);
        if (measured) measured.rows = undefined;
        if (!target.isConnected) instance.unobserve(target);
      }
    });
    observers.set(document, observer);
  }
  if (observer) {
    measuredWords.set(word.parent, word);
    observer.observe(word.parent);
  }

  const rows = new Map<number, Glyph[]>();
  for (const part of word.parts) {
    const element = part.HTMLElement;
    const style = view.getComputedStyle(element);
    const scale = Number.parseFloat(style.scale);
    const top = element.offsetTop;
    const row = rows.get(top) ?? [];
    row.push({
      element, ...glyphGeometry(element, style), left: element.offsetLeft,
      scale: element.style.scale, defaultScale: Number.isFinite(scale) ? scale : 1,
    });
    rows.set(top, row);
    if (observer) {
      measuredWords.set(element, word);
      observer.observe(element, { box: "border-box" });
    }
  }
  // Physical order handles RTL runs. Wrapped fragments grow independently.
  return [...rows.values()].map(row => row.sort((a, b) => a.left - b.left));
}

export function animateSplitWords(lines: { HTMLElement: HTMLElement; Syllables?: { Lead: Part[] } }[], reduced: boolean, spread = true, position?: number): void {
  // Batch all geometry reads across the page before any translation writes.
  const updates: { element: HTMLElement; shift: number; lift?: number }[] = [];
  for (const line of lines) {
    if (!line.Syllables || !line.HTMLElement.isConnected) continue;
    let joined = groups.get(line.HTMLElement);
    if (!joined) {
      const parents = new Map<HTMLElement, Part[]>();
      for (const part of line.Syllables.Lead) {
        const parent = part.HTMLElement.parentElement;
        if (!parent?.classList.contains('word-group')) continue;
        const parts = parents.get(parent) ?? [];
        parts.push(part); parents.set(parent, parts);
      }
      joined = [...parents].filter(([, parts]) => parts.length > 1).map(([parent, parts]) => ({ parent, parts, applied: false }));
      groups.set(line.HTMLElement, joined);
    }
    for (const word of joined) {
      if (reduced || !spread) {
        word.applied = false;
        const { parts } = word;
        const start = parts[0].StartTime ?? 0;
        const end = parts.at(-1)?.EndTime ?? start;
        const progress = position === undefined || end <= start || parts.some(part => part.FlameGroup) ? 0 : (position - start) / (end - start);
        const inlineDirection = line.HTMLElement.classList?.contains("rtl") ? -1 : 1;
        for (const [index, { HTMLElement: element }] of parts.entries()) {
          const lift = reduced ? 0 : inlineDirection * splitLiftShift(index, parts.length, progress);
          if (lift || element.style.translate && element.style.translate !== "0.000px 0") {
            updates.push({ element, shift: 0, lift });
          }
        }
        continue;
      }

      // Both animators write scale inline. Reading it avoids flushing pending
      // style/layout work, while resize notifications invalidate the box geometry.
      if (!word.rows) {
        word.rows = measureWord(word);
        word.applied = false;
      }
      for (const row of word.rows) {
        if (word.applied && row.every(part => part.scale === part.element.style.scale)) continue;
        const growth = row.map(part => {
          part.scale = part.element.style.scale;
          const value = Number.parseFloat(part.scale);
          return Number.isFinite(value) ? value : part.defaultScale;
        });
        const shifts = wordGrowthShifts(row.map(part => part.width), growth);
        row.forEach((part, index) => updates.push({
          element: part.element,
          shift: shifts[index] + part.originShift * (growth[index] - 1),
        }));
      }
      word.applied = true;
    }
  }
  for (const { element, shift, lift } of updates) {
    // Separate translate preserves the existing lift, scale and per-letter emphasis.
    const value = lift ? lift.toFixed(4) + "em 0" : shift.toFixed(3) + "px 0";
    if (element.style.translate !== value) element.style.translate = value;
  }
}
