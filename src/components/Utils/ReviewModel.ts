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

export function comparisonTiming(line: any): { start: number; end: number } {
  const start = Number(line.StartTime ?? line.Lead?.StartTime ?? 0) * 1000;
  const end = Number(line.EndTime ?? line.Lead?.EndTime ?? line.StartTime ?? line.Lead?.StartTime ?? 0) * 1000;
  return { start: Number.isFinite(start) ? Math.max(0,start) : 0, end: Number.isFinite(end) ? Math.max(start,end) : 0 };
}
export function comparisonDifference(a: any, b: any): string {
  if (!a || !b) return 'missing';
  const text=(line:any)=>line.Text ?? line.Lead?.Syllables?.map((word:any)=>word.Text).join('') ?? '';
  if(text(a)!==text(b))return 'text';
  return JSON.stringify(a)===JSON.stringify(b)?'':'timing';
}
