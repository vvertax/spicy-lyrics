/** The built-in production channel is independent of the installed loader host.
 * Alternate releases are explicit custom channels, never aliases of production. */
export function forkReleaseHost(): string {
  return "lrc.vvrtx.lol";
}
