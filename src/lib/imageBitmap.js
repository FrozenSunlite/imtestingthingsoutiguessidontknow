// Browser-tolerant image decoding. createImageBitmap is fast and supported by
// modern Chromium/Firefox/Safari, but older Safari and some embedded WebViews
// do not expose it. In that case decode through an <img> and copy the pixels to
// a canvas so callers can keep using drawImage/width/height unchanged.
export async function loadImageSource(blob) {
  if (!blob) throw new Error("No image data");
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall through to the <img> decoder */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not decode the image"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    if (!canvas.width || !canvas.height) throw new Error("Image has no pixels");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable");
    ctx.drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
