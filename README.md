# Flashy

Lokal laufende Karteikarten-App mit Projekten, Stapeln, bidirektionalen Karten,
CSV-Import/-Export und einem count-basierten Wiederholungsalgorithmus.

## Kartentypen

Beim Anlegen/Bearbeiten wählst du den Typ; der Editor passt seine Felder an:

- **Einfach (Basic)** – Vorder-/Rückseite, selbst bewertet; optional bidirektional.
- **Text-Antwort** – du tippst die Antwort. Sie wird automatisch abgeglichen (inkl.
  zusätzlich hinterlegter Varianten), die Wertung bleibt aber bei dir: bei knappen
  Treffern gibt es „Trotzdem richtig".
- **Multiple Choice** – Einfach- oder Mehrfachauswahl, automatisch gewertet.
- **Wahr/Falsch** – Aussage gegen die hinterlegte Antwort.
- **Cloze/Lückentext** – Anki-kompatibel mit `{{c1::…}}`; im Editor markierst du Text
  und klickst „Lücke einfügen".

## Markdown & Medien auf den Karten

Alle Textfelder verstehen Markdown: Überschriften, Listen, Betonung, Code-Blöcke,
Tabellen, Links, Bilder und **Audio**. Je Feld gibt es einen Umschalter **Bearbeiten |
Vorschau**.

Medien fügst du per „Bild einfügen" / „Audio einfügen" oder ein Bild aus der
Zwischenablage ein. Sie werden **als eigene Datei** gespeichert (inhaltsadressiert per
Hash), nicht in die Karte eingebettet — das dedupliziert automatisch, hält die Sync-Datei
klein und lädt Medien nur einmal ins Repo hoch. Externe Bild-URLs (`![](https://…)`)
funktionieren weiterhin.

Rohes HTML wird bewusst **nicht** gerendert, sondern als Text angezeigt — so kann eine
importierte Karte kein Skript ausführen.

## Import & Export

Über „Importieren" liest Flashy verschiedene Formate ein (automatisch erkannt): das
eigene Flashy-Format, generisches JSON, Anki-Textexport (inkl. Cloze) sowie einfache
CSV/TSV. „Exportieren" öffnet einen Dialog mit Zielauswahl:

- **Flashy (nativ)** – verlustfrei inkl. Typen, Lernfortschritt und Medien (ZIP).
- **Generisches JSON** – tool-neutral, Medien als ZIP.
- **Anki (Text + Medien)** – in Anki importierbare Datei (Basic + Cloze); Medien im ZIP
  zum Ablegen in Ankis Medienordner.
- **Quizlet** / **Generische CSV** – einfache Paare bzw. Tabelle für andere Apps.

Unter „Erweitert" lassen sich die zu exportierenden **Kartentypen** filtern und – bei
CSV/JSON – zusätzliche **Spalten** wählen (z.B. Confidence, Richtig-/Falsch-Zähler).

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
