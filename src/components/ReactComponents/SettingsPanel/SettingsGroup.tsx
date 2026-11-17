import NewFeatureBadge, { isNewFeature } from "./NewFeatureBadge.tsx";
import type { ReactNode } from "react";

export default function SettingsGroup({ title, open, onChange, children }: { title: string; open: boolean; onChange: (open: boolean) => void; children: ReactNode }) {
  return <details className="sl-sp-settings-group" open={open} onToggle={event => {if (event.currentTarget.open !== open) onChange(event.currentTarget.open);}}>
    <summary><span className="sl-sp-settings-group-label">{title}{isNewFeature(title) && <NewFeatureBadge />}</span><span aria-hidden="true">⌄</span></summary>
    {open && <div className="sl-sp-settings-group-body">{children}</div>}
  </details>;
}
