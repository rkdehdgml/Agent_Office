export interface WallRect {
  x0: number; // 셀 좌표, inclusive
  x1: number; // 셀 좌표, exclusive
  z0: number;
  z1: number;
}

export const WALL_RECTS: WallRect[] = [
  // 외곽 둘레
  { x0: -12, x1: 12, z0: -8, z1: -7 }, // 상단
  { x0: -12, x1: 12, z0: 7, z1: 8 }, // 하단
  { x0: -12, x1: -11, z0: -8, z1: 8 }, // 좌측
  { x0: 11, x1: 12, z0: -8, z1: 8 }, // 우측

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

const GRID_WIDTH = 24;
const GRID_HEIGHT = 16;

export function buildWallGrid(rects: WallRect[]): boolean[][] {
  const grid: boolean[][] = Array.from({ length: GRID_HEIGHT }, () =>
    Array(GRID_WIDTH).fill(false),
  );
  for (const rect of rects) {
    for (let cz = rect.z0; cz < rect.z1; cz += 1) {
      for (let cx = rect.x0; cx < rect.x1; cx += 1) {
        const gx = cx + 12;
        const gz = cz + 8;
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
