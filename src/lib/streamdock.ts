import HID from "node-hid";
import sharp from "sharp";

export class StreamDock {
  private dev: HID.HID | null = null;

  private readonly VID = 0x6603;
  private readonly PID = 0x1014;

  async connect(): Promise<void> {
    const devices = HID.devices();
    const info = devices.find(
      (d) => d.vendorId === this.VID && d.productId === this.PID,
    );
    if (!info || !info.path) {
      throw new Error("Dispositivo StreamDock / MiraBox no encontrado");
    }
    this.dev = new HID.HID(info.path);
  }

  private sendRaw(data: Buffer): void {
    if (!this.dev) throw new Error("Dispositivo no conectado");
    const report = Buffer.concat([Buffer.from([0x00]), data]);
    this.dev.write([...report]);
  }

  // Aquí es donde pegas la lógica del protocolo del repo TypeScript que tengas.
  // Por ahora dejo implementaciones mínimas / placeholder.

  async setKeyImage(keyId: number, filePath: string): Promise<void> {
    if (keyId < 0 || keyId > 14) throw new Error("keyId fuera de rango");

    const img = await sharp(filePath)
      .resize(80, 80) // ajusta al tamaño real de tecla si es distinto
      .raw()
      .toBuffer();

    // TODO: reemplazar por la implementación real del protocolo
    // usando el código del repo TS (por ejemplo mirabox-streamdock-node).
    // Esto es solo un placeholder para que el proyecto compile.
    const packet = Buffer.alloc(1024);
    packet[0] = 0xaa;
    packet[1] = 0x55;
    packet[2] = keyId;

    img.copy(packet, 16, 0, Math.min(img.length, packet.length - 16));

    this.sendRaw(packet);
  }

  async refresh(): Promise<void> {
    // TODO: reemplazar por el comando real de refresh del protocolo
    const packet = Buffer.from([0xaa, 0x55, 0xff, 0xff]);
    this.sendRaw(packet);
  }

  async setBrightness(value: number): Promise<void> {
    const v = Math.max(0, Math.min(255, value));
    // TODO: reemplazar por el comando real de brillo del protocolo
    const packet = Buffer.from([0xaa, 0x55, 0x10, v]);
    this.sendRaw(packet);
  }
}
