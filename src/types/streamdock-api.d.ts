type StreamDockConnectionInfo = {
  vendorId: number;
  productId: number;
  packetSize: number;
  keySize: number;
  productName: string;
};

import type { StreamDeckKeyAction } from "./streamdeck";

type StreamDockApi = {
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

declare global {
  interface Window {
    streamDockApi?: StreamDockApi;
  }
}

export {};
