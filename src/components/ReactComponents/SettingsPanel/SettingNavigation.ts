import { SETTINGS } from "./hiddenSettings.ts";
import { settingsLocation } from "./SettingsLayout.ts";
export function settingDestination(id: string): { id: string; section: string; group?: string } | null {
  const entry = SETTINGS.find(setting => setting.id === id);
  return entry ? { id: entry.id, ...settingsLocation(entry.category) } : null;
}
