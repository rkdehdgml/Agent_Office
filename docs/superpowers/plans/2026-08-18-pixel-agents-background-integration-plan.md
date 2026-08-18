# pixel-agents 배경(바닥/벽) 애셋 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Walls.tsx`를 pixel-agents식 인접 감지 비트마스크 오토타일링으로 재작성하고, 바닥 텍스처를 절차적 그리기에서 `floor_N.png` 실제 이미지로 교체한다.

**Architecture:** 벽은 사람이 읽기 쉬운 사각형 리스트(`WALL_RECTS`)를 모듈 로드 시 1유닛 셀 그리드(`WALL_GRID`, 16행×24열)로 래스터화하고, 각 벽 셀마다 상하좌우 이웃을 검사해 4비트 마스크를 계산해 `wall_0.png`(64×128, 16×32 조각 4×4 배열)에서 해당 조각을 크롭한 텍스처를 적용한다. `Walls.tsx`는 11개의 긴 박스 대신 셀당 1개(약 106개)의 `1×1.6×1` 박스 메시를 렌더링한다. 바닥은 기존 2×2 체커보드 반복 텍스처 파이프라인은 그대로 두고, 절차적 `drawFloorTile` 호출만 `floor_0.png`/`floor_1.png` 실제 이미지의 `drawImage` 호출로 교체한다.

**Tech Stack:** React + react-three-fiber(three.js), TypeScript, Vite, Vitest.

**Spec:** [docs/superpowers/specs/2026-08-18-pixel-agents-background-integration-design.md](../specs/2026-08-18-pixel-agents-background-integration-design.md)

> 구현 결과: Task 1 구현 중 "약 106개"가 손 계산 오류였음이 밝혀져 102개로
> 정정됐고, 최종 전체 브랜치 리뷰에서 외곽 벽이 바닥 가장자리의 책상·소품·
> 캐릭터와 겹치는 문제가 발견되어 외곽을 바닥 바깥으로 한 칸 확장하는
> 수정이 적용됐다(그리드 16행×24열 → 18행×26열). 최종 벽 셀 수는 114개
> (외곽 84 + 내부 30). 아래 태스크 본문의 "106개"/"16행×24열" 표기는
> 최초 계획 작성 시점의 스냅샷이며, 실제 구현은 이 정정을 반영한다 —
> 자세한 경위는 스펙 문서의 "구현 결과" 각주와 git 히스토리 참고.

## Global Constraints

- 벽 그리드 원점: 좌하단 셀 `(gx=0, gz=0)`이 월드 좌표 `x=-12, z=-8`에 대응. 그리드 크기 16행(z) × 24열(x). 셀 `(gx,gz)`는 월드 `[gx-12, gx-11] × [gz-8, gz-7]`을 차지한다.
- 비트마스크: `N=1, E=2, S=4, W=8`(그리드 밖 이웃은 "벽 아님"으로 취급). pixel-agents 원본 소스(`scripts/wall-tile-editor.html`)를 대조해 확정한 값이며, 조각 위치는 `col = mask % 4, row = Math.floor(mask / 4)`, 각 조각은 16×32px(`col*16, row*32`에서 크롭).
- 벽 셀 렌더링 지오메트리: `1 × WALL_HEIGHT(1.6) × 1` 박스 메시(현재의 얇은 파티션 두께 0.25는 폐기 — 셀 전체를 차지하는 통짜 블록).
- 텍스처는 전부 `NearestFilter`(픽셀아트 선명도 유지), 바닥은 기존과 동일하게 `SRGBColorSpace` + `RepeatWrapping` + `.repeat.set(9, 8)`.
- **비동기 이미지 로드 안전성(1단계에서 발견된 실제 버그의 재발 방지)**: `new Image()`는 항상 비동기로 디코드되므로, 이미지가 로드되기 전에 캔버스에 그리면 빈 텍스처가 영구히 남을 수 있다. 이미지에 의존하는 모든 텍스처 생성 코드는 `image.complete`가 `false`일 때 `"load"` 이벤트 리스너를 등록해 로드 완료 시 다시 그리고 `texture.needsUpdate = true`를 설정해야 한다.
- 바닥 타일 소스: `floor_0.png`, `floor_1.png` (둘 다 평평한 단색 계열 타일로, 기존 절차적 두 톤 체커보드와 시각적으로 가장 가까움 — 이번 브레인스토밍 중 9종 전체를 미리보기로 비교해 선정).
- 새로 추가하는 애셋 파일은 `git add`로 커밋해야 한다(현재 `ui/public/pixel-agents-assets/floors/`, `ui/public/pixel-agents-assets/walls/`는 untracked 상태).

