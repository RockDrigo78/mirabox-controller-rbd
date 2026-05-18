type StreamDockConnectionInfo = {
  vendorId: number;
  productId: number;
  packetSize: number;
  keySize: number;
  productName: string;
};

type StreamDockApi = {
  connect: () => Promise<StreamDockConnectionInfo>;
  disconnect: () => Promise<void>;
  setBrightness: (value: number) => Promise<void>;
  preprocessKeyImage: (dataUrl: string) => Promise<string>;
  setKeyImage: (keyId: number, dataUrl: string) => Promise<void>;
  clearKeyImage: (keyId: number) => Promise<void>;
};

declare global {
  interface Window {
    streamDockApi?: StreamDockApi;
  }
}

export {};
