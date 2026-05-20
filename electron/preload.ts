import { contextBridge, ipcRenderer } from "electron";
import type {
  StreamDockConnectionInfo,
  StreamDockDevicePresence,
} from "./streamdock-types.js";

type StreamDeckKeyAction = {
  type: "none" | "open-url" | "launch-app" | "shell-command";
  label?: string;
  url?: string;
  path?: string;
  args?: string;
  workingDirectory?: string;
  command?: string;
};

export type StreamDockApi = {
  getDevicePresence: () => Promise<StreamDockDevicePresence>;
  onDevicePresenceChanged: (
    listener: (presence: StreamDockDevicePresence) => void,
  ) => () => void;
  onSessionEnded: (listener: () => void) => () => void;
  connect: () => Promise<StreamDockConnectionInfo>;
  disconnect: () => Promise<void>;
  setBrightness: (value: number) => Promise<void>;
  preprocessKeyImage: (dataUrl: string) => Promise<string>;
  setKeyImage: (keyId: number, dataUrl: string) => Promise<void>;
  clearKeyImage: (keyId: number) => Promise<void>;
  setKeyAction: (keyId: number, action?: StreamDeckKeyAction) => Promise<void>;
  executeKeyAction: (action?: StreamDeckKeyAction) => Promise<void>;
  onKeyActionError: (listener: (message: string) => void) => () => void;
};

const api: StreamDockApi = {
  getDevicePresence: () =>
    ipcRenderer.invoke("streamdock:getDevicePresence"),
  onDevicePresenceChanged: (listener) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      presence: StreamDockDevicePresence,
    ) => {
      listener(presence);
    };
    ipcRenderer.on("streamdock:device-presence-changed", subscription);
    return () => {
      ipcRenderer.off("streamdock:device-presence-changed", subscription);
    };
  },
  onSessionEnded: (listener) => {
    const subscription = () => {
      listener();
    };
    ipcRenderer.on("streamdock:session-ended", subscription);
    return () => {
      ipcRenderer.off("streamdock:session-ended", subscription);
    };
  },
  connect: () => ipcRenderer.invoke("streamdock:connect"),
  disconnect: () => ipcRenderer.invoke("streamdock:disconnect"),
  setBrightness: (value) =>
    ipcRenderer.invoke("streamdock:setBrightness", value),
  preprocessKeyImage: (dataUrl) =>
    ipcRenderer.invoke("streamdock:preprocessKeyImage", dataUrl),
  setKeyImage: (keyId, dataUrl) =>
    ipcRenderer.invoke("streamdock:setKeyImage", { keyId, dataUrl }),
  clearKeyImage: (keyId) =>
    ipcRenderer.invoke("streamdock:clearKeyImage", keyId),
  setKeyAction: (keyId, action) =>
    ipcRenderer.invoke("streamdock:setKeyAction", { keyId, action }),
  executeKeyAction: (action) =>
    ipcRenderer.invoke("streamdock:executeKeyAction", action),
  onKeyActionError: (listener) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      message: string,
    ) => {
      listener(message);
    };
    ipcRenderer.on("streamdock:key-action-error", subscription);
    return () => {
      ipcRenderer.off("streamdock:key-action-error", subscription);
    };
  },
};

contextBridge.exposeInMainWorld("streamDockApi", api);