---

### Task 1: 벽 그리드 순수 로직 (`wallTiles.ts` 코어) + 유닛 테스트

**Files:**
- Create: `ui/src/scene/wallTiles.ts`
- Test: `ui/src/scene/wallTiles.test.ts`

**Interfaces:**
- Produces: `interface WallRect { x0: number; x1: number; z0: number; z1: number }`, `WALL_RECTS: WallRect[]`, `buildWallGrid(rects: WallRect[]): boolean[][]`, `WALL_GRID: boolean[][]` (16×24, `WALL_GRID[gz][gx]`), `bitmaskAt(grid: boolean[][], gx: number, gz: number): number`, `interface WallCell { gx: number; gz: number; mask: number }`, `listWallCells(grid: boolean[][]): WallCell[]`.

- [ ] **Step 1: 벽 그리드 코어 파일 작성**

```ts
// ui/src/scene/wallTiles.ts
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
```

- [ ] **Step 2: 유닛 테스트 작성**

```ts
// ui/src/scene/wallTiles.test.ts
import { describe, expect, it } from "vitest";
import { WALL_GRID, WALL_RECTS, bitmaskAt, buildWallGrid, listWallCells } from "./wallTiles";

describe("buildWallGrid", () => {
  it("rasterizes WALL_RECTS into exactly 106 wall cells (76 outer + 30 interior)", () => {
    expect(listWallCells(WALL_GRID).length).toBe(106);
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
```

- [ ] **Step 3: 테스트 실행 확인**

Run: `npm --prefix ui run test -- wallTiles`
Expected: 모든 테스트 PASS (구현 전이므로 먼저 FAIL로 파일이 없다는 에러를 확인한 뒤 Step 1을 적용해도 되고, Step 1과 함께 작성했다면 바로 PASS를 확인).

- [ ] **Step 4: 커밋**

```bash
git add ui/src/scene/wallTiles.ts ui/src/scene/wallTiles.test.ts
git commit -m "feat: add wall grid rasterization and bitmask calculation"
```

---

### Task 2: 벽 텍스처 로딩 + `Walls.tsx` 셀 렌더링 재작성 + 벽 애셋 커밋

**Files:**
- Modify: `ui/src/scene/wallTiles.ts` (append)
- Modify: `ui/src/scene/Walls.tsx` (전체 재작성)
- Commit: `ui/public/pixel-agents-assets/walls/wall_0.png` (기존 untracked 파일)

**Interfaces:**
- Consumes: `WALL_GRID`, `bitmaskAt`, `listWallCells`, `WallCell`(Task 1)
- Produces: `wallImage(): HTMLImageElement`, `getWallTileTexture(mask: number): THREE.CanvasTexture` — `Walls.tsx`와 향후 다른 벽 관련 코드가 사용.

- [ ] **Step 1: `wallTiles.ts`에 이미지 로딩 + 텍스처 크롭 캐시 추가**

```ts
// ui/src/scene/wallTiles.ts에 추가
import { CanvasTexture, NearestFilter } from "three";

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
```

- [ ] **Step 2: `Walls.tsx` 전체 재작성**

```tsx
// ui/src/scene/Walls.tsx
import { useMemo } from "react";
import { WALL_GRID, getWallTileTexture, listWallCells } from "./wallTiles";

const WALL_HEIGHT = 1.6;

export function Walls() {
  const cells = useMemo(() => listWallCells(WALL_GRID), []);

  return (
    <>
      {cells.map(({ gx, gz, mask }) => (
        <mesh key={`${gx},${gz}`} position={[gx - 11.5, WALL_HEIGHT / 2, gz - 7.5]}>
          <boxGeometry args={[1, WALL_HEIGHT, 1]} />
          <meshStandardMaterial map={getWallTileTexture(mask)} />
        </mesh>
      ))}
    </>
  );
}
```

