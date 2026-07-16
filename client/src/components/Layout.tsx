import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useLocale } from "../i18n";
import { useSync } from "../sync";
import { useTheme } from "../theme";
import LanguageSwitcher from "./LanguageSwitcher";
import Logo from "./Logo";
import SettingsOverlay, { type SettingsTab } from "./SettingsOverlay";
import SyncConflictDialog from "./SyncConflictDialog";
import SyncIndicator from "./SyncIndicator";

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useLocale();
  const isDark = theme === "dark";
  return (
    <button
      className="icon-button"
      onClick={toggle}
      title={isDark ? t("theme.toLight") : t("theme.toDark")}
      aria-label={isDark ? t("theme.toLight") : t("theme.toDark")}
    >
      {isDark ? (
        // Sonne
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      ) : (
        // Mond
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

function SettingsButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useLocale();
  return (
    <button className="icon-button" onClick={onOpen} title={t("settings.open")} aria-label={t("settings.open")}>
      {/* Zahnrad */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );
}

function LlmButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useLocale();
  return (
    <button className="icon-button" onClick={onOpen} title={t("llm.open")} aria-label={t("llm.open")}>
      {/* Funke / KI */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2zM18 14l.9 2.6L21.5 17.5l-2.6.9L18 21l-.9-2.6L14.5 17.5l2.6-.9L18 14z" />
      </svg>
    </button>
  );
}

export default function Layout() {
  const { status } = useSync();
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [dismissedConflict, setDismissedConflict] = useState(false);

  const conflict = status?.state === "conflict" ? status.conflict : null;

  // Ein neu auftretender Konflikt soll das Popup wieder öffnen,
  // auch wenn zuvor "Später" gewählt wurde.
  useEffect(() => {
    if (!conflict) setDismissedConflict(false);
  }, [conflict]);

  return (
    <>
      <header className="appbar">
        <div className="appbar-inner">
          <Link to="/" className="brand">
            <Logo />
            <span className="brand-name">Flashy</span>
          </Link>
          <div className="appbar-controls">
            <SyncIndicator onOpen={() => setSettingsTab("sync")} />
            <LlmButton onOpen={() => setSettingsTab("ai")} />
            <LanguageSwitcher />
            <ThemeToggle />
            <SettingsButton onOpen={() => setSettingsTab("general")} />
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>

      {settingsTab && (
        <SettingsOverlay tab={settingsTab} onTabChange={setSettingsTab} onClose={() => setSettingsTab(null)} />
      )}

      {conflict && !dismissedConflict && (
        <SyncConflictDialog conflict={conflict} onClose={() => setDismissedConflict(true)} />
      )}
    </>
  );
}
