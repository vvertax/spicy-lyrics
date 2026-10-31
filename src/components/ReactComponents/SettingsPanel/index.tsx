import { $uiLanguage } from "../../../utils/stores.ts";
import { PopupModal } from "../../Modal.ts";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import { $allowHidingSettings, $hideHidingIcon } from "../../../utils/stores.ts";
import AppearanceSection from "./AppearanceSection.tsx";
import DeveloperSection from "./DeveloperSection.tsx";
import EffectsSection from "./EffectsSection.tsx";
import InterfaceSection from "./InterfaceSection.tsx";
import LyricsSection from "./LyricsSection.tsx";
import SourcesSection from "./SourcesSection.tsx";
import Footer from "./Footer.tsx";
import { SearchBar, ShowHiddenSettingsInSearchContext } from "./components.tsx";
import { AdvancedIcon, AppearanceIcon, ExperimentsIcon, InterfaceIcon, LyricsIcon, SourcesIcon } from "./icons.tsx";

const TABS = [
  ["Appearance", "Appearance", AppearanceIcon],
  ["Lyrics", "Lyrics Display", LyricsIcon],
  ["Effects", "Effects", ExperimentsIcon],
  ["Interface", "Interface", InterfaceIcon],
  ["Sources", "Sources", SourcesIcon],
  ["Advanced", "Advanced", AdvancedIcon],
  ["About", "About", AdvancedIcon],
] as const;

export type SettingsPanelState = { query: string; sectionFilter: string; scrollTop: number };
export default function SettingsPanel({ onOpenHiddenSettings, onManageAnimator, initialState, onStateChange }: { onOpenHiddenSettings?: () => void; onManageAnimator?: (state: SettingsPanelState) => void; initialState?: SettingsPanelState; onStateChange?: (state: SettingsPanelState) => void }) {
  const language = useStore($uiLanguage);
  const [query, setQuery] = useState(initialState?.query ?? "");
  const [sectionFilter, setSectionFilter] = useState<string>(initialState?.sectionFilter ?? "Appearance");
  const allowHidingSettings = useStore($allowHidingSettings);
  const hideHidingIcon = useStore($hideHidingIcon);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const searching = Boolean(query.trim());

  useEffect(() => {
    onStateChange?.({ query, sectionFilter, scrollTop: 0 });
  }, [onStateChange, query, sectionFilter]);

  const selectTab = (tab: string) => {
    setSectionFilter(tab);
    setQuery("");
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const key = event.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    const next = key === 'Home' ? 0 : key === 'End' ? TABS.length - 1 : (index + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1) + TABS.length) % TABS.length;
    selectTab(TABS[next][1]);
    tabRefs.current[next]?.focus();
  };

  const title = searching ? "Results" : TABS.find(([, tab]) => tab === sectionFilter)?.[0] ?? "Settings";
  const descriptions: Record<string, string> = {
    Appearance: "Fonts, backgrounds and performance options.",
    "Lyrics Display": "How the lyrics are drawn, styled and scrolled.",
    Effects: "Animation presets and effects, tuned to your preference.",
    Interface: "Choose how Spicy Lyrics fits into Spotify.",
    Sources: "Choose where lyrics come from and set their priority.",
    Advanced: "Build channels, storage and advanced options.",
    About: "Spicy Lyrics, based on Spikerko, iPixelGalaxy and Ruytha.",
  };
  const filter = searching ? "All" : sectionFilter;
  return (
    <div className="slm sl-sp sl-sp-panel sl-sp-panel--settings">
      <nav className="sl-sp-sidebar" aria-label="Settings sections">
        <div className="sl-sp-brand">
          <span className="sl-sp-brand-line">Spicy Lyrics</span>
          <h1 className="sl-sp-title">Settings</h1>
        </div>
        <label className="vv-language"><span>Language</span><select aria-label="Language" value={language} onChange={event=>$uiLanguage.set(event.currentTarget.value as "en"|"ru")}><option value="en">English</option><option value="ru">Русский</option></select></label>
        <SearchBar value={query} onChange={(value) => {
          setQuery(value); if (scrollRef.current) scrollRef.current.scrollTop = 0;
        }} />
        <div className="sl-sp-tabs" role="tablist" aria-label="Settings categories" aria-orientation="vertical">
          {TABS.map(([label, tab, icon], index) => <button key={tab}
            ref={(element) => { tabRefs.current[index] = element; }}
            className="sl-sp-tab" role="tab" type="button" id={`sl-settings-tab-${index}`}
            aria-controls="sl-settings-content" tabIndex={sectionFilter === tab ? 0 : -1}
            aria-selected={sectionFilter === tab && !searching}
            data-active={sectionFilter === tab && !searching || undefined}
            onClick={() => selectTab(tab)} onKeyDown={(event) => onTabKeyDown(event, index)}>
            <span className="sl-sp-tab-icon" aria-hidden="true">{icon}</span>
            <span className="sl-sp-tab-label">{label}</span>
          </button>)}
        </div>
        {allowHidingSettings && <button className={`sl-sp-tab sl-sp-tab--action sl-sp-hide-action${hideHidingIcon ? "" : " sl-sp-tab--active"}`} type="button" aria-pressed={!hideHidingIcon} onClick={() => $hideHidingIcon.set(!hideHidingIcon)}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.5 8s2.3-4 6.5-4 6.5 4 6.5 4-2.3 4-6.5 4-6.5-4-6.5-4Z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4"/><path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>Hide Settings</button>}
      </nav>
      <section className="sl-sp-pane">
        <div className="sl-sp-pane-header">
          <h2 className="sl-sp-pane-title">{title}</h2>
          <button className="sl-sp-close" type="button" aria-label="Close settings" onClick={() => PopupModal.hide()}>×</button>
        </div>
        <div className="sl-sp-pane-scroll sl-sp-settings-scroll" ref={scrollRef}>
          <div className="sl-sp-pane-body">
            <p className="sl-sp-intro">{searching ? "Matching settings across all sections." : descriptions[sectionFilter]}</p>
            <ShowHiddenSettingsInSearchContext.Provider value={searching}>
              <div role="tabpanel" id="sl-settings-content" aria-label={title}>
                {(searching || sectionFilter === "Appearance") && <div className="sl-sp-card"><AppearanceSection query={query} sectionFilter={filter} /></div>}
                {(searching || sectionFilter === "Lyrics Display") && <div className="sl-sp-card"><LyricsSection query={query} sectionFilter={filter} /></div>}
                {(searching || sectionFilter === "Effects") && <div className="sl-sp-card"><EffectsSection query={query} sectionFilter={filter} onManageAnimator={() => onManageAnimator?.({ query, sectionFilter, scrollTop: scrollRef.current?.scrollTop ?? 0 })} /></div>}
                {(searching || sectionFilter === "Interface") && <div className="sl-sp-card"><InterfaceSection query={query} sectionFilter={filter} /></div>}
                {(searching || sectionFilter === "Sources") && <div className="sl-sp-card"><SourcesSection query={query} sectionFilter={filter} /></div>}
                {(searching || sectionFilter === "Advanced") && <div className="sl-sp-card"><DeveloperSection query={query} sectionFilter={filter} onOpenHiddenSettings={onOpenHiddenSettings ?? (() => {})} /></div>}
                {!searching && sectionFilter === "About" && <Footer />}
              </div>
            </ShowHiddenSettingsInSearchContext.Provider>
          </div>
        </div>
      </section>
    </div>
  );
}
