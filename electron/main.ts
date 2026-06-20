import { app, BrowserWindow, Menu, Tray, ipcMain, powerMonitor } from "electron";
import type { MenuItemConstructorOptions } from "electron";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { shell } from "electron";
import {
  MiraboxStreamDock,
  detectStreamDockPresence,
} from "./streamdock.js";
import type {
  AppSettings,
  StreamDockDevicePresence,
} from "./streamdock-types.js";

type StreamDeckKeyAction = {
  type:
    | "none"
    | "open-url"
    | "launch-app"
    | "shell-command"
    | "previous-page"
    | "next-page";
  label?: string;
  url?: string;
  path?: string;
  args?: string;
  workingDirectory?: string;
  command?: string;
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  startWithWindows: false,
  hideToTray: false,
};

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let appSettings: AppSettings = DEFAULT_APP_SETTINGS;
let isQuitting = false;
const streamDock = new MiraboxStreamDock();
const keyActions = new Map<number, StreamDeckKeyAction>();
const DEVICE_PRESENCE_POLL_MS = 2000;
const SYSTEM_RESUME_RECONNECT_DELAY_MS = 1000;
let devicePresencePollTimer: NodeJS.Timeout | null = null;
let lastDevicePresence: StreamDockDevicePresence = { isAttached: false };
let systemResumeReconnectTimer: NodeJS.Timeout | null = null;

const presenceSignature = (presence: StreamDockDevicePresence): string =>
  `${presence.isAttached}:${presence.productName ?? ""}`;

const broadcastDevicePresence = () => {
  const presence = detectStreamDockPresence();
  if (presenceSignature(presence) !== presenceSignature(lastDevicePresence)) {
    lastDevicePresence = presence;
    mainWindow?.webContents.send(
      "streamdock:device-presence-changed",
      presence,
    );
  }
};

const startDevicePresenceMonitoring = () => {
  if (devicePresencePollTimer) {
    return;
  }

  broadcastDevicePresence();
  devicePresencePollTimer = setInterval(
    broadcastDevicePresence,
    DEVICE_PRESENCE_POLL_MS,
  );
};

const stopDevicePresenceMonitoring = () => {
  if (!devicePresencePollTimer) {
    return;
  }

  clearInterval(devicePresencePollTimer);
  devicePresencePollTimer = null;
};

const clearSystemResumeReconnectTimer = () => {
  if (!systemResumeReconnectTimer) {
    return;
  }

  clearTimeout(systemResumeReconnectTimer);
  systemResumeReconnectTimer = null;
};

