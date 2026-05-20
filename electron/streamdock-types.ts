export type StreamDockConnectionInfo = {
  vendorId: number;
  productId: number;
  packetSize: number;
  keySize: number;
  productName: string;
};

export type StreamDockDevicePresence = {
  isAttached: boolean;
  productName?: string;
};
