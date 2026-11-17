import { redactDiagnostic } from "./DiagnosticLog.ts";
export type DiagnosticData = Record<string, unknown>;

export function safeDiagnosticValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[nested data omitted]";
  if (typeof value === "string") return redactDiagnostic(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value == null) return value;
  if (Array.isArray(value)) return value.slice(0,100).map(item => safeDiagnosticValue(item, depth + 1));
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).slice(0,100).map(([key,item]) => [key, /token|authorization|cookie|secret|password|api.?key|account|email|user.?id/i.test(key) ? "[redacted]" : safeDiagnosticValue(item,depth + 1)]));
  return "[unavailable]";
}

export function formatDiagnosticText(report: DiagnosticData): string {
  const headings: Record<string,string> = { runtime:"Runtime", window:"Window and layout", playback:"Playback", lyrics:"Lyrics pipeline", rendering:"Rendering", network:"Sources and network", settings:"Settings", experiments:"Experiments", errors:"Recent errors", findings:"Checks" };
  const lines = [`SPICY LYRICS — ${report.version ?? "unknown"}`, `Captured: ${report.capturedAt ?? "unknown"}`, `Channel: ${report.channel ?? "unknown"}`];
  const append = (key: string, value: unknown, indent = "  ") => {
    const label = key.replace(/([a-z])([A-Z])/g,"$1 $2").toLowerCase().replace(/^./, c => c.toUpperCase()).replace(/\b(ui|fps|npv|ttml|cpu|json|mb)\b/gi, word => word.toUpperCase());
    if (Array.isArray(value)) {
      if (!value.length) { lines.push(`${indent}${label}: none`); return; }
      lines.push(`${indent}${label}:`); value.forEach((item,index) => append(String(index+1),item,indent+"  ")); return;
    }
    if (value && typeof value === "object") { lines.push(`${indent}${label}:`); for (const [child,item] of Object.entries(value)) append(child,item,indent+"  "); return; }
    const text = value === true ? "on" : value === false ? "off" : value == null || value === "" ? "unavailable" : String(value);
    lines.push(`${indent}${label}: ${text.replace(/\n/g,"\n"+indent+"  ")}`);
  };
  let index=0;
  for (const [key,value] of Object.entries(report)) {
    if (["schemaVersion","version","capturedAt","channel"].includes(key)) continue;
    lines.push("",`${String(++index).padStart(2,"0")}  ${headings[key] ?? key}`,"─".repeat(42));
    if (value && typeof value === "object" && !Array.isArray(value)) for (const [label,item] of Object.entries(value)) append(label,item);
    else append(key,value);
  }
  return lines.join("\n")+"\n";
}
