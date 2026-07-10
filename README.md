# Flashy

Lokal laufende Karteikarten-App mit Projekten, Stapeln, bidirektionalen Karten,
CSV-Import/-Export und einem count-basierten Wiederholungsalgorithmus.

## Starten

Doppelklick auf **`Flashy starten.cmd`**.

Beim ersten Start werden die Abhängigkeiten installiert und die App gebaut — das
dauert einen Moment. Danach öffnet sich der Browser automatisch auf
<http://localhost:4000>.

Zum Beenden im Konsolenfenster **Strg+C** drücken. Nur so werden noch nicht
hochgeladene Änderungen vorher synchronisiert.

Nach Code-Änderungen einmal `Flashy starten.cmd rebuild` ausführen, um neu zu bauen.

Voraussetzung: [Node.js](https://nodejs.org) (LTS). Fehlt es, sagt der Starter Bescheid.

### Für Entwicklung

```bash
npm install
npm run dev     # Server + Vite mit Hot-Reload (http://localhost:5173)
npm run build
npm start       # gebaute App unter http://localhost:4000
```

Der Server lauscht bewusst nur auf `127.0.0.1`, weil in der lokalen Datenbank ein
GitHub-Token liegen kann. Über `HOST` und `SERVER_PORT` lässt sich das ändern.

## Lernen

Pro Karte und Richtung gilt `Level = max(0, richtig − falsch)`. Die Wahrscheinlichkeit,
dass eine Karte gezogen wird, ist `1 / (Level + 1)` — je sicherer eine Karte sitzt,
desto seltener kommt sie. Es gibt bewusst **keine** Zeitkomponente.

Karten sind einzeln als bidirektional oder einseitig einstellbar. Eine bidirektionale
Karte zählt als zwei Lern-Items mit getrennten Statistiken.

## Sync über ein eigenes GitHub-Repo

Damit gleichen sich mehrere Geräte ab, ohne dass sie gleichzeitig laufen oder im
selben Netz sein müssen. Jeder Push ist ein Commit — du bekommst also nebenbei
eine Versionshistorie und ein Backup.

**Einrichten:**

1. Auf GitHub ein (gern privates) Repo anlegen.
2. Einen Personal Access Token erstellen. Er braucht Schreibrechte auf den
   Repo-Inhalt:
   - klassischer Token mit `repo`-Scope, **oder**
   - fine-grained Token mit *Contents: Read and write*.
3. In Flashy oben rechts auf die Sync-Anzeige klicken, den Token einfügen und
   „Token prüfen & Repos laden" wählen.
4. Das Repo aus dem Dropdown auswählen (Branch wird automatisch vorbelegt), speichern.
5. Auf dem zweiten Gerät dasselbe Repo auswählen.

> Das Dropdown zeigt genau die Repos, auf die der Token Zugriff hat. Ein fine-grained
> Token, der nur für ein Repo freigegeben ist, funktioniert — dann steht eben nur
> dieses eine zur Auswahl.

**Wann synchronisiert wird:** beim Start, im eingestellten Intervall (Standard 5 Minuten),
beim Beenden und jederzeit manuell über „Jetzt synchronisieren".

**Konflikte** (beide Seiten haben sich seit dem letzten gemeinsamen Stand geändert)
werden nie automatisch zusammengeführt. Ein Popup zeigt beide Stände mit Gerätename,
Zeitstempel und Anzahlen, markiert den aktuelleren, und du entscheidest, welcher gilt.

Der Token wird nur lokal in `server/data/flashy.db` gespeichert und nie an den Browser
zurückgegeben.
