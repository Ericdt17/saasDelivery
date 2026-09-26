/**
 * Trim white/transparent padding from an uploaded logo image.
 * Returns a cropped PNG data URL so stored logos render at their
 * visual size instead of being shrunk by baked-in padding.
 */

const ALPHA_THRESHOLD = 8; // below = transparent background
const WHITE_THRESHOLD = 247; // r,g,b all above = white background
const MARGIN_RATIO = 0.03; // small breathing room around the mark
const MAX_DIMENSION = 1000; // downscale huge logos after trim

function isBackgroundPixel(data: Uint8ClampedArray, offset: number): boolean {
  const alpha = data[offset + 3];
  if (alpha < ALPHA_THRESHOLD) return true;
  return (
    data[offset] >= WHITE_THRESHOLD &&
    data[offset + 1] >= WHITE_THRESHOLD &&
    data[offset + 2] >= WHITE_THRESHOLD
  );
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image"));
    img.src = dataUrl;
  });
}

/**
 * Crop white/transparent borders from an image data URL.
 * Falls back to the original data URL if the image cannot be
 * processed or contains no detectable content.
 */
export async function trimLogoWhitespace(dataUrl: string): Promise<string> {
  try {
    const img = await loadImage(dataUrl);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) return dataUrl;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0);

    const { data } = ctx.getImageData(0, 0, width, height);
    let top = height;
    let bottom = -1;
    let left = width;
    let right = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isBackgroundPixel(data, (y * width + x) * 4)) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
    }

    // Blank image or nothing to crop.
    if (bottom < top || right < left) return dataUrl;

    const marginX = Math.round((right - left + 1) * MARGIN_RATIO);
    const marginY = Math.round((bottom - top + 1) * MARGIN_RATIO);
    left = Math.max(0, left - marginX);
    right = Math.min(width - 1, right + marginX);
    top = Math.max(0, top - marginY);
    bottom = Math.min(height - 1, bottom + marginY);

    const cropWidth = right - left + 1;
    const cropHeight = bottom - top + 1;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(cropWidth, cropHeight));
    const outWidth = Math.max(1, Math.round(cropWidth * scale));
    const outHeight = Math.max(1, Math.round(cropHeight * scale));

    const out = document.createElement("canvas");
    out.width = outWidth;
    out.height = outHeight;
    const outCtx = out.getContext("2d");
    if (!outCtx) return dataUrl;
    outCtx.drawImage(
      canvas,
      left,
      top,
      cropWidth,
      cropHeight,
      0,
      0,
      outWidth,
      outHeight
    );

    return out.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}
