import { CheckForUpdates } from "../../../utils/version/CheckForUpdates.tsx";
import { toast } from "sonner";
import { useStore } from "@nanostores/react";
import React, { useEffect, useState } from "react";
import Session from "../../Global/Session.ts";
import { $spicyLyricsVersion } from "../../../utils/stores.ts";

const LINKS = [
  { label: "Website", url: "https://spicylyrics.org" },
  { label: "Discord", url: "https://discord.com/invite/uqgXU5wh8j", brand: "88, 101, 242" },
  { label: "Ko-fi", url: "https://ko-fi.com/spikerko", brand: "255, 94, 138" },
];

type UpdateStatus = "checking" | "latest" | "outdated" | "unknown";
type Version = { Major: number; Minor: number; Patch: number };

function isNewer(a: Version, b: Version): boolean {
  return a.Major !== b.Major ? a.Major > b.Major : a.Minor !== b.Minor ? a.Minor > b.Minor : a.Patch > b.Patch;
}

function ExternalArrow() {
  return <svg className="sl-sp-about-arrow" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2.5 7.5L7.5 2.5M7.5 2.5H3.5M7.5 2.5V6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function Footer() {
  const version = useStore($spicyLyricsVersion);
  const [status, setStatus] = useState<UpdateStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const latest = await Session.SpicyLyrics.GetLatestVersion();
        const current = Session.SpicyLyrics.GetCurrentVersion();
        if (!cancelled) setStatus(latest && current ? (isNewer(latest, current) ? "outdated" : "latest") : "unknown");
      } catch {
        if (!cancelled) setStatus("unknown");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return <div className="sl-sp-about">
    <div className="sl-sp-about-hero">
      <span className="sl-sp-about-wordmark">Spicy Lyrics</span>
      <div className="sl-sp-about-status-row"><span className="sl-sp-about-version">v{version}</span>
        {(status === "latest" || status === "outdated") && <><span className="sl-sp-about-sep">·</span><span className={`sl-sp-about-status sl-sp-about-status--${status}`}>{status === "latest" ? "Latest" : "Outdated"}</span>{status === "outdated" && <button type="button" className="sl-sp-about-update" onClick={() => { void CheckForUpdates(true).catch(() => toast.error("Could not check for updates.")); }}>Update</button>}</>}
      </div>
      <span className="sl-sp-about-build">Build: <span className="sl-sp-about-build-value">vvertax Edition</span></span>
    </div>
    <div className="sl-sp-about-links">
      {LINKS.map(({ label, url, brand }) => <button key={label} type="button" className={`sl-sp-about-link${brand ? " sl-sp-about-link--brand" : ""}`} style={brand ? ({ "--brand": brand } as React.CSSProperties) : undefined} onClick={() => window.open(url, "_blank")}><span>{label}</span><ExternalArrow /></button>)}
    </div>
  </div>;
}
