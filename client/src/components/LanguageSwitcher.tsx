import { useLocale, type Lang } from "../i18n";

/** DE/EN-Umschalter; wird im Header und im "Allgemein"-Tab der Einstellungen verwendet. */
export default function LanguageSwitcher() {
  const { lang, setLang, t } = useLocale();
  const langs: Lang[] = ["de", "en"];
  return (
    <div className="lang-switch" role="group" aria-label={t(lang === "de" ? "lang.de" : "lang.en")}>
      {langs.map((l) => (
        <button key={l} className={l === lang ? "active" : ""} onClick={() => setLang(l)} aria-pressed={l === lang}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
