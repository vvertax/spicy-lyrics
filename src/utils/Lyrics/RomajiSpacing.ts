// Word gaps for romaji built a syllable at a time. Japanese TTML marks most syllables as
// part of one long word, so their romaji joins into "aikawarazudappishiterumainichi".
// Romanizing the whole line (Kuroshiro's spaced mode) knows where the words are; this
// finds those gaps among the syllables, so the romanization line can show
// "aikawarazu dappi shiteru mainichi" and still light up syllable by syllable.

// Letters only, without macrons: "Ō" and "ou" count the same length often enough, and
// a syllable romanized alone can differ a little from the same text in its line.
const letters = (text: string) =>
  text
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * For each syllable, whether a word ends after it. `syllables` is each syllable's own
 * romaji, `spacedLine` the whole line's, with spaces between words. The two are lined
 * up by letter count, scaled to the same total; a gap is placed at the syllable edge
 * nearest to it, and dropped when no edge is close (a line romanized differently).
 */
export function RomajiWordBreaks(syllables: string[], spacedLine: string): boolean[] {
  const breaks = syllables.map(() => false);
  const ends: number[] = [];
  let total = 0;
  for (const syllable of syllables) {
    total += letters(syllable).length;
    ends.push(total);
  }
  const words = spacedLine.split(/\s+/).map(letters).filter(Boolean);
  const lineTotal = words.reduce((sum, word) => sum + word.length, 0);
  if (total === 0 || lineTotal === 0) return breaks;

  const scale = total / lineTotal;
  let position = 0;
  for (const word of words.slice(0, -1)) {
    position += word.length;
    const target = position * scale;
    let best = -1;
    for (let i = 0; i < syllables.length - 1; i++) {
      if (best === -1 || Math.abs(ends[i] - target) < Math.abs(ends[best] - target)) best = i;
    }
    if (best !== -1 && Math.abs(ends[best] - target) <= 1.5) breaks[best] = true;
  }
  return breaks;
}
