import sharp from "sharp";

export type KeyImageTransform = {
  keySize: number;
  rotation: 0 | 90 | 180 | 270;
};

export const DEFAULT_KEY_IMAGE_TRANSFORM: KeyImageTransform = {
  keySize: 96,
  rotation: 90,
};

/** Higher-res previews for the app UI (device uploads still use keySize). */
export const APP_PREVIEW_KEY_PIXELS = 320;

const MAX_KEY_JPEG_BYTES = 10240;

const escapeXml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type LabelEdge = "bottom" | "top" | "left" | "right";

const truncateLabel = (label: string): string => {
  const trimmed = label.trim();
  return trimmed.length > 28 ? `${trimmed.slice(0, 27)}…` : trimmed;
};

const getDeviceLabelEdge = (
  rotation: KeyImageTransform["rotation"],
): LabelEdge => {
  switch (rotation) {
    case 0:
      return "bottom";
    case 90:
      return "right";
    case 180:
      return "top";
    case 270:
      return "left";
  }
};

const buildLabelFadeGradient = (edge: LabelEdge): string => {
  const stops = `
    <stop offset="0%" stop-color="#000000" stop-opacity="0.62"/>
    <stop offset="45%" stop-color="#000000" stop-opacity="0.28"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
  `;

  switch (edge) {
    case "bottom":
      return `<linearGradient id="labelFade" x1="0" y1="1" x2="0" y2="0">${stops}</linearGradient>`;
    case "top":
      return `<linearGradient id="labelFade" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`;
    case "right":
      return `<linearGradient id="labelFade" x1="1" y1="0" x2="0" y2="0">${stops}</linearGradient>`;
    case "left":
      return `<linearGradient id="labelFade" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient>`;
  }
};

const buildLabelFadeRect = (
  edge: LabelEdge,
  keySize: number,
  fadeHeight: number,
): string => {
  switch (edge) {
    case "bottom":
      return `<rect x="0" y="${keySize - fadeHeight}" width="${keySize}" height="${fadeHeight}" fill="url(#labelFade)"/>`;
    case "top":
      return `<rect x="0" y="0" width="${keySize}" height="${fadeHeight}" fill="url(#labelFade)"/>`;
    case "right":
      return `<rect x="${keySize - fadeHeight}" y="0" width="${fadeHeight}" height="${keySize}" fill="url(#labelFade)"/>`;
    case "left":
      return `<rect x="0" y="0" width="${fadeHeight}" height="${keySize}" fill="url(#labelFade)"/>`;
  }
};

export const buildKeyLabelSvg = (
  label: string,
  keySize: number,
  rotation: KeyImageTransform["rotation"] = 0,
): Buffer => {
  const displayLabel = truncateLabel(label);
  const fontSize = Math.max(11, Math.floor(keySize * 0.18));
  const fadeHeight = Math.max(Math.floor(keySize * 0.46), fontSize + 16);
  const edge = getDeviceLabelEdge(rotation);
  const center = keySize / 2;
  const font = `font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="600" fill="#ffffff"`;
  const textShadow = `filter="drop-shadow(0 1px 2px rgba(0,0,0,0.85))"`;
  const defs = `<defs>${buildLabelFadeGradient(edge)}</defs>`;
  const fadeRect = buildLabelFadeRect(edge, keySize, fadeHeight);

  switch (edge) {
    case "top":
      return Buffer.from(
        `<svg width="${keySize}" height="${keySize}" xmlns="http://www.w3.org/2000/svg">
          ${defs}
          ${fadeRect}
          <text x="${center}" y="${fontSize + 4}" ${font} ${textShadow} text-anchor="middle">${escapeXml(displayLabel)}</text>
        </svg>`,
      );
    case "right": {
      const anchorX = keySize - 6;
      return Buffer.from(
        `<svg width="${keySize}" height="${keySize}" xmlns="http://www.w3.org/2000/svg">
          ${defs}
          ${fadeRect}
          <text x="${anchorX}" y="${center}" transform="rotate(-90 ${anchorX} ${center})" ${font} ${textShadow} text-anchor="middle">${escapeXml(displayLabel)}</text>
        </svg>`,
      );
    }
    case "left": {
      const anchorX = 6;
      return Buffer.from(
        `<svg width="${keySize}" height="${keySize}" xmlns="http://www.w3.org/2000/svg">
          ${defs}
          ${fadeRect}
          <text x="${anchorX}" y="${center}" transform="rotate(90 ${anchorX} ${center})" ${font} ${textShadow} text-anchor="middle">${escapeXml(displayLabel)}</text>
        </svg>`,
      );
    }
    case "bottom":
    default: {
      const textY = keySize - 6;
      return Buffer.from(
        `<svg width="${keySize}" height="${keySize}" xmlns="http://www.w3.org/2000/svg">
          ${defs}
          ${fadeRect}
          <text x="${center}" y="${textY}" ${font} ${textShadow} text-anchor="middle">${escapeXml(displayLabel)}</text>
        </svg>`,
      );
    }
  }
};

