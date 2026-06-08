type StreamDockConnectionInfo = {
  vendorId: number;
  productId: number;
  packetSize: number;
  keySize: number;
  sideDisplayKeyCount: number;
  productName: string;
};

type StreamDockDevicePresence = {
  isAttached: boolean;
  productName?: string;
};

type AppSettings = {
  startWithWindows: boolean;
  hideToTray: boolean;
};

import type { StreamDeckKeyAction } from "./streamdeck";

type StreamDockApi = {
  getAppSettings: () => Promise<AppSettings>;
  updateAppSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>;
  onAppSettingsChanged: (listener: (settings: AppSettings) => void) => () => void;
  getDevicePresence: () => Promise<StreamDockDevicePresence>;
  onDevicePresenceChanged: (
    listener: (presence: StreamDockDevicePresence) => void,
  ) => () => void;
  onSessionEnded: (listener: () => void) => () => void;
  connect: () => Promise<StreamDockConnectionInfo>;
  disconnect: () => Promise<void>;
  setBrightness: (value: number) => Promise<void>;
  preprocessKeyImage: (dataUrl: string) => Promise<string>;
  setKeyImage: (
    keyId: number,
    dataUrl: string,
    label?: string,
  ) => Promise<void>;
  clearKeyImage: (keyId: number) => Promise<void>;
  setKeyAction: (keyId: number, action?: StreamDeckKeyAction) => Promise<void>;
  executeKeyAction: (action?: StreamDeckKeyAction) => Promise<void>;
  onPageNavigation: (
    listener: (direction: "previous" | "next") => void,
  ) => () => void;
  onKeyActionError: (listener: (message: string) => void) => () => void;
};

declare global {
  interface Window {
    streamDockApi?: StreamDockApi;
  }
}

export {};
