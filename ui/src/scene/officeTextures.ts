import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace } from "three";
import { TILE_SIZE, drawDeskTopTile } from "./pixelTile";

const FLOOR_ASSET_BASE = "/pixel-agents-assets/floors/";
const FLOOR_FILES = ["floor_0.png", "floor_1.png"];
let floorImagesInstance: HTMLImageElement[] | null = null;

function floorImages(): HTMLImageElement[] {
  if (!floorImagesInstance) {
    floorImagesInstance = FLOOR_FILES.map((file) => {
      const img = new Image();
      img.src = `${FLOOR_ASSET_BASE}${file}`;
      return img;
    });
  }
  return floorImagesInstance;
}

let floorTexture: CanvasTexture | null = null;
let floorCanvas: HTMLCanvasElement | null = null;

function drawFloorCanvas(): void {
  const ctx = floorCanvas!.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const img = floorImages()[(row + col) % 2];
      ctx.drawImage(img, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
}

export function getFloorTexture(): CanvasTexture {
  if (floorTexture) return floorTexture;

  floorCanvas = document.createElement("canvas");
  floorCanvas.width = TILE_SIZE * 2;
  floorCanvas.height = TILE_SIZE * 2;
  drawFloorCanvas();

  floorTexture = new CanvasTexture(floorCanvas);
  floorTexture.colorSpace = SRGBColorSpace;
  floorTexture.magFilter = NearestFilter;
  floorTexture.minFilter = NearestFilter;
  floorTexture.wrapS = floorTexture.wrapT = RepeatWrapping;
  floorTexture.repeat.set(9, 8);

  // floor_0.png/floor_1.png load asynchronously (see Global Constraints),
  // so redraw once each finishes in case the initial draw above ran first.
  for (const img of floorImages()) {
    if (!img.complete) {
      img.addEventListener("load", () => {
        drawFloorCanvas();
        floorTexture!.needsUpdate = true;
      });
    }
  }

  return floorTexture;
}

let deskTopTexture: CanvasTexture | null = null;

export function getDeskTopTexture(): CanvasTexture {
  if (deskTopTexture) return deskTopTexture;
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d")!;
  drawDeskTopTile(ctx);
  deskTopTexture = new CanvasTexture(canvas);
  deskTopTexture.colorSpace = SRGBColorSpace;
  deskTopTexture.magFilter = NearestFilter;
  deskTopTexture.minFilter = NearestFilter;
  return deskTopTexture;
}

let shadowTexture: CanvasTexture | null = null;

export function getShadowTexture(): CanvasTexture {
  if (shadowTexture) return shadowTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.45)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  shadowTexture = new CanvasTexture(canvas);
  shadowTexture.colorSpace = SRGBColorSpace;
  return shadowTexture;
}
