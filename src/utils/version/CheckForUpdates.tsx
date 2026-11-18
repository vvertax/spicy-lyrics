import React from "react";
import { isDev } from "../../components/Global/Defaults.ts";
import Session from "../../components/Global/Session.ts";
import { toast } from "sonner";
import { NoticeLink, showNotice } from "../../components/ReactComponents/NoticeDialog.tsx";
import { releaseNotesUrl } from "../../components/ReactComponents/UpdateDialog.tsx";

let shownUpdateVersion: string | null = null;
let WarningInFlight = false;

function availableFix(current: { Text?: string }, latest: { Text?: string; Hotfix?: number }) {
  return latest?.Hotfix > 0 && current?.Text === latest.Text ? latest.Hotfix : undefined;
}

function startUpdate() {
  window.location.reload();
}

/**
 * Non-blocking warning toast. Fires when the user dismisses any part of the
 * update flow without acting on it. Carries an "Update" action so the
 * user can still recover. Deduped so a user clicking through multiple
 * dismiss paths (e.g., toast X then modal close) doesn't get stacked
 * warnings.
 */
function showUpdateDismissWarning(currentVersion: any) {
  if (WarningInFlight) return;
  WarningInFlight = true;
  toast.warning(currentVersion?.Text ? `Staying on ${currentVersion.Text}` : "Staying on this version", {
    className: "sl-update-toast",
    description: "Some lyrics sources and features need the latest version. Updating reloads Spotify.",
    duration: 9000,
    // Its timer pauses while hovered or while Spotify is in the background, so without
    // an X it could sit there with no way to close it short of updating.
    closeButton: true,
    action: {
      label: "Update",
      onClick: startUpdate,
    },
    position: "bottom-right",
    onDismiss: () => { WarningInFlight = false; },
    onAutoClose: () => { WarningInFlight = false; },
  });
}

function presentUpdateAvailable(currentVersion: any, latestVersion: any) {
  let viewClicked = false;
  const fix = availableFix(currentVersion, latestVersion);

  toast(fix ? `Update available for ${latestVersion.Text}` : (latestVersion?.Text ? `Spicy Lyrics ${latestVersion.Text} is out` : "A Spicy Lyrics update is out"), {
    className: "sl-update-toast",
    description: fix ? `Fix #${fix}` : currentVersion?.Text ? `You're on ${currentVersion.Text}.` : undefined,
    duration: Infinity,
    closeButton: true,
    action: {
      label: "Details",
      onClick: (event) => {
        viewClicked = true;
        // The dialog grows out of the toast, so it reads as the same notice opening up.
        const toastEl = (event.currentTarget as HTMLElement).closest("[data-sonner-toast]");
        showUpdateModal(currentVersion, latestVersion, toastEl?.getBoundingClientRect());
      },
    },
    position: "bottom-right",
    onDismiss: () => {
      // Sonner fires onDismiss both on user X-click and after action
      // follow-through. We only want to warn when the user truly walked
      // away; viewClicked guards the action path.
      if (!viewClicked) showUpdateDismissWarning(currentVersion);
    },
  });
}

function showUpdateModal(currentVersion: any, latestVersion: any, origin?: DOMRect) {
  const current = currentVersion?.Text;
  const latest = latestVersion?.Text;
  const fix = availableFix(currentVersion, latestVersion);
  const content = [
    <p className="sl-notice-text">
      {fix ? <><span className="sl-notice-version">{`Fix #${fix}`}</span>.{" "}</> : current && (
        <>
          You're on <span className="sl-notice-version">{current}</span>.{" "}
        </>
      )}
      Updating reloads Spotify, which takes a few seconds.
    </p>,
  ];
  if (latest && !fix) {
    content.push(
      <p className="sl-notice-text sl-notice-text--quiet">
        See what changed in the <NoticeLink href={releaseNotesUrl(latest)}>patch notes</NoticeLink>.
      </p>
    );
  }

  showNotice({
    title: fix ? `Update available for ${latest}` : (latest ? `Version ${latest} is out` : "An update is out"),
    content,
    primary: { label: "Update and reload", onClick: startUpdate },
    secondaryLabel: "Not now",
    onDismiss: () => showUpdateDismissWarning(currentVersion),
    origin,
  });
}

export async function CheckForUpdates(force: boolean = false) {
  if (isDev) return;
  const latestVersion = await Session.SpicyLyrics.GetLatestVersion();
  const currentVersion = Session.SpicyLyrics.GetCurrentVersion();
  if (!Session.SpicyLyrics.IsBehind(currentVersion, latestVersion)) return;
  const releaseKey = JSON.stringify([latestVersion?.Host, latestVersion?.Text, latestVersion?.Hotfix]);
  if (!force && shownUpdateVersion === releaseKey) return;

  presentUpdateAvailable(currentVersion, latestVersion);
  shownUpdateVersion = releaseKey;
}

// ---- dev stuff ------

function fakeLatestVersion(updateTo: string) {
  const parsed = Session.SpicyLyrics.ParseVersion(updateTo);
  if (parsed) return parsed;
  return {
    Text: updateTo,
    Major: 9,
    Minor: 9,
    Patch: 9,
  };
}

export function triggerSpicyLyricsFakeUpdate(options: { updateTo: string }) {
  const currentVersion = Session.SpicyLyrics.GetCurrentVersion();
  const latestVersion = fakeLatestVersion(options.updateTo);
  presentUpdateAvailable(currentVersion, latestVersion);
}
