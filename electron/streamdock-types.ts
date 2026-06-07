export type StreamDockConnectionInfo = {
  vendorId: number;
  productId: number;
  packetSize: number;
  keySize: number;
  sideDisplayKeyCount: number;
  productName: string;
};

export type StreamDockDevicePresence = {
  isAttached: boolean;
  productName?: string;
};
