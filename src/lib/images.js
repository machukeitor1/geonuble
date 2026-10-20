import { api } from "./api";

// Reduce y comprime una imagen en el navegador antes de subirla,
// para mantener el almacenamiento dentro del plan gratuito.
export async function resizeImage(file, maxSize, quality = 0.8) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen"))), "image/jpeg", quality)
  );
}

// Sube la foto en dos tamaños: grande (galería) y miniatura (tarjetas).
export async function uploadPropertyImage(file) {
  const [large, small] = await Promise.all([resizeImage(file, 1400, 0.75), resizeImage(file, 560, 0.7)]);
  const [full, thumb] = await Promise.all([
    api("upload", { method: "POST", body: large, headers: { "Content-Type": "image/jpeg" } }),
    api("upload", { method: "POST", body: small, headers: { "Content-Type": "image/jpeg" } }),
  ]);
  return { url: full.url, key: full.key, thumb: thumb.url, thumbKey: thumb.key };
}

export function loadImage(src, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error(`Tiempo agotado cargando ${src}`)), timeout);
    img.crossOrigin = "anonymous";
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`No se pudo cargar ${src}`));
    };
    img.src = src;
  });
}

// Imagen como PNG (conserva transparencia), reducida a maxSize. Para el logo del PDF.
export async function imageToPng(src, maxSize = 400) {
  const img = await loadImage(src);
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return { data: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
}

// Recorta la imagen para llenar una proporción (como object-fit: cover) y la devuelve en JPEG.
export async function imageCover(src, ratio, width = 1400) {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round(width / ratio);
  const imgRatio = img.naturalWidth / img.naturalHeight;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (imgRatio > ratio) sw = sh * ratio;
  else sh = sw / ratio;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.78);
}
