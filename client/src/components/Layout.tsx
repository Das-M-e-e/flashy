import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useLocale, type Lang } from "../i18n";
import { useSync } from "../sync";
import { useTheme } from "../theme";
import LlmSettingsDialog from "./LlmSettingsDialog";
import Logo from "./Logo";
import SyncConflictDialog from "./SyncConflictDialog";
import SyncIndicator from "./SyncIndicator";
import SyncSettingsDialog from "./SyncSettingsDialog";

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

function LanguageSwitcher() {
  const { lang, setLang, t } = useLocale();
  const langs: Lang[] = ["de", "en"];
  return (
    <div className="lang-switch" role="group" aria-label={t(lang === "de" ? "lang.de" : "lang.en")}>
      {langs.map((l) => (
        <button
          key={l}
          className={l === lang ? "active" : ""}
          onClick={() => setLang(l)}
          aria-pressed={l === lang}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
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
  const [showSettings, setShowSettings] = useState(false);
  const [showLlm, setShowLlm] = useState(false);
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
            <SyncIndicator onOpen={() => setShowSettings(true)} />
            <LlmButton onOpen={() => setShowLlm(true)} />
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>

      {showSettings && <SyncSettingsDialog onClose={() => setShowSettings(false)} />}
      {showLlm && <LlmSettingsDialog onClose={() => setShowLlm(false)} />}

      {conflict && !dismissedConflict && (
        <SyncConflictDialog conflict={conflict} onClose={() => setDismissedConflict(true)} />
      )}
    </>
  );
}
