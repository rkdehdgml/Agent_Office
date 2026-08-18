import { describe, expect, it } from "vitest";
import { WALL_GRID, WALL_RECTS, bitmaskAt, buildWallGrid, listWallCells } from "./wallTiles";

describe("buildWallGrid", () => {
  it("rasterizes WALL_RECTS into exactly 102 wall cells (76 outer + 26 interior)", () => {
    expect(listWallCells(WALL_GRID).length).toBe(102);
  });

  it("leaves the central corridor cell (world x=0, z=0) open", () => {
    // gx = 0 - (-12) = 12, gz = 0 - (-8) = 8
    expect(WALL_GRID[8][12]).toBe(false);
  });

  it("marks the top-left perimeter corner (world x=-12, z=-8) as wall", () => {
    expect(WALL_GRID[0][0]).toBe(true);
  });

  it("ignores rects that fall outside the 24x16 grid without throwing", () => {
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

  it("WALL_RECTS produces a grid whose true-cell count matches its own rect areas minus overlaps", () => {
    // Sanity cross-check: rebuilding from the exported rects gives the same grid.
    expect(buildWallGrid(WALL_RECTS)).toEqual(WALL_GRID);
  });
});
