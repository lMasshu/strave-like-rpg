import { KeyboardEvent, useRef } from "react";
import { IonIcon } from "@ionic/react";
import { panelId, tabId } from "./profileTabIds";
import "./ProfileTabs.css";

export interface ProfileTab<T extends string> {
  id: T;
  label: string;
  icon: string;
}

export interface ProfileTabsProps<T extends string> {
  tabs: ProfileTab<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  /** Préfixe des identifiants DOM, pour relier chaque onglet à son panneau. */
  idPrefix: string;
  label: string;
}

/** Barre d'onglets accessible (motif ARIA « tabs », navigation aux flèches). */
function ProfileTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  idPrefix,
  label,
}: ProfileTabsProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    buttons.current[next]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    focusTab(moves[event.key]);
  };

  return (
    <div className="sq-profile-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.id)}
            aria-selected={selected}
            aria-controls={panelId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            className={`sq-profile-tab ${selected ? "is-active" : ""}`}
            title={tab.label}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <IonIcon icon={tab.icon} aria-hidden="true" />
            {/* Toujours présent pour les lecteurs d'écran, visible seulement sur l'onglet actif. */}
            <span
              className={`sq-profile-tab-label ${selected ? "" : "sq-visually-hidden"}`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default ProfileTabs;
