export const MAIN_SETTINGS_SECTIONS = ["Appearance", "Lyrics Display", "Playback", "Interface", "Sources", "Experiments", "Advanced", "About"] as const;
export type SettingsLocation = { section: string; group?: string };
/** Accept old saved tabs and setting categories, then open their new parent group. */
export function settingsLocation(section: string): SettingsLocation {
  const groups: Record<string, SettingsLocation> = {
    Background: { section: "Appearance", group: "Background" },
    Effects: { section: "Lyrics Display", group: "Effects" },
    "Bug report": { section: "Advanced", group: "Diagnostic report" },
    "TTML Reviewer": { section: "Advanced", group: "TTML Reviewer" },
    History: { section: "Advanced", group: "Settings history" },
  };
  return groups[section] ?? { section: section === "Favorites" || MAIN_SETTINGS_SECTIONS.some(value => value === section) ? section : "Appearance" };
}
