import { CanvasTexture, NearestFilter, SRGBColorSpace } from "three";

export interface WallRect {
  x0: number; // 셀 좌표, inclusive
  x1: number; // 셀 좌표, exclusive
  z0: number;
  z1: number;
}

export const WALL_RECTS: WallRect[] = [
  // 외곽 둘레 (floor footprint x∈[-12,12], z∈[-8,8]의 바깥쪽 한 칸 링)
  { x0: -12, x1: 12, z0: -9, z1: -8 }, // 상단
  { x0: -12, x1: 12, z0: 8, z1: 9 }, // 하단
  { x0: -13, x1: -12, z0: -9, z1: 9 }, // 좌측
  { x0: 12, x1: 13, z0: -9, z1: 9 }, // 우측

  // 세로 칸막이 x=-4 (연구/개발 vs 기획/본부), 중앙 통로 z∈[-2,2) 개방
  { x0: -4, x1: -3, z0: -8, z1: -2 },
  { x0: -4, x1: -3, z0: 2, z1: 8 },

  // 세로 칸막이 x=4 (기획/본부 vs 디자인퍼블리싱). 아래쪽은 휴게실이라 개방
  { x0: 4, x1: 5, z0: -8, z1: -2 },

  // 가로 칸막이 z=0 (스냅: z∈[0,1) 행), 각 열 사이 문간 확보
  { x0: -12, x1: -10, z0: 0, z1: 1 },
  { x0: -6, x1: -2, z0: 0, z1: 1 },
  { x0: 2, x1: 4, z0: 0, z1: 1 },
  { x0: 6, x1: 10, z0: 0, z1: 1 },
];

const GRID_WIDTH = 26;
const GRID_HEIGHT = 18;

export function buildWallGrid(rects: WallRect[]): boolean[][] {
  const grid: boolean[][] = Array.from({ length: GRID_HEIGHT }, () =>
    Array(GRID_WIDTH).fill(false),
  );
  for (const rect of rects) {
    for (let cz = rect.z0; cz < rect.z1; cz += 1) {
      for (let cx = rect.x0; cx < rect.x1; cx += 1) {
        const gx = cx + 13;
        const gz = cz + 9;
        if (gx >= 0 && gx < GRID_WIDTH && gz >= 0 && gz < GRID_HEIGHT) {
          grid[gz][gx] = true;
        }
      }
    }
  }
  return grid;
}

export const WALL_GRID = buildWallGrid(WALL_RECTS);

export function bitmaskAt(grid: boolean[][], gx: number, gz: number): number {
  const at = (x: number, z: number): boolean =>
    z >= 0 && z < grid.length && x >= 0 && x < grid[0].length && grid[z][x];
  let mask = 0;
  if (at(gx, gz - 1)) mask |= 1; // N
  if (at(gx + 1, gz)) mask |= 2; // E
  if (at(gx, gz + 1)) mask |= 4; // S
  if (at(gx - 1, gz)) mask |= 8; // W
  return mask;
}

export interface WallCell {
  gx: number;
  gz: number;
  mask: number;
}

export function listWallCells(grid: boolean[][]): WallCell[] {
  const cells: WallCell[] = [];
  for (let gz = 0; gz < grid.length; gz += 1) {
    for (let gx = 0; gx < grid[0].length; gx += 1) {
      if (grid[gz][gx]) {
        cells.push({ gx, gz, mask: bitmaskAt(grid, gx, gz) });
      }
    }
  }
  return cells;
}

const WALL_ASSET_PATH = "/pixel-agents-assets/walls/wall_0.png";
const WALL_PIECE_WIDTH = 16;
const WALL_PIECE_HEIGHT = 32;

let wallImageInstance: HTMLImageElement | null = null;

export function wallImage(): HTMLImageElement {
  if (!wallImageInstance) {
    wallImageInstance = new Image();
    wallImageInstance.src = WALL_ASSET_PATH;
  }
  return wallImageInstance;
}

function drawWallTile(canvas: HTMLCanvasElement, mask: number): void {
  const ctx = canvas.getContext("2d")!;
  const img = wallImage();
  const col = mask % 4;
  const row = Math.floor(mask / 4);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, WALL_PIECE_WIDTH, WALL_PIECE_HEIGHT);
  ctx.drawImage(
    img,
    col * WALL_PIECE_WIDTH,
    row * WALL_PIECE_HEIGHT,
    WALL_PIECE_WIDTH,
    WALL_PIECE_HEIGHT,
    0,
    0,
    WALL_PIECE_WIDTH,
    WALL_PIECE_HEIGHT,
  );
}

const wallTileCache = new Map<number, CanvasTexture>();
let wallLoadListenerAttached = false;

export function getWallTileTexture(mask: number): CanvasTexture {
  const cached = wallTileCache.get(mask);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = WALL_PIECE_WIDTH;
  canvas.height = WALL_PIECE_HEIGHT;
  drawWallTile(canvas, mask);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  wallTileCache.set(mask, texture);

  // wall_0.png loads asynchronously (see Global Constraints), so the draw
  // above can run before it has decoded, leaving the tile blank. Redraw
  // every cached tile once loading finishes.
  const img = wallImage();
  if (!img.complete && !wallLoadListenerAttached) {
    wallLoadListenerAttached = true;
    img.addEventListener("load", () => {
      for (const [cachedMask, cachedTexture] of wallTileCache) {
        drawWallTile(cachedTexture.image as HTMLCanvasElement, cachedMask);
        cachedTexture.needsUpdate = true;
      }
    });
  }

  return texture;
}
