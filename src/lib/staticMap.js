import { loadImage } from "./images";

const TILE = 256;

function project(lat, lng, zoom) {
  const scale = TILE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

// Arma una imagen de mapa (OpenStreetMap) centrada en el punto, para el PDF.
export async function staticMap(lat, lng, { width = 1000, height = 500, zoom = 16 } = {}) {
  const center = project(lat, lng, zoom);
  const left = center.x - width / 2;
  const top = center.y - height / 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e5e3df";
  ctx.fillRect(0, 0, width, height);

  const tiles = [];
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx++) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
      tiles.push(
        loadImage(`https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`).then((img) =>
          ctx.drawImage(img, tx * TILE - left, ty * TILE - top)
        )
      );
    }
  }
  await Promise.all(tiles);

  // Marcador
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 14, 0, Math.PI * 2);
  ctx.fillStyle = "#f0c040";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#1a3a5c";
  ctx.stroke();

  // Atribución requerida por OpenStreetMap
  const label = "© OpenStreetMap";
  ctx.font = "16px sans-serif";
  const w = ctx.measureText(label).width + 12;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(width - w, height - 24, w, 24);
  ctx.fillStyle = "#333";
  ctx.fillText(label, width - w + 6, height - 7);

  return canvas.toDataURL("image/jpeg", 0.85);
}
