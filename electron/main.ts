import { app, BrowserWindow, Menu, ipcMain } from "electron";
import type { MenuItemConstructorOptions } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { MiraboxStreamDock } from "./streamdock.js";

let mainWindow: BrowserWindow | null = null;
const streamDock = new MiraboxStreamDock();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === "development";

const registerIpcHandlers = () => {
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

  const startUrl = isDev
    ? "http://localhost:5173"
    : `file://${path.join(__dirname, "../dist/index.html")}`;

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
  createWindow();
});

app.on("window-all-closed", () => {
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
