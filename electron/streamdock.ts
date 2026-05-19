import HID from "node-hid";
import sharp from "sharp";
import {
  buildGifFrames,
  DEFAULT_KEY_IMAGE_TRANSFORM,
  parseImageDataUrl,
  processKeyImageDataUrl,
  processKeyImageToJpeg,
  type KeyImageTransform,
} from "./key-image.js";

export type { KeyImageTransform };

type SupportedDevice = {
  vendorId: number;
  productId: number;
  commandPacketSize: number;
  imagePacketSize: number;
  productName: string;
  keyImage: KeyImageTransform;
  hardwareKeyIds: readonly number[];
};

const HARDWARE_KEY_IDS_293S = [
  0x0d, 0x0a, 0x07, 0x04, 0x01, 0x0e, 0x0b, 0x08, 0x05, 0x02, 0x0f, 0x0c, 0x09,
  0x06, 0x03,
] as const;

const HARDWARE_KEY_IDS_293V3 = [
  0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x01, 0x02, 0x03,
  0x04, 0x05,
] as const;

type GifFrame = {
  data: Buffer;
  delayMs: number;
};

const SUPPORTED_DEVICES: SupportedDevice[] = [
  {
    vendorId: 0x5548,
    productId: 0x6670,
    commandPacketSize: 512,
    imagePacketSize: 512,
    productName: "Stream Dock 293S",
    keyImage: { keySize: 96, rotation: 90 },
    hardwareKeyIds: HARDWARE_KEY_IDS_293S,
  },
  {
    vendorId: 0x6603,
    productId: 0x1014,
    commandPacketSize: 512,
    imagePacketSize: 1024,
    productName: "Stream Dock 293S V3",
    keyImage: { keySize: 96, rotation: 90 },
    hardwareKeyIds: HARDWARE_KEY_IDS_293S,
  },
  {
    vendorId: 0x6602,
    productId: 0x1014,
    commandPacketSize: 512,
    imagePacketSize: 1024,
    productName: "Stream Dock 293S V3",
    keyImage: { keySize: 96, rotation: 90 },
    hardwareKeyIds: HARDWARE_KEY_IDS_293S,
  },
  {
    vendorId: 0x6603,
    productId: 0x1005,
    commandPacketSize: 512,
    imagePacketSize: 1024,
    productName: "Stream Dock 293 V3",
    keyImage: { keySize: 112, rotation: 180 },
    hardwareKeyIds: HARDWARE_KEY_IDS_293V3,
  },
  {
    vendorId: 0x6603,
    productId: 0x1006,
    commandPacketSize: 512,
    imagePacketSize: 1024,
    productName: "Stream Dock 293 V3",
    keyImage: { keySize: 112, rotation: 180 },
    hardwareKeyIds: HARDWARE_KEY_IDS_293V3,
  },
  {
    vendorId: 0x6602,
    productId: 0x1001,
    commandPacketSize: 512,
    imagePacketSize: 512,
    productName: "Stream Dock 293",
    keyImage: { keySize: 100, rotation: 180 },
    hardwareKeyIds: HARDWARE_KEY_IDS_293S,
  },
];

const CMD_PREFIX = [0x43, 0x52, 0x54, 0x00, 0x00] as const;

const isSupportedStreamDock = (candidate: HID.Device): boolean =>
  SUPPORTED_DEVICES.some(
    (supported) =>
      candidate.vendorId === supported.vendorId &&
      candidate.productId === supported.productId &&
      Boolean(candidate.path),
  );

const VENDOR_USAGE_PAGE = 0xff90;

const isControlHidInterface = (candidate: HID.Device): boolean => {
  const devicePath = candidate.path?.toUpperCase() ?? "";
  return !devicePath.includes("KBD") && !devicePath.includes("MI_01");
};

const rankStreamDockCandidate = (candidate: HID.Device): number => {
  let score = 0;
  if (candidate.usagePage === VENDOR_USAGE_PAGE) {
    score += 4;
  }
  if (isControlHidInterface(candidate)) {
    score += 2;
  }
  if (candidate.path?.includes("MI_00")) {
    score += 1;
  }
  return score;
};

const listStreamDockCandidates = (
  vendorId: number,
  productId: number,
): HID.Device[] =>
  HID.devices()
    .filter(
      (candidate) =>
        candidate.vendorId === vendorId &&
        candidate.productId === productId &&
        Boolean(candidate.path),
    )
    .sort(
      (left, right) =>
        rankStreamDockCandidate(right) - rankStreamDockCandidate(left),
    );

const buildWakePacket = (commandPacketSize: number): number[] => {
  const packet = Buffer.alloc(commandPacketSize + 1);
  packet[0] = 0x00;
  packet[1] = 0x43;
  packet[2] = 0x52;
  packet[3] = 0x54;
  packet[4] = 0x00;
  packet[5] = 0x00;
  packet[6] = 0x44;
  packet[7] = 0x49;
  packet[8] = 0x53;
  return [...packet];
};

