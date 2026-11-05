import { quoteLineText } from "./QuoteText.ts";

export type SubtitleLine = { text: string; start: number; end: number; source?: any; activationStart?: number; activationEnd?: number; parent?: any };
export function subtitleLines(data: any): SubtitleLine[] {
  if (!data || data.Type === "Static" || !Array.isArray(data.Content)) return [];
  return data.Content.filter((line: any) => line.Type !== "Interlude").map((line: any) => ({
    source: line, text: quoteLineText(line), start: Number(line.StartTime ?? line.Lead?.StartTime) * 1000,
    end: Number(line.EndTime ?? line.Lead?.EndTime) * 1000,
  })).filter((line: SubtitleLine) => line.text && Number.isFinite(line.start) && Number.isFinite(line.end) && line.end > line.start)
    .sort((a: SubtitleLine, b: SubtitleLine) => a.start - b.start);
}
export function subtitleAt(lines: SubtitleLine[], position: number) {
  let current: SubtitleLine | undefined, next: SubtitleLine | undefined;
  for (const line of lines) {
    if (line.start > position) { next = line; break; }
    if (position < line.end) current = line;
  }
  // Promote the upcoming line immediately in a gap (including the intro).
  // Its real timing stays intact, so words wait for the actual vocal onset.
  if (!current && next) {
    current = next;
    next = lines[lines.indexOf(current) + 1];
  }
  return { current, next };
}

/** Background parts have their own clock, independent of the displayed lead. */
export function subtitleBackingLines(data: any): SubtitleLine[] {
  if (!data || data.Type === "Static" || !Array.isArray(data.Content)) return [];
  const content = data.Content.flatMap((line: any) => (line.Background ?? []).map((background: any) => {
    const lead = background.Lead ?? background;
    const parts = lead.Syllables ?? [];
    const start = background.StartTime ?? lead.StartTime ?? parts[0]?.StartTime;
    const end = background.EndTime ?? lead.EndTime ?? parts[parts.length - 1]?.EndTime;
    return { ...background, StartTime: start, EndTime: end, Background: [],
      SubtitleParent: line, SubtitleActivationStart: Number(line.StartTime ?? line.Lead?.StartTime ?? start) * 1000,
      SubtitleActivationEnd: Number(line.EndTime ?? line.Lead?.EndTime ?? end) * 1000,
      OppositeAligned: line.OppositeAligned, Lead: { ...lead, Syllables: parts } };
  }));
  return subtitleLines({ Type: data.Type, Content: content }).map(line => ({ ...line,
    parent: line.source.SubtitleParent, activationStart: Math.min(line.start, Number.isFinite(line.source.SubtitleActivationStart) ? line.source.SubtitleActivationStart : line.start),
    activationEnd: Math.max(line.end, Number.isFinite(line.source.SubtitleActivationEnd) ? line.source.SubtitleActivationEnd : line.end),
  }));
}
export function subtitleBackingAt(lines: SubtitleLine[], position: number): SubtitleLine[] {
  return lines.filter(line => position >= (line.activationStart ?? line.start) && position < (line.activationEnd ?? line.end));
}
