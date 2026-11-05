export type CheckSpan = { start?: number; end?: number; invalid?: boolean; background?: boolean };
export type CheckLine = CheckSpan & { text: string; spans: CheckSpan[] };
export type TTMLIssue = { line: number; code: string; severity: "error" | "warning" | "info"; time: number };

export function checkTime(value: string | null, frameRate = 30, tickRate = 1): number | undefined {
  if (value === null || !value.trim()) return undefined;
  const input = value.trim();
  const frames = input.match(/^(\d+):(\d{2}):(\d{2}):(\d+(?:\.\d+)?)$/);
  if (frames && +frames[2] < 60 && +frames[3] < 60 && +frames[4] < frameRate)
    return +frames[1] * 3600 + +frames[2] * 60 + +frames[3] + +frames[4] / frameRate;
  const clock = input.match(/^(?:(\d+):)?(\d+):(\d{1,2}(?:\.\d+)?)$/);
  if (clock && +clock[3] < 60 && (!clock[1] || +clock[2] < 60)) return +(clock[1] ?? 0) * 3600 + +clock[2] * 60 + +clock[3];
  const offset = input.match(/^(-?\d+(?:\.\d+)?)(ms|s|m|h|f|t)?$/);
  if (!offset) return undefined;
  const factor = ({ ms: .001, s: 1, m: 60, h: 3600, f: 1 / frameRate, t: 1 / tickRate } as Record<string, number>)[offset[2] ?? "s"];
  const result = +offset[1] * factor;
  return Number.isFinite(result) ? result : undefined;
}

export function checkTimingLines(lines: CheckLine[]): TTMLIssue[] {
  const issues: TTMLIssue[] = [];
  const seen = new Set<string>();
  const add = (line: number, code: string, severity: TTMLIssue["severity"] = "warning") => {
    const key = `${line}:${code}`;
    if (seen.has(key)) return;
    seen.add(key); issues.push({ line, code, severity, time: Math.max(0, lines[line].start ?? 0) });
  };
  lines.forEach((line, index) => {
    if (!line.text.trim()) add(index, "Empty lyric line");
    const range = (part: CheckSpan) => {
      if (part.invalid) add(index, "Unrecognized timing", "error");
      if ((part.start ?? 0) < 0 || (part.end ?? 0) < 0) add(index, "Negative timing", "error");
      if (part.start !== undefined && part.end !== undefined) {
        if (part.end < part.start) add(index, "End precedes start", "error");
        else if (part.end === part.start) add(index, "Zero duration");
      }
    };
    range(line);
    if (line.start === undefined || line.end === undefined) add(index, "Untimed lyric line", "info");
    for (const span of line.spans) {
      range(span);
      // Background vocals can extend beyond the lead. Overlapping voices are not errors.
      if (!span.background && line.start !== undefined && line.end !== undefined &&
          ((span.start !== undefined && span.start < line.start - .03) || (span.end !== undefined && span.end > line.end + .03)))
        add(index, "Word outside line timing");
    }
  });
  let end = 0;
  const ordered = lines.map((line, index) => ({ line, index })).filter(({ line }) => line.start !== undefined && line.end !== undefined && line.end >= line.start)
    .sort((a, b) => a.line.start! - b.line.start!);
  for (const { line, index } of ordered) {
    if (end > 0 && line.start! - end >= 20) add(index, "Long instrumental gap", "info");
    end = line.spans.reduce((latest, span) => Math.max(latest, span.end ?? 0), Math.max(end, line.end!));
  }
  return issues;
}

const attribute = (element: Element, name: string) => Array.from(element.attributes).find(attr => attr.localName === name)?.value ?? null;
export function inspectTTML(text: string): { lines: CheckLine[]; issues: TTMLIssue[] } {
  const xml = new DOMParser().parseFromString(text, "text/xml");
  if (xml.getElementsByTagName("parsererror").length || xml.documentElement.localName !== "tt") throw new Error("Invalid TTML XML");
  const root = xml.documentElement;
  const multiplier = (attribute(root, "frameRateMultiplier") ?? "1 1").split(/\s+/).map(Number);
  const rate = Number(attribute(root, "frameRate") ?? 30) * multiplier[0] / multiplier[1];
  const frameRate = Number.isFinite(rate) && rate > 0 ? rate : 30;
  const tickRate = Math.max(1, Number(attribute(root, "tickRate") ?? 1) || 1);
  const timing = (element: Element): CheckSpan => {
    const begin = attribute(element, "begin"), finish = attribute(element, "end"), duration = attribute(element, "dur");
    const start = checkTime(begin, frameRate, tickRate), parsedEnd = checkTime(finish, frameRate, tickRate), dur = checkTime(duration, frameRate, tickRate);
    return { start, end: parsedEnd ?? (start !== undefined && dur !== undefined ? start + dur : undefined),
      invalid: Boolean((begin !== null && start === undefined) || (finish !== null && parsedEnd === undefined) || (duration !== null && dur === undefined)) };
  };
  const body = Array.from(xml.getElementsByTagName("*")).find(element => element.localName === "body");
  if (!body) throw new Error("TTML has no body");
  const lines: CheckLine[] = Array.from(body.getElementsByTagName("*")).filter(element => element.localName === "p").map(paragraph => {
    const spans = Array.from(paragraph.getElementsByTagName("*")).filter(element => element.localName === "span").map(span => {
      let parent: Element | null = span, background = false;
      while (parent && parent !== paragraph) { background ||= /(?:^|\s)(?:x-bg|background)(?:\s|$)/.test(attribute(parent, "role") ?? ""); parent = parent.parentElement; }
      return { ...timing(span), background };
    });
    const range = timing(paragraph);
    const starts = spans.map(span => span.start).filter((value): value is number => value !== undefined);
    const ends = spans.map(span => span.end).filter((value): value is number => value !== undefined);
    return { ...range, start: range.start ?? (starts.length ? starts.reduce((first, value) => Math.min(first, value), Infinity) : undefined),
      end: range.end ?? (ends.length ? ends.reduce((last, value) => Math.max(last, value), -Infinity) : undefined), text: paragraph.textContent ?? "", spans };
  });
  if (!lines.length) throw new Error("No lyric paragraphs in TTML");
  return { lines, issues: checkTimingLines(lines) };
}
