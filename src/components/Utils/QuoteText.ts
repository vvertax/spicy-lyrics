type Part = { Text?: string; IsPartOfWord?: boolean };
export function quoteLineText(line: { Text?: string; Lead?: { Syllables?: Part[] } }): string {
  if (typeof line.Text === "string") return line.Text.trim();
  const parts = line.Lead?.Syllables ?? [];
  let text = "";
  parts.forEach((part, index) => {
    const value = part.Text ?? ""; const previous = parts[index - 1];
    if (text && value && previous && !previous.IsPartOfWord && !/\s$/.test(text) && !/^\s|^[,.;:!?…)]/.test(value)) text += " ";
    text += value;
  });
  return text.replace(/[\u200B\uFEFF]/g, "").trim();
}
export function wrapQuoteText(text: string, width: number, measure: (text: string) => number): string[] {
  const rows: string[] = []; let current = "";
  for (const word of text.split(/\s+/u).filter(Boolean)) {
    const candidate = current ? current + " " + word : word;
    if (measure(candidate) <= width) { current = candidate; continue; }
    if (current) { rows.push(current); current = ""; }
    // Only split tokens that cannot fit even on an empty row.
    for (const char of word) {
      if (current && measure(current + char) > width) { rows.push(current); current = ""; }
      current += char;
    }
  }
  if (current) rows.push(current);
  return rows;
}
