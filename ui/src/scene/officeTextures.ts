import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace } from "three";
import { TILE_SIZE, drawDeskTopTile, drawFloorTile } from "./pixelTile";

let floorTexture: CanvasTexture | null = null;

export function getFloorTexture(): CanvasTexture {
  if (floorTexture) return floorTexture;
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE * 2;
  canvas.height = TILE_SIZE * 2;
  const ctx = canvas.getContext("2d")!;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      ctx.save();
      ctx.translate(col * TILE_SIZE, row * TILE_SIZE);
      drawFloorTile(ctx, (row + col) % 2 === 0);
      ctx.restore();
    }
  }
  floorTexture = new CanvasTexture(canvas);
  floorTexture.colorSpace = SRGBColorSpace;
  floorTexture.magFilter = NearestFilter;
  floorTexture.minFilter = NearestFilter;
  floorTexture.wrapS = floorTexture.wrapT = RepeatWrapping;
  floorTexture.repeat.set(9, 8);
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
