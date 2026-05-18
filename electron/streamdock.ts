import HID from "node-hid";
import sharp from "sharp";

type KeyImageTransform = {
  keySize: number;
  rotation: 0 | 90 | 180 | 270;
};

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
  0x0d, 0x0a, 0x07, 0x04, 0x01, 0x0e, 0x0b, 0x08, 0x05, 0x02, 0x0f, 0x0c,
  0x09, 0x06, 0x03,
] as const;

const HARDWARE_KEY_IDS_293V3 = [
  0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x01, 0x02,
  0x03, 0x04, 0x05,
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
    () => new HID.HID(device.vendorId, device.productId, { nonExclusive: true }),
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

function parseDataUrl(input: string): Buffer {
  if (!input.startsWith("data:")) {
    return Buffer.from(input, "base64");
  }

  const commaIndex = input.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Invalid image payload");
  }

  return Buffer.from(input.slice(commaIndex + 1), "base64");
}

const MAX_KEY_JPEG_BYTES = 10240;

const toSharpRotationAngle = (
  rotation: KeyImageTransform["rotation"],
): number => {
  // Mirabox Python SDK uses PIL angles (counter-clockwise); sharp is clockwise.
  if (rotation === 90) {
    return -90;
  }
  if (rotation === 270) {
    return 90;
  }
  return rotation;
};

const prepareNativeKeyPipeline = (
  pipeline: sharp.Sharp,
  keyImage: KeyImageTransform,
): sharp.Sharp => {
  const { keySize, rotation } = keyImage;
  let prepared = pipeline;

  if (rotation !== 0) {
    prepared = prepared.rotate(toSharpRotationAngle(rotation), {
      background: { r: 0, g: 0, b: 0 },
    });
  }

  return prepared.resize(keySize, keySize, {
    fit: "fill",
    background: { r: 0, g: 0, b: 0 },
  });
};

async function encodePreparedPipeline(pipeline: sharp.Sharp): Promise<Buffer> {
  for (let quality = 100; quality >= 20; quality -= 10) {
    const jpeg = await pipeline
      .clone()
      .jpeg({ quality, chromaSubsampling: "4:4:4" })
      .toBuffer();

    if (jpeg.byteLength <= MAX_KEY_JPEG_BYTES) {
      return jpeg;
    }
  }

  return pipeline
    .jpeg({ quality: 20, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

async function buildStaticFrame(
  source: Buffer,
  keyImage: KeyImageTransform,
): Promise<Buffer> {
  const prepared = prepareNativeKeyPipeline(
    sharp(source, { animated: false }),
    keyImage,
  );

  return encodePreparedPipeline(prepared);
}

async function buildGifFrames(
  source: Buffer,
  keyImage: KeyImageTransform,
): Promise<GifFrame[]> {
  const metadata = await sharp(source, { animated: true }).metadata();
  const pages = metadata.pages ?? 1;
  const delays = metadata.delay ?? [];

  const frames: GifFrame[] = [];
  for (let page = 0; page < pages; page += 1) {
    const prepared = prepareNativeKeyPipeline(
      sharp(source, { animated: true, page, pages: 1 }),
      keyImage,
    );
    const jpeg = await encodePreparedPipeline(prepared);
    frames.push({
      data: jpeg,
      delayMs: Math.max(delays[page] ?? delays[0] ?? 100, 40),
    });
  }

  return frames;
}

import type { StreamDockConnectionInfo } from "./streamdock-types.js";

export type { StreamDockConnectionInfo };

const toConnectionInfo = (device: SupportedDevice): StreamDockConnectionInfo => ({
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
      this.device.close();
      this.device = null;
    }

    this.deviceInfo = null;
  }

  setBrightness(percent: number): void {
    this.sendSimple([0x4c, 0x49, 0x47, 0x00, 0x00, clampBrightness(percent)]);
  }

  clearKeyImage(keyId: number): void {
    this.assertKeyId(keyId);
    this.stopAnimation(keyId);
    this.sendSimple([0x43, 0x4c, 0x45, 0x00, 0x00, 0x00, this.mapKeyId(keyId)]);
  }

  async setKeyImageFromDataUrl(keyId: number, payload: string): Promise<void> {
    this.assertKeyId(keyId);
    const source = parseDataUrl(payload);
    const metadata = await sharp(source, { animated: true }).metadata();
    const keyImage = this.getDeviceInfo().keyImage;

    if ((metadata.pages ?? 1) > 1 && metadata.format === "gif") {
      const frames = await buildGifFrames(source, keyImage);
      await this.startGifAnimation(keyId, frames);
      return;
    }

    this.stopAnimation(keyId);
    const frame = await buildStaticFrame(source, keyImage);
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
}
