export async function compressImage(
  file: File,
  options: { maxDim?: number; quality?: number; maxSizeKB?: number } = {}
): Promise<{ dataUrl: string; originalSizeKB: number; compressedSizeKB: number }> {
  const maxDim = options.maxDim ?? 1024;
  let quality = options.quality ?? 0.6;
  const maxSizeKB = options.maxSizeKB ?? 500;

  const originalSizeKB = file.size / 1024;

  const compressToDataUrl = (img: HTMLImageElement, q: number): string => {
    let { width, height } = img;

    if (width > maxDim || height > maxDim) {
      if (width >= height) {
        height = Math.round((height / width) * maxDim);
        width = maxDim;
      } else {
        width = Math.round((width / height) * maxDim);
        height = maxDim;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not available");

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", q);
  };

  const loadImage = (f: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(f);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Image load failed"));
      };
      img.src = objectUrl;
    });
  };

  const img = await loadImage(file);
  let dataUrl = compressToDataUrl(img, quality);
  
  let compressedSizeKB = (dataUrl.length * (3 / 4)) / 1024;

  if (compressedSizeKB > maxSizeKB) {
    quality = 0.4;
    dataUrl = compressToDataUrl(img, quality);
    compressedSizeKB = (dataUrl.length * (3 / 4)) / 1024;
  }

  return { dataUrl, originalSizeKB, compressedSizeKB };
}
