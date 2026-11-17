import { CopyText } from "../../../utils/BugReport.ts";
import { useState } from "react";
import { buildDiagnosticData, openDiagnostics } from "../../Utils/Diagnostics.ts";
import { formatDiagnosticText } from "../../../utils/DiagnosticReport.ts";
import { matches, Row } from "./components.tsx";

export function BugReportPane({ query = "", compact = false }: { query?: string; compact?: boolean }) {
  const [report, setReport] = useState(() => formatDiagnosticText(buildDiagnosticData()));
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState(false);
  const copy = async (from: Element, open = false) => {
    const ok = await CopyText(report, from);
    setStatus(ok ? "Report copied" : "Clipboard unavailable.");
    if (ok && open) from.ownerDocument.defaultView?.open("https://github.com/vvertax/spicy-lyrics/issues", "_blank");
  };
  if (!matches(query, "Diagnostic report Report a Bug", "Review configuration and recent extension errors before copying.")) return null;
  if (compact) return <Row label="Diagnostic report" description="Review configuration and recent extension errors before copying."><button className="sl-sp-btn" type="button" onClick={event => openDiagnostics(event.currentTarget.ownerDocument)}>Open</button></Row>;
  return <div className="sl-sp-bug">
    <p className="sl-sp-intro">Review or edit the report before copying. Lyrics, account details and tokens are not included. Nothing is sent automatically.</p>
    <div className="sl-sp-bug-actions">
      <button className="sl-sp-about-link sl-sp-bug-primary" type="button" onClick={event => copy(event.currentTarget, true)}>Copy and open bug tracker</button>
      <button className="sl-sp-about-link" type="button" onClick={event => copy(event.currentTarget)}>Copy only</button>
    </div>
    <p role="status">{status}</p>
    <div className="sl-sp-group">
      <h3 className="sl-sp-group-title">Report contents</h3>
      {editing ? <textarea id="sl-bug-report" aria-label="Diagnostic report" value={report} spellCheck={false} onChange={event => setReport(event.currentTarget.value)} /> : <pre className="sl-sp-bug-preview">{report}</pre>}
    </div>
    <div className="sl-sp-bug-actions">
      <button className="sl-sp-btn" type="button" onClick={() => {setReport(formatDiagnosticText(buildDiagnosticData()));setStatus("");}}>Refresh report</button>
      <button className="sl-sp-btn" type="button" aria-pressed={editing} onClick={() => setEditing(!editing)}>Edit report</button>
      <button className="sl-sp-btn" type="button" onClick={event => openDiagnostics(event.currentTarget.ownerDocument)}>Readable report / JSON</button>
    </div>
  </div>;
}
