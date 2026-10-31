export function authorHandle(input: string): string | null {
  const handle = input.trim().replace(/^@/, "");
  return handle.length <= 100 && /^[\p{L}\p{N}_.-]+$/u.test(handle) ? handle : null;
}
export function changedTTMLLines(a: unknown[], b: unknown[]): number {
  let differences = 0;
  for (let i=0;i<Math.max(a.length,b.length);i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) differences++;
  }
  return differences;
}
