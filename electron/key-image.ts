import sharp from "sharp";

export type KeyImageTransform = {
  keySize: number;
  rotation: 0 | 90 | 180 | 270;
};

export const DEFAULT_KEY_IMAGE_TRANSFORM: KeyImageTransform = {
  keySize: 96,
  rotation: 90,
};

const MAX_KEY_JPEG_BYTES = 10240;

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
  keySize: number,
): sharp.Sharp =>
  pipeline
    .resize(keySize, keySize, {
      fit: "cover",
      position: "centre",
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
): Promise<Buffer> => {
  const processed = buildDeviceKeyPipeline(
    openImagePipeline(source, page),
    keyImage,
  );

  return encodeKeyJpeg(processed);
};

export const processKeyImageDataUrl = async (
  sourceDataUrl: string,
  keyImage: KeyImageTransform,
): Promise<string> => {
  const source = parseImageDataUrl(sourceDataUrl);
  const metadata = await sharp(source, { animated: true }).metadata();
  const isAnimatedGif = (metadata.pages ?? 1) > 1 && metadata.format === "gif";

  const jpeg = isAnimatedGif
    ? await processKeyImageToJpeg(source, keyImage, 0)
    : await buildPreviewKeyPipeline(openImagePipeline(source), keyImage.keySize)
        .jpeg({ quality: 90, chromaSubsampling: "4:2:0" })
        .toBuffer();

  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
};

export const buildGifFrames = async (
  source: Buffer,
  keyImage: KeyImageTransform,
): Promise<Array<{ data: Buffer; delayMs: number }>> => {
  const metadata = await sharp(source, { animated: true }).metadata();
  const pages = metadata.pages ?? 1;
  const delays = metadata.delay ?? [];

  const frames: Array<{ data: Buffer; delayMs: number }> = [];
  for (let page = 0; page < pages; page += 1) {
    const jpeg = await processKeyImageToJpeg(source, keyImage, page);
    frames.push({
      data: jpeg,
      delayMs: Math.max(delays[page] ?? delays[0] ?? 100, 40),
    });
  }

  return frames;
};
