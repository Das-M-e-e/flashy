import path from "node:path";
import { app, BrowserWindow, Menu, Tray, nativeImage, shell, dialog } from "electron";

interface ServerModule {
  startServer: () => Promise<{ port: number }>;
  stopServer: () => Promise<void>;
}

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let server: ServerModule | null = null;
let serverPort = 0;
let isQuitting = false;

/** Pfad zu einer Ressource -- verpackt liegt sie unter resources/, sonst im Repo. */
function resourcePath(...parts: string[]): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, ...parts)
    : path.join(__dirname, "..", "..", ...parts);
}

/** App-Icon: verpackt unter resources/icon.png, im Dev unter desktop/build. */
function iconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "..", "build", "icon.png");
}

function configureEnv(): void {
  // Daten ins Nutzerprofil -- überlebt App-Updates, App-Paket bleibt schreibgeschützt.
  process.env.DATA_DIR = app.getPath("userData");
  // Freien Port wählen; der Client spricht über relative /api-URLs, Port egal.
  process.env.SERVER_PORT = process.env.SERVER_PORT ?? "0";
  process.env.HOST = "127.0.0.1";
  process.env.CLIENT_DIST = resourcePath("client", "dist");
  process.env.SKILL_DIR = resourcePath("skills");
}

function buildMenu(): Menu {
  const isMac = process.platform === "darwin";
  return Menu.buildFromTemplate([
    {
      label: "Flashy",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        {
          label: "Beenden",
          accelerator: isMac ? "Cmd+Q" : "Ctrl+Q",
          click: () => app.quit(),
        },
      ],
    },
    { role: "editMenu" },
    {
      label: "Ansicht",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ]);
}

function showWindow(): void {
  if (!win) {
    createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 720,
    minHeight: 560,
    show: false,
    backgroundColor: "#0f1118",
    title: "Flashy",
    icon: iconPath(),
    webPreferences: { contextIsolation: true },
  });

  Menu.setApplicationMenu(buildMenu());
  void win.loadURL(`http://127.0.0.1:${serverPort}/`);
  win.once("ready-to-show", () => win?.show());

  // Externe Links (z.B. GitHub) im Standardbrowser öffnen, nicht im App-Fenster.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) {
      void shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  win.on("closed", () => {
    win = null;
  });
}

function createTray(): void {
  const icon = nativeImage.createFromPath(iconPath());
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("Flashy");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Flashy öffnen", click: () => showWindow() },
      { type: "separator" },
      { label: "Beenden", click: () => app.quit() },
    ])
  );
  tray.on("click", () => showWindow());
}

async function bootstrap(): Promise<void> {
  configureEnv();
  try {
    // Server erst NACH dem Setzen der Env-Variablen laden (db.ts liest DATA_DIR beim Import).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    server = require(path.join(__dirname, "server.cjs")) as ServerModule;
    const started = await server.startServer();
    serverPort = started.port;
  } catch (err) {
    dialog.showErrorBox(
      "Flashy konnte nicht starten",
      err instanceof Error ? `${err.message}\n\n${err.stack ?? ""}` : String(err)
    );
    app.quit();
    return;
  }
  createWindow();
  createTray();
}

// Einzelinstanz: zweiter Start fokussiert das bestehende Fenster.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);

  app.whenReady().then(bootstrap);

  // Schließen = Beenden (auch auf macOS).
  app.on("window-all-closed", () => app.quit());

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) showWindow();
  });

  // Vor dem Beenden: Server sauber stoppen und noch synchronisieren.
  app.on("before-quit", (event) => {
    if (isQuitting || !server) return;
    event.preventDefault();
    isQuitting = true;
    void server
      .stopServer()
      .catch(() => undefined)
      .finally(() => app.quit());
  });
}