const reconnectStreamDockAfterSystemResume = () => {
  if (!streamDock.isConnected) {
    return;
  }

  clearSystemResumeReconnectTimer();
  systemResumeReconnectTimer = setTimeout(() => {
    systemResumeReconnectTimer = null;

    if (!streamDock.isConnected) {
      return;
    }

    try {
      streamDock.reconnect();
      mainWindow?.webContents.send("streamdock:connection-restored");
    } catch (error) {
      console.error("Failed to reconnect MiraBox after system resume", error);
      streamDock.disconnect();
      mainWindow?.webContents.send("streamdock:session-ended");
    }
  }, SYSTEM_RESUME_RECONNECT_DELAY_MS);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const isDev = Boolean(devServerUrl);
const appIconPath = isDev
  ? path.join(__dirname, "../../public/assets/Controller-logo-01.png")
  : path.join(__dirname, "../assets/Controller-logo-01.png");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeAppSettings = (value: unknown): AppSettings => {
  if (!isRecord(value)) {
    return DEFAULT_APP_SETTINGS;
  }

  return {
    startWithWindows:
      typeof value.startWithWindows === "boolean"
        ? value.startWithWindows
        : DEFAULT_APP_SETTINGS.startWithWindows,
    hideToTray:
      typeof value.hideToTray === "boolean"
        ? value.hideToTray
        : DEFAULT_APP_SETTINGS.hideToTray,
  };
};

const getAppSettingsPath = (): string =>
  path.join(app.getPath("userData"), "settings.json");

const readAppSettings = (): AppSettings => {
  try {
    const rawSettings = fs.readFileSync(getAppSettingsPath(), "utf8");
    const parsedSettings = JSON.parse(rawSettings) as unknown;
    return normalizeAppSettings(parsedSettings);
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
};

const writeAppSettings = (settings: AppSettings) => {
  const settingsPath = getAppSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
};

const applyLoginItemSettings = (settings: AppSettings) => {
  if (process.platform !== "win32") {
    return;
  }

  app.setLoginItemSettings({
    openAtLogin: settings.startWithWindows,
    args: settings.hideToTray ? ["--hidden"] : [],
  });
};

const showMainWindow = () => {
  if (mainWindow === null) {
    createWindow();
    return;
  }

  mainWindow.show();
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
};

const hideMainWindow = () => {
  mainWindow?.hide();
};

const updateTrayMenu = () => {
  if (!tray) {
    return;
  }

  const trayMenu = Menu.buildFromTemplate([
    {
      label: "Show MiraBox Controller",
      click: showMainWindow,
    },
    {
      label: "Hide to Tray",
      click: hideMainWindow,
      enabled: mainWindow !== null && mainWindow.isVisible(),
    },
    { type: "separator" },
    {
      label: "Start with Windows",
      type: "checkbox",
      checked: appSettings.startWithWindows,
      click: () => {
        updateAppSettings({
          startWithWindows: !appSettings.startWithWindows,
        });
      },
    },
    {
      label: "Keep Running in Tray When Closed",
      type: "checkbox",
      checked: appSettings.hideToTray,
      click: () => {
        updateAppSettings({
          hideToTray: !appSettings.hideToTray,
        });
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(trayMenu);
};

const createTray = () => {
  if (tray) {
    return;
  }

  tray = new Tray(appIconPath);
  tray.setToolTip("MiraBox Controller");
  tray.on("double-click", showMainWindow);
  updateTrayMenu();
};

const updateAppSettings = (updates: Partial<AppSettings>): AppSettings => {
  appSettings = normalizeAppSettings({
    ...appSettings,
    ...updates,
  });
  writeAppSettings(appSettings);
  applyLoginItemSettings(appSettings);
  updateTrayMenu();
  mainWindow?.webContents.send("app-settings:changed", appSettings);
  return appSettings;
};

const splitArguments = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }

  const matches = value.match(/"([^"]*)"|'([^']*)'|[^\s]+/g) ?? [];
  return matches.map((match) => match.replace(/^['"]|['"]$/g, ""));
};

const executeKeyAction = async (action: StreamDeckKeyAction | undefined) => {
  if (!action || action.type === "none") {
    return;
  }

  if (action.type === "previous-page") {
    mainWindow?.webContents.send("streamdock:page-navigation", "previous");
    return;
  }

  if (action.type === "next-page") {
    mainWindow?.webContents.send("streamdock:page-navigation", "next");
    return;
  }

  if (action.type === "open-url") {
    if (!action.url) {
      throw new Error("The URL action requires a URL.");
    }

    await shell.openExternal(action.url);
    return;
  }

  if (action.type === "launch-app") {
    if (!action.path) {
      throw new Error("The app action requires an executable path.");
    }

    const child = spawn(action.path, splitArguments(action.args), {
      cwd: action.workingDirectory || path.dirname(action.path),
      detached: true,
      shell: false,
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();
    return;
  }

  if (!action.command) {
    throw new Error("The shell action requires a command.");
  }

  const shellName = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
  const shellArgs =
    process.platform === "win32"
      ? ["/c", action.command]
      : ["-lc", action.command];

  const child = spawn(shellName, shellArgs, {
    cwd: action.workingDirectory || app.getPath("home"),
    detached: true,
    shell: false,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
};

const registerIpcHandlers = () => {
  ipcMain.handle("app-settings:get", async () => appSettings);
  ipcMain.handle(
    "app-settings:update",
    async (_event, updates: Partial<AppSettings>) => updateAppSettings(updates),
  );
  ipcMain.handle("streamdock:getDevicePresence", async () =>
    detectStreamDockPresence(),
  );
  ipcMain.handle("streamdock:connect", async () => streamDock.connect());
  ipcMain.handle("streamdock:disconnect", async () => {
    streamDock.disconnect();
  });
  ipcMain.handle("streamdock:setBrightness", async (_event, value: number) => {
    streamDock.setBrightness(value);
  });
  ipcMain.handle(
    "streamdock:setKeyImage",
    async (
      _event,
      payload: { keyId: number; dataUrl: string; label?: string },
    ) => {
      await streamDock.setKeyImageFromDataUrl(
        payload.keyId,
        payload.dataUrl,
        payload.label,
      );
    },
  );
  ipcMain.handle(
    "streamdock:preprocessKeyImage",
    async (_event, sourceDataUrl: string) =>
      streamDock.preprocessKeyImageDataUrl(sourceDataUrl),
  );
  ipcMain.handle(
    "streamdock:clearKeyImage",
    async (_event, keyId: number) => streamDock.clearKeyImage(keyId),
  );
  ipcMain.handle(
    "streamdock:setKeyAction",
    async (
      _event,
      payload: { keyId: number; action?: StreamDeckKeyAction },
    ) => {
      if (payload.action && payload.action.type !== "none") {
        keyActions.set(payload.keyId, payload.action);
        return;
      }

      keyActions.delete(payload.keyId);
    },
  );
  ipcMain.handle(
    "streamdock:executeKeyAction",
    async (_event, action?: StreamDeckKeyAction) => executeKeyAction(action),
  );
};

const createWindow = () => {
  const shouldStartHidden =
    appSettings.hideToTray && process.argv.includes("--hidden");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: !shouldStartHidden,
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  const startUrl =
    isDev && devServerUrl
      ? devServerUrl
      : `file://${path.join(__dirname, "../index.html")}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("show", updateTrayMenu);
  mainWindow.on("hide", updateTrayMenu);
  mainWindow.on("minimize", updateTrayMenu);
  mainWindow.on("restore", updateTrayMenu);
  mainWindow.on("close", (event) => {
    if (!appSettings.hideToTray || isQuitting) {
      return;
    }

    event.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    updateTrayMenu();
  });
};

app.on("ready", () => {
  appSettings = readAppSettings();
  applyLoginItemSettings(appSettings);
  registerIpcHandlers();
  createTray();
  startDevicePresenceMonitoring();
  streamDock.setSessionLostListener(() => {
    mainWindow?.webContents.send("streamdock:session-ended");
  });
  streamDock.setKeyStateListener(({ keyId, isPressed }) => {
    if (!isPressed) {
      return;
    }

    void executeKeyAction(keyActions.get(keyId)).catch((error: unknown) => {
      console.error(`Failed to execute key ${keyId + 1} action`, error);
      mainWindow?.webContents.send(
        "streamdock:key-action-error",
        error instanceof Error ? error.message : String(error),
      );
    });
  });
  powerMonitor.on("resume", reconnectStreamDockAfterSystemResume);
  createWindow();
});

app.on("before-quit", () => {
  isQuitting = true;
  clearSystemResumeReconnectTimer();
  stopDevicePresenceMonitoring();
  streamDock.disconnect();
});

app.on("window-all-closed", () => {
  if (appSettings.hideToTray && !isQuitting) {
    return;
  }

  if (process.platform !== "darwin" || isQuitting) {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Create application menu
const template: MenuItemConstructorOptions[] = [
  {
    label: "File",
    submenu: [
      {
        label: "Exit",
        accelerator: "CmdOrCtrl+Q",
        click: () => {
          app.quit();
        },
      },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
    ],
  },
  {
    label: "View",
    submenu: [
      {
        label: "Reload",
        accelerator: "CmdOrCtrl+R",
        click: () => {
          mainWindow?.webContents.reload();
        },
      },
      {
        label: "Toggle Developer Tools",
        accelerator: "CmdOrCtrl+Shift+I",
        click: () => {
          mainWindow?.webContents.toggleDevTools();
        },
      },
    ],
  },
];

Menu.setApplicationMenu(Menu.buildFromTemplate(template));
