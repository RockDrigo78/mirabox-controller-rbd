import HID from "node-hid";
import sharp from "sharp";

type SupportedDevice = {
  vendorId: number;
  productId: number;
  packetSize: number;
  keySize: number;
  productName: string;
};

type GifFrame = {
  data: Buffer;
  delayMs: number;
};

const SUPPORTED_DEVICES: SupportedDevice[] = [
  {
    vendorId: 0x6602,
    productId: 0x1014,
    packetSize: 1024,
    keySize: 100,
    productName: "Stream Dock HSV 293S",
  },
  {
    vendorId: 0x6603,
    productId: 0x1014,
    packetSize: 1024,
    keySize: 100,
    productName: "Stream Dock HSV 293S",
  },
  {
    vendorId: 0x5548,
    productId: 0x6670,
    packetSize: 512,
    keySize: 85,
    productName: "Stream Dock HSV 293S",
  },
  {
    vendorId: 0x1500,
    productId: 0x3003,
    packetSize: 1024,
    keySize: 96,
    productName: "Stream Dock HSV 293S",
  },
];

const CMD_PREFIX = [0x43, 0x52, 0x54, 0x00, 0x00] as const;

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

async function encodeJpegWithinLimit(
  rgbBuffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  for (let quality = 90; quality >= 20; quality -= 10) {
    const jpeg = await sharp(rgbBuffer, {
      raw: {
        width,
        height,
        channels: 3,
      },
    })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (jpeg.byteLength <= 10240) {
      return jpeg;
    }
  }

  return sharp(rgbBuffer, {
    raw: {
      width,
      height,
      channels: 3,
    },
  })
    .jpeg({ quality: 20, mozjpeg: true })
    .toBuffer();
}

async function buildStaticFrame(
  source: Buffer,
  keySize: number,
): Promise<Buffer> {
  const rgb = await sharp(source, { animated: false })
    .rotate(180)
    .resize(keySize, keySize, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer();

  return encodeJpegWithinLimit(rgb, keySize, keySize);
}

async function buildGifFrames(
  source: Buffer,
  keySize: number,
): Promise<GifFrame[]> {
  const metadata = await sharp(source, { animated: true }).metadata();
  const pages = metadata.pages ?? 1;
  const delays = metadata.delay ?? [];

  const frames: GifFrame[] = [];
  for (let page = 0; page < pages; page += 1) {
    const rgb = await sharp(source, { animated: true, page, pages: 1 })
      .rotate(180)
      .resize(keySize, keySize, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer();

    const jpeg = await encodeJpegWithinLimit(rgb, keySize, keySize);
    frames.push({
      data: jpeg,
      delayMs: Math.max(delays[page] ?? delays[0] ?? 100, 40),
    });
  }

  return frames;
}

export type StreamDockConnectionInfo = {
  vendorId: number;
  productId: number;
  packetSize: number;
  keySize: number;
  productName: string;
};

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
      return this.deviceInfo;
    }

    const found = HID.devices().find((candidate) => {
      return SUPPORTED_DEVICES.some(
        (supported) =>
          candidate.vendorId === supported.vendorId &&
          candidate.productId === supported.productId &&
          Boolean(candidate.path),
      );
    });

    if (!found?.path) {
      throw new Error(
        "No compatible MiraBox Stream Dock found. Close the original software and reconnect the device.",
      );
    }

    const supported = SUPPORTED_DEVICES.find(
      (entry) =>
        entry.vendorId === found.vendorId &&
        entry.productId === found.productId,
    );

    if (!supported) {
      throw new Error("Unsupported MiraBox Stream Dock variant");
    }

    this.device = new HID.HID(found.path);
    this.deviceInfo = supported;

    this.wakeScreen();
    this.setBrightness(100);
    this.startHeartbeat();

    return supported;
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
    const keySize = this.getDeviceInfo().keySize;

    if ((metadata.pages ?? 1) > 1 && metadata.format === "gif") {
      const frames = await buildGifFrames(source, keySize);
      await this.startGifAnimation(keyId, frames);
      return;
    }

    this.stopAnimation(keyId);
    const frame = await buildStaticFrame(source, keySize);
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
    this.getDevice().write([...buffer]);
  }

  private sendSimple(command: number[]): void {
    const packetSize = this.getDeviceInfo().packetSize;
    const body = buildCommand(command);
    const packet = Buffer.alloc(packetSize + 1);

    packet[0] = 0x00;
    Buffer.from(CMD_PREFIX).copy(packet, 1);
    body.copy(packet, 1 + CMD_PREFIX.length);

    this.writeRaw(packet);
  }

  private sendKeyData(data: Buffer): void {
    const packetSize = this.getDeviceInfo().packetSize;

    for (let offset = 0; offset < data.length; offset += packetSize) {
      const packet = Buffer.alloc(packetSize + 1);
      packet[0] = 0x00;
      data.subarray(offset, offset + packetSize).copy(packet, 1);
      this.writeRaw(packet);
    }
  }

  private wakeScreen(): void {
    this.sendSimple([0x44, 0x49, 0x53]);
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
    const row = Math.floor(keyId / 5);
    const column = keyId % 5;

    const outputMap = [
      [0x0d, 0x0a, 0x07, 0x04, 0x01],
      [0x0e, 0x0b, 0x08, 0x05, 0x02],
      [0x0f, 0x0c, 0x09, 0x06, 0x03],
    ];

    const mapped = outputMap[row]?.[column];
    if (!mapped) {
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
