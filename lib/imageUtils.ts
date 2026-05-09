/** Downsize a data-URL image so the longest side is at most `maxSize` px,
 *  re-encoding as JPEG to keep payloads small before sending to the AI.
 *  Returns the original data URL untouched if it's already small enough. */
export async function downsizeDataUrl(
  dataUrl: string,
  maxSize = 1024,
  quality = 0.92,
): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load photo for resize"));
    img.src = dataUrl;
  });

  const { naturalWidth: w, naturalHeight: h } = img;
  if (Math.max(w, h) <= maxSize) return dataUrl;

  const scale = maxSize / Math.max(w, h);
  const targetW = Math.round(w * scale);
  const targetH = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvas.toDataURL("image/jpeg", quality);
}