- [ ] **Step 3: 타입체크 + 기존 테스트 스위트 통과 확인**

Run: `npm --prefix ui run test`
Expected: 전체 PASS (Task 1의 `wallTiles.test.ts` 포함, `Walls.tsx`는 렌더링 컴포넌트라 자동 테스트 대상 아님 — 수동 확인은 Task 4에서 진행).

- [ ] **Step 4: 벽 애셋 커밋 + 코드 커밋**

```bash
git add ui/public/pixel-agents-assets/walls/wall_0.png
git add ui/src/scene/wallTiles.ts ui/src/scene/Walls.tsx
git commit -m "feat: render walls as per-cell bitmask-tiled boxes"
```

---

### Task 3: 바닥 텍스처를 `floor_0.png`/`floor_1.png`로 교체

**Files:**
- Modify: `ui/src/scene/officeTextures.ts`
- Modify: `ui/src/scene/pixelTile.ts` (더 이상 쓰이지 않는 `drawFloorTile` 제거)
- Commit: `ui/public/pixel-agents-assets/floors/floor_0.png`~`floor_8.png` (기존 untracked 9개 파일)

**Interfaces:**
- Consumes: `TILE_SIZE`, `drawDeskTopTile`(`pixelTile.ts`, 변경 없음)
- Produces: `getFloorTexture(): CanvasTexture`(시그니처 변경 없음 — `OfficeScene.tsx`의 기존 호출부는 그대로 동작)

- [ ] **Step 1: `pixelTile.ts`에서 `drawFloorTile` 제거**

```ts
// ui/src/scene/pixelTile.ts (전체)
export const TILE_SIZE = 16;

export function drawDeskTopTile(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#6f5940";
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = "#7d6650";
  for (let x = 0; x < TILE_SIZE; x += 4) {
    ctx.fillRect(x, 0, 2, TILE_SIZE);
  }
}
```

- [ ] **Step 2: `officeTextures.ts`의 `getFloorTexture`를 이미지 기반으로 재작성**

```ts
// ui/src/scene/officeTextures.ts
import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace } from "three";
import { TILE_SIZE, drawDeskTopTile } from "./pixelTile";

const FLOOR_ASSET_BASE = "/pixel-agents-assets/floors/";
const FLOOR_FILES = ["floor_0.png", "floor_1.png"];
const floorImages: HTMLImageElement[] = FLOOR_FILES.map((file) => {
  const img = new Image();
  img.src = `${FLOOR_ASSET_BASE}${file}`;
  return img;
});

let floorTexture: CanvasTexture | null = null;
let floorCanvas: HTMLCanvasElement | null = null;

function drawFloorCanvas(): void {
  const ctx = floorCanvas!.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const img = floorImages[(row + col) % 2];
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
  for (const img of floorImages) {
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
```

- [ ] **Step 3: 테스트 스위트 통과 확인**

Run: `npm --prefix ui run test`
Expected: 전체 PASS (텍스처 생성 코드는 DOM/캔버스에 의존해 유닛 테스트 대상이 아님 — 기존 `officeTextures.ts`도 테스트 파일이 없었던 것과 동일한 패턴. 수동 확인은 Task 4).

- [ ] **Step 4: 바닥 애셋 커밋 + 코드 커밋**

```bash
git add ui/public/pixel-agents-assets/floors/
git add ui/src/scene/officeTextures.ts ui/src/scene/pixelTile.ts
git commit -m "feat: render floor with pixel-agents floor tile images"
```

---

### Task 4: 문서 업데이트 + 수동 검증

