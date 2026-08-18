import { describe, expect, it } from "vitest";
import { WALL_GRID, bitmaskAt, buildWallGrid, listWallCells } from "./wallTiles";

describe("buildWallGrid", () => {
  it("rasterizes WALL_RECTS into exactly 114 wall cells (84 outer + 30 interior)", () => {
    expect(listWallCells(WALL_GRID).length).toBe(114);
  });

  it("leaves the central corridor cell (world x=0, z=0) open", () => {
    // gx = 0 + 13 = 13, gz = 0 + 9 = 9
    expect(WALL_GRID[9][13]).toBe(false);
  });

  it("marks the top-left perimeter corner (world x=-13, z=-9) as wall", () => {
    // The perimeter ring now sits one cell outside the floor footprint, so the
    // grid's (0,0) corner is world (-13,-9); world (-12,-8) is open floor.
    expect(WALL_GRID[0][0]).toBe(true);
    expect(WALL_GRID[1][1]).toBe(false);
  });

  it("ignores rects that fall outside the 26x18 grid without throwing", () => {
    const grid = buildWallGrid([{ x0: 100, x1: 101, z0: 100, z1: 101 }]);
    expect(listWallCells(grid).length).toBe(0);
  });
});

describe("bitmaskAt", () => {
  it("returns 0 for an isolated wall cell with no wall neighbors", () => {
    const grid = [
      [false, false, false],
      [false, true, false],
      [false, false, false],
    ];
    expect(bitmaskAt(grid, 1, 1)).toBe(0);
  });

  it("returns N|S (5) for the middle cell of a vertical run", () => {
    const grid = [
      [false, true, false],
      [false, true, false],
      [false, true, false],
    ];
    expect(bitmaskAt(grid, 1, 1)).toBe(1 | 4);
  });

  it("returns E|W (10) for the middle cell of a horizontal run", () => {
    const grid = [
      [false, false, false],
      [true, true, true],
      [false, false, false],
    ];
    expect(bitmaskAt(grid, 1, 1)).toBe(2 | 8);
  });

  it("treats off-grid neighbors as non-wall at the array boundary", () => {
    const grid = [
      [true, true],
      [true, false],
    ];
    // (0,0): no N (off-grid), no W (off-grid) -> only E|S
    expect(bitmaskAt(grid, 0, 0)).toBe(2 | 4);
  });

  it("computes the real WALL_GRID corner mask as E|S (6)", () => {
    expect(bitmaskAt(WALL_GRID, 0, 0)).toBe(2 | 4);
  });

  it("has the expected grid dimensions (18 rows x 26 cols)", () => {
    expect(WALL_GRID.length).toBe(18);
    expect(WALL_GRID[0].length).toBe(26);
  });
});
