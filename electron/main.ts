import { app, BrowserWindow, Menu, ipcMain } from "electron";
import type { MenuItemConstructorOptions } from "electron";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { shell } from "electron";
import {
  MiraboxStreamDock,
  detectStreamDockPresence,
} from "./streamdock.js";
import type { StreamDockDevicePresence } from "./streamdock-types.js";

type StreamDeckKeyAction = {
  type: "none" | "open-url" | "launch-app" | "shell-command";
  label?: string;
  url?: string;
  path?: string;
  args?: string;
  workingDirectory?: string;
  command?: string;
};

let mainWindow: BrowserWindow | null = null;
const streamDock = new MiraboxStreamDock();
const keyActions = new Map<number, StreamDeckKeyAction>();
const DEVICE_PRESENCE_POLL_MS = 2000;
let devicePresencePollTimer: NodeJS.Timeout | null = null;
let lastDevicePresence: StreamDockDevicePresence = { isAttached: false };

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

  if (!presence.isAttached && streamDock.isConnected) {
    streamDock.disconnect();
    mainWindow?.webContents.send("streamdock:session-ended");
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const isDev = Boolean(devServerUrl);

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
    async (_event, payload: { keyId: number; dataUrl: string }) => {
      await streamDock.setKeyImageFromDataUrl(payload.keyId, payload.dataUrl);
    },
  );
  ipcMain.handle("streamdock:clearKeyImage", async (_event, keyId: number) => {
    streamDock.clearKeyImage(keyId);
  });
  ipcMain.handle(
    "streamdock:preprocessKeyImage",
    async (_event, sourceDataUrl: string) =>
      streamDock.preprocessKeyImageDataUrl(sourceDataUrl),
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
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
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

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

app.on("ready", () => {
  registerIpcHandlers();
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
  createWindow();
});

app.on("window-all-closed", () => {
  stopDevicePresenceMonitoring();
  streamDock.disconnect();
  if (process.platform !== "darwin") {
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