**Files:**
- Modify: `ui/public/pixel-agents-assets/ATTRIBUTION.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: 없음(Task 1-3 완료 결과물을 육안 검증)

- [ ] **Step 1: `ATTRIBUTION.md`에 floors/walls 언급 추가**

`ui/public/pixel-agents-assets/ATTRIBUTION.md`의 1번째 문단을 다음으로 교체:

```markdown
The files under `characters/` (`char_0.png`–`char_5.png`), `floors/`
(`floor_0.png`–`floor_8.png`), and `walls/` (`wall_0.png`) are sprite
assets from the [pixel-agents](https://github.com/pixel-agents-hq/pixel-agents)
project, used under its MIT license.
```

- [ ] **Step 2: `README.md`의 "픽셀아트 에셋 교체" 섹션 갱신**

`README.md`의 61번째 줄 근처 "## 픽셀아트 에셋 교체" 섹션 본문 끝(70번째 줄,
"참고하세요." 다음)에 아래 문단을 추가하고, 84-86번째 줄 크레딧 항목에
바닥/벽 줄을 추가하고, 90-96번째 줄의 "### 남은 작업 (별도 단계)" 섹션 전체를
삭제한다(더 이상 남은 작업이 아니므로).

추가할 문단 (기존 캐릭터 설명 문단 바로 뒤):

```markdown
**바닥/벽도 완료됨.** 바닥은 `floor_0.png`/`floor_1.png` 실제 이미지를
기존 2×2 체커보드 반복 파이프라인에 사용하고, 벽은 pixel-agents 원본과
동일한 인접 감지 기반 16종 비트마스크 오토타일링을 적용해
`wall_0.png`에서 조각을 크롭한 텍스처로 렌더링합니다. 그리드 모델,
비트마스크 계산, 셀 렌더링 방식은
[`docs/superpowers/specs/2026-08-18-pixel-agents-background-integration-design.md`](docs/superpowers/specs/2026-08-18-pixel-agents-background-integration-design.md)를
참고하세요.
```

크레딧 항목(기존 "캐릭터 아트: pixel-agents (MIT)" 줄 다음)에 추가:

```markdown
   - 바닥/벽 아트: pixel-agents (MIT) — 위와 동일한 `ATTRIBUTION.md` 참고.
```

- [ ] **Step 3: 문서 커밋**

```bash
git add ui/public/pixel-agents-assets/ATTRIBUTION.md README.md
git commit -m "docs: document Phase 2 background asset completion"
```

- [ ] **Step 4: 수동 확인 (`npm run dev`)**

`npm --prefix ui run dev`로 개발 서버를 띄우고 브라우저에서 확인:

1. 벽이 셀 단위 블록으로 렌더링되고, 외곽 모서리·T자 교차점·직선 구간이
   부자연스러운 조각 없이 자연스럽게 이어지는지
2. 각 부서 방에 문간(통로)이 남아있어 캐릭터가 오갈 수 있는 레이아웃으로
   보이는지 (충돌 로직은 없으므로 시각적 확인만)
3. 바닥이 `floor_0`/`floor_1` 이미지 타일로 보이고 반복 패턴이 부자연스럽지
   않은지
4. 캐릭터가 새 벽/바닥 위에서 1단계와 동일하게 정상 렌더링되는지(회귀 없음)
5. 벽/바닥 이미지가 새로고침 직후에도(비동기 로드 완료 전 첫 프레임에서도)
   빈 텍스처 없이 정상적으로 나타나는지 — 개발자 도구 Network 탭에서
   캐시를 비활성화하고 하드 리프레시해서 확인

## Self-Review Notes

- **스펙 커버리지**: A(그리드 모델)→Task1, B(비트마스크+텍스처 크롭)→Task1+2,
  C(셀별 박스 렌더링)→Task2, D(바닥 이미지 교체)→Task3, 파일/테스트
  요약→Task1-3, 범위 밖 항목(이동 충돌 연동, 바닥 오토타일링, 책상/그림자
  교체)은 계획에 포함하지 않음(의도적 제외). 모두 커버됨.
- **플레이스홀더 스캔**: 전체 코드 블록이 실제 값(정확한 좌표, 정확한 마스크
  공식, 정확한 파일명)을 포함하며 TBD/TODO 없음. 스펙에서 "구현 계획에서
  확정" 표시했던 두 항목(비트마스크 대응표, 바닥 이미지 2종)은 pixel-agents
  소스 대조(`wall-tile-editor.html`)와 실제 이미지 미리보기로 이 계획
  작성 중에 확정했다.
- **타입 일관성**: `WallCell`(Task1) → `listWallCells`(Task1) →
  `Walls.tsx`(Task2)에서 `{gx, gz, mask}` 구조분해로 동일하게 사용.
  `getFloorTexture(): CanvasTexture` 시그니처는 기존 `OfficeScene.tsx`
  호출부(`map={getFloorTexture()}`)와 그대로 호환.
