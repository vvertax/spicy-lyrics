/** Per-song values replace (rather than add to) the global offset. Zero is a valid override. */
export function songOffset(offsets: unknown, uri: string | undefined): number | undefined {
  if (!uri || !offsets || typeof offsets !== "object" || Array.isArray(offsets) ||
      !Object.hasOwn(offsets, uri)) return undefined;
  const value = (offsets as Record<string, unknown>)[uri];
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 5000
    ? value : undefined;
}

export function effectiveOffset(global: number, offsets: unknown, uri: string | undefined): number {
  return songOffset(offsets, uri) ?? global;
}
