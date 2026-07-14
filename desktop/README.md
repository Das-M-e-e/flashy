# Flashy Desktop (Electron)

Verpackt Flashy als eigenständige Desktop-App: eigenes Fenster, Tray-Icon,
sauberes Beenden per Fenster-Schließen (inkl. Sync) – kein Terminal nötig.

Der Express-Server läuft eingebettet im Electron-Hauptprozess (als mit esbuild
gebündelte `dist/server.cjs`), der Client wird über `http://127.0.0.1:<freier
Port>` geladen. Daten liegen im Nutzerprofil (`app.getPath("userData")`), nicht
im App-Paket – sie überstehen Updates.

## Befehle (vom Repo-Root)

- `npm run desktop:start` – App im Dev-Modus starten (baut Client + Bundle,
  öffnet das Fenster).
- `npm run desktop:dist` – Windows-Installer + portable .exe bauen
  (`desktop/release/`).

## Datenübernahme aus der Terminal-Version

Die Desktop-App nutzt ein eigenes Datenverzeichnis. Bestehende Karten holst du
über den GitHub-Sync: in der App unter Sync denselben Token/Repo eintragen wie
bisher, dann wird der Stand übernommen.

## Hinweis zum Installer-Build unter Windows

`electron-builder` lädt das Signing-Tool `winCodeSign`, dessen Archiv macOS-
Symlinks enthält. Deren Extraktion braucht das Recht, Symlinks zu erstellen.
Falls der Build mit „Cannot create symbolic link" abbricht, eine der folgenden
Optionen wählen:

- **Windows-Entwicklermodus aktivieren** (Einstellungen → Für Entwickler →
  Entwicklermodus), oder
- das Terminal **als Administrator** ausführen.

Signiert wird nicht (kein Zertifikat) – das ist für die lokale Nutzung ok;
Windows SmartScreen zeigt beim ersten Start ggf. eine Warnung.
