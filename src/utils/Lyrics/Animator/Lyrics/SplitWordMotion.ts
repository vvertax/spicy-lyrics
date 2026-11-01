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

type Part = { HTMLElement: HTMLElement };
const groups = new WeakMap<HTMLElement, Part[][]>();
export function animateSplitWords(lines: { HTMLElement: HTMLElement; Syllables?: { Lead: Part[] } }[], reduced: boolean): void {
  // Batch all geometry reads across the page before any translation writes.
  const updates: { element: HTMLElement; shift: number }[] = [];
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
      joined = [...parents.values()].filter(parts => parts.length > 1);
      groups.set(line.HTMLElement, joined);
    }
    // Read geometry before writing translations. Individual translate/scale do not
    // affect offsetWidth/Top/Left, so the measurement cannot feed back on itself.
    for (const parts of joined) {
      const rows = new Map<number, { element: HTMLElement; width: number; growth: number; left: number }[]>();
      for (const part of parts) {
        const element = part.HTMLElement;
        if (reduced) { updates.push({ element, shift: 0 }); continue; }
        const scale = element.ownerDocument.defaultView!.getComputedStyle(element).scale;
        const growth = scale === 'none' ? 1 : parseFloat(scale);
        const top = element.offsetTop;
        const row = rows.get(top) ?? [];
        row.push({ element, width: element.offsetWidth, growth: Number.isFinite(growth) ? growth : 1, left: element.offsetLeft });
        rows.set(top, row);
      }
      for (const row of rows.values()) {
        // Physical order also handles RTL runs. A wrapped fragment grows independently.
        row.sort((a, b) => a.left - b.left);
        const shifts = wordGrowthShifts(row.map(part => part.width), row.map(part => part.growth));
        row.forEach((part, index) => updates.push({ element: part.element, shift: shifts[index] }));
      }
    }
  }
  for (const { element, shift } of updates) {
    // Separate translate preserves the existing lift, scale and per-letter emphasis.
    const value = `${shift.toFixed(3)}px 0`;
    if (element.style.translate !== value) element.style.translate = value;
  }
}