export const applyKeyLabelOverlay = (
  pipeline: sharp.Sharp,
  label: string | undefined,
  keySize: number,
  rotation: KeyImageTransform["rotation"] = 0,
): sharp.Sharp => {
  const trimmedLabel = label?.trim();
  if (!trimmedLabel) {
    return pipeline;
  }

  return pipeline.composite([
    {
      input: buildKeyLabelSvg(trimmedLabel, keySize, rotation),
      top: 0,
      left: 0,
    },
  ]);
};

export const parseImageDataUrl = (input: string): Buffer => {
  if (!input.startsWith("data:")) {
    return Buffer.from(input, "base64");
  }

  const commaIndex = input.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Invalid image payload");
  }

  return Buffer.from(input.slice(commaIndex + 1), "base64");
};

const toSharpRotationAngle = (
  rotation: KeyImageTransform["rotation"],
): number => {
  // PIL uses counter-clockwise degrees; sharp uses clockwise degrees.
  return -rotation;
};

const openImagePipeline = (source: Buffer, page?: number): sharp.Sharp => {
  if (page === undefined) {
    return sharp(source, { animated: false });
  }

  return sharp(source, { animated: true, page, pages: 1 });
};

export const buildPreviewKeyPipeline = (
  pipeline: sharp.Sharp,
  previewSize: number = APP_PREVIEW_KEY_PIXELS,
): sharp.Sharp =>
  pipeline
    .resize(previewSize, previewSize, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.lanczos3,
    })
    .flatten({ background: { r: 0, g: 0, b: 0 } });

export const buildDeviceKeyPipeline = (
  pipeline: sharp.Sharp,
  keyImage: KeyImageTransform,
): sharp.Sharp => {
  const { keySize, rotation } = keyImage;

  const rotated =
    rotation === 0
      ? pipeline
      : pipeline.rotate(toSharpRotationAngle(rotation), {
          background: { r: 0, g: 0, b: 0 },
        });

  return rotated
    .resize(keySize, keySize, {
      fit: "cover",
      position: "centre",
    })
    .flatten({ background: { r: 0, g: 0, b: 0 } });
};

export const encodeKeyJpeg = async (pipeline: sharp.Sharp): Promise<Buffer> => {
  for (let quality = 90; quality >= 25; quality -= 5) {
    const jpeg = await pipeline
      .clone()
      .jpeg({
        quality,
        chromaSubsampling: "4:2:0",
      })
      .toBuffer();

    if (jpeg.byteLength <= MAX_KEY_JPEG_BYTES) {
      return jpeg;
    }
  }

  return pipeline
    .jpeg({
      quality: 25,
      chromaSubsampling: "4:2:0",
    })
    .toBuffer();
};

export const processKeyImageToJpeg = async (
  source: Buffer,
  keyImage: KeyImageTransform,
  page?: number,
  label?: string,
): Promise<Buffer> => {
  const processed = applyKeyLabelOverlay(
    buildDeviceKeyPipeline(openImagePipeline(source, page), keyImage),
    label,
    keyImage.keySize,
    keyImage.rotation,
  );

  return encodeKeyJpeg(processed);
};

export const buildSolidBlackKeyJpeg = async (
  keyImage: KeyImageTransform,
): Promise<Buffer> => {
  return encodeKeyJpeg(
    sharp({
      create: {
        width: keyImage.keySize,
        height: keyImage.keySize,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    }),
  );
};

export const buildLabelOnlyKeyJpeg = async (
  label: string,
  keyImage: KeyImageTransform,
): Promise<Buffer> => {
  const processed = applyKeyLabelOverlay(
    sharp({
      create: {
        width: keyImage.keySize,
        height: keyImage.keySize,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    }),
    label,
    keyImage.keySize,
    keyImage.rotation,
  );

  return encodeKeyJpeg(processed);
};

export const processKeyImageDataUrl = async (
  sourceDataUrl: string,
  _keyImage: KeyImageTransform,
): Promise<string> => {
  const source = parseImageDataUrl(sourceDataUrl);
  const metadata = await sharp(source, { animated: true }).metadata();
  const isAnimatedGif = (metadata.pages ?? 1) > 1 && metadata.format === "gif";

  const jpeg = await buildPreviewKeyPipeline(
    openImagePipeline(source, isAnimatedGif ? 0 : undefined),
    APP_PREVIEW_KEY_PIXELS,
  )
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();

  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
};

export const buildGifFrames = async (
  source: Buffer,
  keyImage: KeyImageTransform,
  label?: string,
): Promise<Array<{ data: Buffer; delayMs: number }>> => {
  const metadata = await sharp(source, { animated: true }).metadata();
  const pages = metadata.pages ?? 1;
  const delays = metadata.delay ?? [];

  const frames: Array<{ data: Buffer; delayMs: number }> = [];
  for (let page = 0; page < pages; page += 1) {
    const jpeg = await processKeyImageToJpeg(source, keyImage, page, label);
    frames.push({
      data: jpeg,
      delayMs: Math.max(delays[page] ?? delays[0] ?? 100, 40),
    });
  }

  return frames;
};