const verifyDeviceWrites = (
  handle: HID.HID,
  commandPacketSize: number,
): void => {
  handle.write(buildWakePacket(commandPacketSize));
};

const openStreamDockHandle = (
  device: SupportedDevice,
  candidate: HID.Device,
): HID.HID => {
  if (!candidate.path) {
    throw new Error("HID path missing for Stream Dock interface");
  }

  const openAttempts: Array<() => HID.HID> = [
    () => new HID.HID(candidate.path!, { nonExclusive: true }),
    () => new HID.HID(candidate.path!),
    () =>
      new HID.HID(device.vendorId, device.productId, { nonExclusive: true }),
    () => new HID.HID(device.vendorId, device.productId),
  ];

  let lastError: unknown;

  for (const openAttempt of openAttempts) {
    let handle: HID.HID | null = null;
    try {
      handle = openAttempt();
      verifyDeviceWrites(handle, device.commandPacketSize);
      return handle;
    } catch (error) {
      lastError = error;
      if (handle) {
        try {
          handle.close();
        } catch {
          // Ignore cleanup errors between attempts.
        }
      }
    }
  }

  const errorMessage =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Could not communicate with the Stream Dock (${errorMessage}). Quit the official MiraBox app, unplug the device for 5 seconds, plug it back in, then try again.`,
  );
};

function buildCommand(command: number[]): Buffer {
  return Buffer.from(command);
}

function clampBrightness(percent: number): number {
  const clamped = Math.max(Math.min(percent, 100), 0);
  return Math.round(Math.pow(clamped / 100, 0.75) * 100);
}

import type { StreamDockConnectionInfo } from "./streamdock-types.js";

export type { StreamDockConnectionInfo };

type KeyStateListener = (payload: {
  keyId: number;
  isPressed: boolean;
}) => void;

const toConnectionInfo = (
  device: SupportedDevice,
): StreamDockConnectionInfo => ({
  vendorId: device.vendorId,
  productId: device.productId,
  packetSize: device.imagePacketSize,
  keySize: device.keyImage.keySize,
  productName: device.productName,
});

export class MiraboxStreamDock {
  private device: HID.HID | null = null;
  private deviceInfo: SupportedDevice | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private animationTimers = new Map<number, NodeJS.Timeout>();
  private keyStateListener: KeyStateListener | null = null;
  private readonly handleDeviceData = (data: Buffer) => {
    const keyId = this.decodeKeyId(data);
    if (keyId === null) {
      return;
    }

    this.keyStateListener?.({ keyId, isPressed: data[10] === 1 });
  };
  private readonly handleDeviceError = () => {
    this.disconnect();
  };

  get isConnected(): boolean {
    return this.device !== null;
  }

  connect(): StreamDockConnectionInfo {
    if (this.device && this.deviceInfo) {
      return toConnectionInfo(this.deviceInfo);
    }

    const discoveredDevice = HID.devices().find(isSupportedStreamDock);
    if (!discoveredDevice) {
      throw new Error(
        "No compatible MiraBox Stream Dock found. Close the original software and reconnect the device.",
      );
    }

    const supported = SUPPORTED_DEVICES.find(
      (entry) =>
        entry.vendorId === discoveredDevice.vendorId &&
        entry.productId === discoveredDevice.productId,
    );

    if (!supported) {
      throw new Error("Unsupported MiraBox Stream Dock variant");
    }

    const candidates = listStreamDockCandidates(
      supported.vendorId,
      supported.productId,
    );

    if (candidates.length === 0) {
      throw new Error(
        "No compatible MiraBox Stream Dock found. Close the original software and reconnect the device.",
      );
    }

    let lastError: unknown;

    for (const candidate of candidates) {
      try {
        this.device = openStreamDockHandle(supported, candidate);
        this.deviceInfo = supported;
        this.device.on("data", this.handleDeviceData);
        this.device.on("error", this.handleDeviceError);
        this.setBrightness(100);
        this.startHeartbeat();
        return toConnectionInfo(supported);
      } catch (error) {
        lastError = error;
        this.disconnect();
      }
    }

    const errorMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(errorMessage);
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.clearAnimations();

    if (this.device) {
      this.device.off("data", this.handleDeviceData);
      this.device.off("error", this.handleDeviceError);
      this.device.close();
      this.device = null;
    }

    this.deviceInfo = null;
  }

  setBrightness(percent: number): void {
    this.sendSimple([0x4c, 0x49, 0x47, 0x00, 0x00, clampBrightness(percent)]);
  }

  setKeyStateListener(listener: KeyStateListener | null): void {
    this.keyStateListener = listener;
  }

  clearKeyImage(keyId: number): void {
    this.assertKeyId(keyId);
    this.stopAnimation(keyId);
    // Clear uses logical key indices (1–15), not the hardware IDs used for image upload.
    const logicalKeyIndex = keyId + 1;
    this.sendSimple([0x43, 0x4c, 0x45, 0x00, 0x00, 0x00, logicalKeyIndex]);
    this.refresh();
  }

  getKeyImageTransform(): KeyImageTransform {
    return this.deviceInfo?.keyImage ?? DEFAULT_KEY_IMAGE_TRANSFORM;
  }

  async preprocessKeyImageDataUrl(sourceDataUrl: string): Promise<string> {
    return processKeyImageDataUrl(sourceDataUrl, this.getKeyImageTransform());
  }

  async setKeyImageFromDataUrl(keyId: number, payload: string): Promise<void> {
    this.assertKeyId(keyId);
    const source = parseImageDataUrl(payload);
    const metadata = await sharp(source, { animated: true }).metadata();
    const keyImage = this.getKeyImageTransform();

    if ((metadata.pages ?? 1) > 1 && metadata.format === "gif") {
      const frames = await buildGifFrames(source, keyImage);
      await this.startGifAnimation(keyId, frames);
      return;
    }

    this.stopAnimation(keyId);

    const frame = await processKeyImageToJpeg(source, keyImage);
    await this.sendKeyFrame(keyId, frame);
  }

  private getDeviceInfo(): SupportedDevice {
    if (!this.deviceInfo) {
      throw new Error("Stream Dock not connected");
    }

    return this.deviceInfo;
  }

  private getDevice(): HID.HID {
    if (!this.device) {
      throw new Error("Stream Dock not connected");
    }

    return this.device;
  }

  private writeRaw(buffer: Buffer): void {
    // node-hid on Windows expects a numeric report array, not a raw Buffer.
    this.getDevice().write([...buffer]);
  }

  private sendSimple(command: number[]): void {
    const commandPacketSize = this.getDeviceInfo().commandPacketSize;
    const body = buildCommand(command);
    const packet = Buffer.alloc(commandPacketSize + 1);

    packet[0] = 0x00;
    Buffer.from(CMD_PREFIX).copy(packet, 1);
    body.copy(packet, 1 + CMD_PREFIX.length);

    this.writeRaw(packet);
  }

  private sendKeyData(data: Buffer): void {
    const imagePacketSize = this.getDeviceInfo().imagePacketSize;

    for (let offset = 0; offset < data.length; offset += imagePacketSize) {
      const packet = Buffer.alloc(imagePacketSize + 1);
      packet[0] = 0x00;
      data.subarray(offset, offset + imagePacketSize).copy(packet, 1);
      this.writeRaw(packet);
    }
  }

  private refresh(): void {
    this.sendSimple([0x53, 0x54, 0x50]);
  }

  private async sendKeyFrame(keyId: number, jpeg: Buffer): Promise<void> {
    const mappedKeyId = this.mapKeyId(keyId);
    const size = jpeg.byteLength;

    this.sendSimple([
      0x42,
      0x41,
      0x54,
      (size >> 24) & 0xff,
      (size >> 16) & 0xff,
      (size >> 8) & 0xff,
      size & 0xff,
      mappedKeyId,
    ]);
    this.sendKeyData(jpeg);
    this.refresh();
  }

  private async startGifAnimation(
    keyId: number,
    frames: GifFrame[],
  ): Promise<void> {
    this.stopAnimation(keyId);

    if (frames.length === 0) {
      return;
    }

    let frameIndex = 0;

    const loop = async () => {
      if (!this.animationTimers.has(keyId)) {
        return;
      }

      const frame = frames[frameIndex];
      await this.sendKeyFrame(keyId, frame.data);
      frameIndex = (frameIndex + 1) % frames.length;

      const timer = setTimeout(() => {
        void loop();
      }, frame.delayMs);

      this.animationTimers.set(keyId, timer);
    };

    this.animationTimers.set(
      keyId,
      setTimeout(() => void loop(), 0),
    );
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      try {
        this.sendSimple([0x43, 0x4f, 0x4e, 0x4e, 0x45, 0x43, 0x54]);
      } catch {
        this.stopHeartbeat();
      }
    }, 8000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private stopAnimation(keyId: number): void {
    const timer = this.animationTimers.get(keyId);
    if (timer) {
      clearTimeout(timer);
      this.animationTimers.delete(keyId);
    }
  }

  private clearAnimations(): void {
    for (const timer of this.animationTimers.values()) {
      clearTimeout(timer);
    }
    this.animationTimers.clear();
  }

  private mapKeyId(keyId: number): number {
    const mapped = this.getDeviceInfo().hardwareKeyIds[keyId];
    if (mapped === undefined) {
      throw new Error(`Invalid key index ${keyId}`);
    }

    return mapped;
  }

  private assertKeyId(keyId: number): void {
    if (!Number.isInteger(keyId) || keyId < 0 || keyId > 14) {
      throw new Error("Key index must be between 0 and 14");
    }
  }

  private decodeKeyId(data: Buffer): number | null {
    if (!this.deviceInfo || data.length < 11) {
      return null;
    }

    return this.deviceInfo.hardwareKeyIds.indexOf(data[9]) ?? null;
  }
}
