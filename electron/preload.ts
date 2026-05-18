import { contextBridge, ipcRenderer } from "electron";
import type { StreamDockConnectionInfo } from "./streamdock.js";

export type StreamDockApi = {
  connect: () => Promise<StreamDockConnectionInfo>;
  disconnect: () => Promise<void>;
  setBrightness: (value: number) => Promise<void>;
  setKeyImage: (keyId: number, dataUrl: string) => Promise<void>;
  clearKeyImage: (keyId: number) => Promise<void>;
};

const api: StreamDockApi = {
  connect: () => ipcRenderer.invoke("streamdock:connect"),
  disconnect: () => ipcRenderer.invoke("streamdock:disconnect"),
  setBrightness: (value) =>
    ipcRenderer.invoke("streamdock:setBrightness", value),
  setKeyImage: (keyId, dataUrl) =>
    ipcRenderer.invoke("streamdock:setKeyImage", { keyId, dataUrl }),
  clearKeyImage: (keyId) =>
    ipcRenderer.invoke("streamdock:clearKeyImage", keyId),
};

contextBridge.exposeInMainWorld("streamDockApi", api);
