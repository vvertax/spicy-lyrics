import NewFeatureBadge, { isNewFeature } from "./NewFeatureBadge.tsx";
import type { ReactNode } from "react";

export default function SettingsGroup({ title, open, onChange, children }: { title: string; open: boolean; onChange: (open: boolean) => void; children: ReactNode }) {
  return <details className="sl-sp-settings-group sl-sp-settings-group--quick" open={open} onToggle={event => {if (event.currentTarget.open !== open) onChange(event.currentTarget.open);}}>
    <summary><span className="vv-quick-summary-text"><span className="sl-sp-settings-group-label">{title}{isNewFeature(title) && <NewFeatureBadge />}</span><><span className="vv-quick-hint vv-quick-hint--closed">Click to configure</span><span className="vv-quick-hint vv-quick-hint--open">Click to collapse</span></></span></summary>
    {open && <div className="sl-sp-settings-group-body">{children}</div>}
  </details>;
}
