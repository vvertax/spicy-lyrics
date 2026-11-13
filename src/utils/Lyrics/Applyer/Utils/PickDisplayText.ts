// deno-lint-ignore-file no-explicit-any

import { $romanizationBelow, $translationsBelow } from "../../../stores.ts";
import { HasLyricsText } from "../../EmptyLines.ts";
import { StripZeroWidth } from "./StripZeroWidth.ts";

// Which of an entry's two texts to render.
//
// Normally that is simply the romanization when the romanized view is on and
// the original otherwise, but either one can be missing: TTML lines carrying
// only an `x-roman` span have no source text at all, and most lines have no
// romanization. Whichever side is absent falls back to the other so a line we
// kept because it has *some* text never renders blank.
export function PickDisplayText(entry: any, useRomanized: boolean): string {
  const original = entry?.Text;
  const romanized = entry?.TransliteratedText;

  if (useRomanized && romanized !== undefined) return romanized;
  if (HasLyricsText(original)) return original;
  return HasLyricsText(romanized) ? romanized : (original ?? "");
}

// Romanization Under the Lyrics: whether romanization replaces the lyric, or the lyric
// stays and the romanization sits under it.
export const RomanizeInPlace = (useRomanized: boolean) => useRomanized && !$romanizationBelow.get();
export const RomanizeBelow = (useRomanized: boolean) => useRomanized && $romanizationBelow.get();

/** The translation shown under a line or vocal group (Translations Under the Lyrics), or "". */
export const TranslatedLine = (entry: any): string =>
  $translationsBelow.get() && HasLyricsText(entry?.TranslatedText)
    ? StripZeroWidth(entry.TranslatedText).replace(/\s+/g, " ").trim()
    : "";

// The romanization shown under a line. Empty when the line has none, or when the
// romanization is all it has (PickDisplayText already shows it as the line itself).
export function RomanizedLine(entry: any): string {
  if (!HasLyricsText(entry?.Text) || !HasLyricsText(entry?.TransliteratedText)) return "";
  return differs(entry.Text, entry.TransliteratedText) ? StripZeroWidth(entry.TransliteratedText).trim() : "";
}

// A line in Latin letters can carry a "romanization" that only changes its case or
// spacing; repeating it under the line would show the same words twice.
const comparable = (text: string) => StripZeroWidth(text).toLowerCase().replace(/[\s\p{P}]+/gu, "");
const differs = (original: string, romanized: string) => comparable(original) !== comparable(romanized);

/**
 * A background vocal's translation, or "" when it only repeats part of the lead's: some
 * lyrics give every background vocal the whole line's translation again.
 */
export const BackgroundTranslation = (background: any, lead: any): string => {
  const text = TranslatedLine(background);
  const leadText = TranslatedLine(lead);
  return text && leadText && comparable(leadText).includes(comparable(text)) ? "" : text;
};

/** Whether any line of the lyrics carries a translation (the Translation button shows then). */
export const LyricsHaveTranslations = (lyrics: any): boolean =>
  lyrics?.HasTranslations === true ||
  [...(lyrics?.Content ?? []), ...(lyrics?.Lines ?? [])].some(
    (entry: any) =>
      HasLyricsText(entry?.TranslatedText) ||
      HasLyricsText(entry?.Lead?.TranslatedText) ||
      (entry?.Background ?? []).some((bg: any) => HasLyricsText(bg?.TranslatedText))
  );

/** A piece of the romanization line with its syllable's times, in seconds like the lyrics. */
export type RomanPart = { text: string; start: number; end: number };

// The same for a sung line, a part per syllable so it can light up in time with the
// lyrics: the syllables' romanizations joined back into words, with the original text
// kept for syllables that have none (Latin words in a Japanese line).
export function RomanizedSyllableParts(syllables: any[]): RomanPart[] {
  if (!syllables.some((s) => HasLyricsText(s?.Text) && HasLyricsText(s?.TransliteratedText))) return [];
  const parts = syllables
    .map((s, i) => {
      const part = HasLyricsText(s?.TransliteratedText) ? s.TransliteratedText : (s?.Text ?? "");
      // RomanSpaceAfter: a word ends inside what the lyrics sing as one (Japanese, see
      // RomajiSpacing.ts), so the romaji gets the gap the lyric doesn't.
      const joined = s?.IsPartOfWord && !s?.RomanSpaceAfter;
      const text = joined || i === syllables.length - 1 ? part : `${part} `;
      return { text: StripZeroWidth(text).replace(/\s+/g, " "), start: s.StartTime, end: s.EndTime };
    })
    .filter((p) => p.text.length > 0);
  if (parts.length > 0) parts[0].text = parts[0].text.trimStart();
  const original = syllables.map((s) => s?.Text ?? "").join("");
  return differs(original, parts.map((p) => p.text).join("")) ? parts : [];
}

export const RomanizedSyllables = (syllables: any[]): string =>
  RomanizedSyllableParts(syllables)
    .map((p) => p.text)
    .join("")
    .trim();

export default PickDisplayText;
