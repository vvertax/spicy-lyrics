import { Select } from "./Select.tsx";
import { settingDestination } from "./SettingNavigation.ts";
import { settingsLocation } from "./SettingsLayout.ts";
import SettingsGroup from "./SettingsGroup.tsx";
import { ReviewerPane } from "./ReviewerSection.tsx";
import { BugReportPane } from "./BugReportSection.tsx";
import UpstreamSettings from "./UpstreamSettings.tsx";
import "../../../css/InterfaceDesign.css";
import "../../../css/OriginalSettings.css";
import HistoryPanel from "./HistoryPanel.tsx";
import { $settingsDesign, $favoriteSettings } from "../../../utils/stores.ts";
import { ExperimentSettings } from "./ExperimentsPanel.tsx";
import { $uiLanguage } from "../../../utils/stores.ts";
import { PopupModal } from "../../Modal.ts";
import { Fragment, useEffect, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import { $allowHidingSettings, $hideHidingIcon } from "../../../utils/stores.ts";
import AppearanceSection from "./AppearanceSection.tsx";
import DeveloperSection from "./DeveloperSection.tsx";
import EffectsSection from "./EffectsSection.tsx";
import InterfaceSection from "./InterfaceSection.tsx";
import LyricsSection from "./LyricsSection.tsx";
import SourcesSection from "./SourcesSection.tsx";
import Footer from "./Footer.tsx";
import { matches, Row, RevealedSettingContext, NavigateSettingContext, SearchBar, ShowHiddenSettingsInSearchContext, FavoriteSettingsContext, EditFavoritesContext } from "./components.tsx";
import { AdvancedIcon, AboutIcon, FavoritesIcon, AppearanceIcon, PlaybackIcon, ExperimentsIcon, InterfaceIcon, LyricsIcon, SourcesIcon } from "./icons.tsx";

const TABS = [
  ["Favorites", "Favorites", FavoritesIcon],
  ["Appearance", "Appearance", AppearanceIcon],
  ["Lyrics", "Lyrics Display", LyricsIcon],
  ["Playback", "Playback", PlaybackIcon],
  ["Interface", "Interface", InterfaceIcon],
  ["Sources", "Sources", SourcesIcon],
  ["Experiments", "Experiments", ExperimentsIcon],
  ["Advanced", "Advanced", AdvancedIcon],
  ["About", "About", AboutIcon],
] as const;

export type SettingsPanelState = { query: string; sectionFilter: string; scrollTop: number; targetSettingId?: string; expandedGroup?: string };
export default function SettingsPanel({ onOpenHiddenSettings, onManageAnimator, initialState, onStateChange }: { onOpenHiddenSettings?: () => void; onManageAnimator?: (state: SettingsPanelState) => void; initialState?: SettingsPanelState; onStateChange?: (state: SettingsPanelState) => void }) {
  const language = useStore($uiLanguage);
  const design = useStore($settingsDesign);
  const favorites = useStore($favoriteSettings);
  const hasFavorites = Array.isArray(favorites) && favorites.some(id => typeof id === "string");
  const [query, setQuery] = useState(initialState?.query ?? "");
  const initialLocation = settingsLocation(initialState?.sectionFilter ?? "Appearance");
  const [selectedSection, setSectionFilter] = useState<string>(initialLocation.section === "Favorites" && !hasFavorites ? "Appearance" : initialLocation.section);
  const [expandedGroup, setExpandedGroup] = useState<string | undefined>(initialState?.expandedGroup ?? (initialState?.targetSettingId ? settingDestination(initialState.targetSettingId)?.group : undefined) ?? initialLocation.group);
  const sectionFilter = selectedSection === "Favorites" && !hasFavorites ? "Appearance" : selectedSection;
  const allowHidingSettings = useStore($allowHidingSettings);
  const hideHidingIcon = useStore($hideHidingIcon);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [navigation, setNavigation] = useState<{ id: string; request: number } | null>(initialState?.targetSettingId ? { id: initialState.targetSettingId, request: 0 } : null);
  useEffect(() => {
    if (!navigation) return;
    const row = scrollRef.current?.querySelector<HTMLElement>(`[data-setting-id="${navigation.id}"]`);
    if (!row) return;
    const win = row.ownerDocument.defaultView!;
    const frame = win.requestAnimationFrame(() => {
      row.scrollIntoView({ block: "center", behavior: win.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      row.querySelector<HTMLElement>('.sl-sp-control input:not(:disabled),.sl-sp-control select:not(:disabled),.sl-sp-control button:not(:disabled)')?.focus({ preventScroll: true });
    });
    return () => win.cancelAnimationFrame(frame);
  }, [navigation, sectionFilter, query, expandedGroup]);
  const navigateSetting = (_label: string, id: string) => {
    const destination = settingDestination(id);
    if (!destination) return;
    setQuery("");
    setSectionFilter(destination.section);
    setExpandedGroup(destination.group);
    setNavigation({ id, request: Date.now() });
  };
  const searching = Boolean(query.trim());
  const favoritesOnly = !searching && sectionFilter === "Favorites";
  const [editFavorites, setEditFavorites] = useState(false);
  const tabs = TABS.filter(([, tab]) => tab !== "Favorites" || hasFavorites);
  useEffect(() => { if (!hasFavorites && selectedSection === "Favorites") setSectionFilter("Appearance"); }, [hasFavorites, selectedSection]);

  useEffect(() => {
    onStateChange?.({ query, sectionFilter, scrollTop: 0, expandedGroup });
  }, [onStateChange, query, sectionFilter, expandedGroup]);

  const selectTab = (tab: string) => {
    setNavigation(null);
    setSectionFilter(tab);
    setExpandedGroup(undefined);
    setQuery("");
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const key = event.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    const next = key === 'Home' ? 0 : key === 'End' ? tabs.length - 1 : (index + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[next][1]);
    tabRefs.current[next]?.focus();
  };

  const title = searching ? "Results" : TABS.find(([, tab]) => tab === sectionFilter)?.[0] ?? "Settings";
  const descriptions: Record<string, string> = {
    Favorites: "Star settings to keep them here. Availability follows their parent options; hidden settings stay hidden.",
    Appearance: "Fonts, interface style, backgrounds and rendering performance.",
    Background: "Background images, motion artwork and Canvas.",
    Playback: "Timing, seeking and lyric scrolling.",
    "Bug report": "Review configuration and recent extension errors before copying.",
    "TTML Reviewer": "Review a sync as it really is, without your setup getting in the way.",
    "Lyrics Display": "Lyric rendering, text size and animation effects.",
    Effects: "Animation presets and effects, tuned to your preference.",
    Interface: "Choose how Spicy Lyrics fits into Spotify.",
    Sources: "Choose where lyrics come from and set their priority.",
    Experiments: "These features are still being shaped. Toggle one off if you prefer how things worked before.",
    History: "Undo settings or hold a change to compare its previous appearance.",
    Advanced: "Build channels, storage, TTML review, diagnostics and settings history.",
    About: "Spicy Lyrics, based on Spikerko, iPixelGalaxy and Ruytha.",
  };
  const filter = searching || favoritesOnly ? "All" : sectionFilter;
  const groupProps = (group: string) => ({ open: expandedGroup === group, onChange: (open: boolean) => setExpandedGroup(current => open ? group : current === group ? undefined : current) });
  const manageAnimator = () => onManageAnimator?.({ query, sectionFilter, expandedGroup, scrollTop: scrollRef.current?.scrollTop ?? 0 });
  return (
    <div className={`slm sl-sp sl-sp-panel sl-sp-panel--settings sl-sp-design--${design}${favoritesOnly ? " sl-sp-favorites-only" : ""}`}>
      <nav className="sl-sp-sidebar" aria-label="Settings sections">
        <div className="sl-sp-brand">
          <span className="sl-sp-brand-line">Spicy Lyrics</span>
          <h1 className="sl-sp-title">Settings</h1>
        </div>
        <label className="vv-language"><span>Language</span><Select label="Language" value={language} options={["en","ru"]} labels={["English","Русский"]} onChange={value => $uiLanguage.set(value as "en"|"ru")} /></label>
        <SearchBar value={query} onChange={(value) => {
          setNavigation(null); setQuery(value); if (scrollRef.current) scrollRef.current.scrollTop = 0;
        }} />
        <div className="sl-sp-tabs" role="tablist" aria-label="Settings categories" aria-orientation="vertical">
          {tabs.map(([label, tab, icon], index) => <Fragment key={tab}>{tab === "Advanced" && <span className="sl-sp-tabs-divider" aria-hidden="true" />}<button
            ref={(element) => { tabRefs.current[index] = element; }}
            className="sl-sp-tab" data-section={tab} role="tab" type="button" title={label} id={`sl-settings-tab-${index}`}
            aria-controls="sl-settings-content" tabIndex={sectionFilter === tab ? 0 : -1}
            aria-selected={sectionFilter === tab && !searching}
            data-active={sectionFilter === tab && !searching || undefined}
            onClick={() => selectTab(tab)} onKeyDown={(event) => onTabKeyDown(event, index)}>
            <span className="sl-sp-tab-icon" aria-hidden="true">{icon}</span>
            <span className="sl-sp-tab-label">{label}</span>
          </button></Fragment>)}
        </div>
        {allowHidingSettings && <button className={`sl-sp-tab sl-sp-tab--action sl-sp-hide-action${hideHidingIcon ? "" : " sl-sp-tab--active"}`} type="button" aria-pressed={!hideHidingIcon} onClick={() => $hideHidingIcon.set(!hideHidingIcon)}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.5 8s2.3-4 6.5-4 6.5 4 6.5 4-2.3 4-6.5 4-6.5-4-6.5-4Z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4"/><path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>Hide Settings</button>}
        <button className={`sl-sp-tab sl-sp-tab--action sl-sp-hide-action${editFavorites ? " sl-sp-tab--active" : ""}`} type="button" aria-pressed={editFavorites} onClick={() => setEditFavorites(!editFavorites)}><span aria-hidden="true">☆</span>Add to favorites</button>
      </nav>
      <section className="sl-sp-pane">
        <div className="sl-sp-pane-header">
          <h2 className="sl-sp-pane-title">{title}</h2>
          <button className="sl-sp-close" type="button" aria-label="Close settings" onClick={() => PopupModal.hide()}>×</button>
        </div>
        <div className="sl-sp-pane-scroll sl-sp-settings-scroll" ref={scrollRef}>
          <div className="sl-sp-pane-body">
            <p className="sl-sp-intro">{searching ? "Matching settings across all sections." : descriptions[sectionFilter]}</p>
            {favoritesOnly && (!Array.isArray(favorites) || favorites.length === 0) && <p className="sl-sp-empty">No favorite settings yet. Use the stars beside settings.</p>}
            <EditFavoritesContext.Provider value={editFavorites}><FavoriteSettingsContext.Provider value={favoritesOnly}>
            <RevealedSettingContext.Provider value={navigation?.id ?? null}><NavigateSettingContext.Provider value={navigateSetting}><ShowHiddenSettingsInSearchContext.Provider value={searching}>
              <div role="tabpanel" id="sl-settings-content" aria-label={title}>
                {(searching || favoritesOnly || ["Lyrics Display", "Playback"].includes(sectionFilter)) && <div className="sl-sp-card"><UpstreamSettings query={query} sectionFilter={filter} /></div>}
                {(searching || favoritesOnly || sectionFilter === "Appearance") && <div className="sl-sp-card"><AppearanceSection query={query} sectionFilter={filter} /></div>}
                {!searching && !favoritesOnly && sectionFilter === "Appearance" && <SettingsGroup title="Background" {...groupProps("Background")}><UpstreamSettings query="" sectionFilter="Background" /><AppearanceSection query="" sectionFilter="Background" /></SettingsGroup>}
                {(searching || favoritesOnly || ["Lyrics Display", "Playback"].includes(sectionFilter)) && <div className="sl-sp-card"><LyricsSection query={query} sectionFilter={filter} /></div>}
                {(searching || favoritesOnly) && <div className="sl-sp-card"><EffectsSection query={query} sectionFilter="All" onManageAnimator={manageAnimator} /></div>}
                {!searching && !favoritesOnly && sectionFilter === "Lyrics Display" && <SettingsGroup title="Effects" {...groupProps("Effects")}><EffectsSection query="" sectionFilter="Effects" onManageAnimator={manageAnimator} /></SettingsGroup>}
                {(searching || favoritesOnly || sectionFilter === "Interface") && <div className="sl-sp-card"><InterfaceSection query={query} sectionFilter={filter} /></div>}
                {(searching || favoritesOnly || sectionFilter === "Sources") && <div className="sl-sp-card"><SourcesSection query={query} sectionFilter={filter} /></div>}
                {(searching || favoritesOnly || sectionFilter === "Advanced") && <div className="sl-sp-card"><DeveloperSection query={query} sectionFilter={filter} onOpenHiddenSettings={onOpenHiddenSettings ?? (() => {})} /></div>}
                {favoritesOnly && <div className="sl-sp-card"><ExperimentSettings advancedOnly showBuiltIn /></div>}
                {(searching || sectionFilter === "Experiments") && <div className="sl-sp-card"><ExperimentSettings title advancedOnly showBuiltIn query={query} /></div>}
                {!searching && sectionFilter === "About" && <Footer />}
                {!searching && sectionFilter === "Advanced" && <>
                  <SettingsGroup title="TTML Reviewer" {...groupProps("TTML Reviewer")}><ReviewerPane /></SettingsGroup>
                  <SettingsGroup title="Diagnostic report" {...groupProps("Diagnostic report")}><BugReportPane /></SettingsGroup>
                  <SettingsGroup title="Settings history" {...groupProps("Settings history")}><HistoryPanel /></SettingsGroup>
                </>}
                {(searching || favoritesOnly) && <BugReportPane query={query} compact />}
                {searching && matches(query, "Settings history", "Undo settings or hold a change to compare its previous appearance.") && <Row label="Settings history" description="Undo settings or hold a change to compare its previous appearance."><button className="sl-sp-btn" type="button" onClick={() => {selectTab("Advanced");setExpandedGroup("Settings history");}}>Open</button></Row>}
              </div>
            </ShowHiddenSettingsInSearchContext.Provider></NavigateSettingContext.Provider></RevealedSettingContext.Provider>
            </FavoriteSettingsContext.Provider></EditFavoritesContext.Provider>
          </div>
        </div>
      </section>
    </div>
  );
}
