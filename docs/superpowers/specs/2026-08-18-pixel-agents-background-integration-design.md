# pixel-agents 배경 애셋 통합 (Phase 2: 바닥/벽) — 설계 문서

날짜: 2026-08-18

## 배경 및 목적

[[2026-08-18-pixel-agents-character-integration-design]]에서 캐릭터 아트를
pixel-agents PNG로 교체한 뒤, 사용자 확인대로(2026-08-18 대화) 2단계로
배경(바닥/벽) 애셋 교체를 진행한다. 1단계 스펙의 "범위 밖" 항목에 남겨둔
"벽은 인접 감지 기반 비트마스크 오토타일링이 필요해 설계가 따로 필요함"을
이 문서에서 다룬다.

브레인스토밍 중 두 가지 안을 검토했다:

- **A안**: `Walls.tsx`의 현재 구조(11개의 독립적인 긴 3D 박스 메시)를
  유지한 채, 각 박스에 pixel-agents 벽 조각 텍스처 1~2종을 반복(`RepeatWrapping`)
  적용. 비트마스크 오토타일링 불필요, 구현이 단순함.
- **B안(채택)**: pixel-agents 원본과 동일하게 완전한 인접 감지 기반
  16종 비트마스크 오토타일링을 적용. 벽을 셀 그리드로 재모델링해야 함.

사용자가 **B안**을 선택했다(2026-08-18 대화, "B안으로 해줘"). 이 문서는
B안을 기준으로 설계를 확정한다.

B안을 선택하면 벽의 데이터 모델 자체가 바뀐다: 지금은 두께 0.25의 얇은
파티션이 바닥 위에 걸쳐 있는 형태이지만, pixel-agents식 비트마스크는
"각 셀이 통째로 벽이냐 아니냐"를 전제로 하므로, 벽이 있는 셀은 통짜
블록이 된다. 그리드 셀 크기는 **1월드유닛**으로 확정했다(사용자 선택,
2026-08-18 대화) — 2유닛보다 세밀해 문간/모서리가 더 자연스럽게 보이지만,
기존 벽 좌표 중 일부(두께 0.25인 세그먼트, z=0 걸침 등)는 격자에 정확히
안 맞아떨어져 스냅 규칙이 필요하다(아래 A절 참고).

## 범위

포함:
- `Walls.tsx`를 사각형 리스트 → 1유닛 셀 그리드 래스터화 → 셀별 비트마스크
  계산 → `wall_0.png` 조각 크롭 텍스처 적용 방식으로 재작성
- `officeTextures.ts`의 바닥 텍스처를 절차적 `drawFloorTile` 대신
  `floor_0.png`~`floor_8.png` 중 선택한 2종의 실제 이미지로 교체(기존
  2×2 체커보드 반복 파이프라인은 그대로 유지)
- 신규 `wallTiles.ts`: 그리드 래스터화, 비트마스크 계산, 텍스처 크롭
  캐시 로직 + 유닛 테스트

범위 밖:
- 이동 가능 영역(충돌/이동 로직)에 벽 그리드를 연동하는 것 — 지금
  AgentOffice는 캐릭터 이동에 충돌 판정이 없으므로(장식용 벽), 이번
  스코프에서는 순수 렌더링 교체만 다룬다
- 바닥 타일에 대한 인접 기반 오토타일링 — pixel-agents도 바닥은 오토타일링
  대상이 아니라 단일 평면 타일이므로 대상 아님(1단계 스펙과 동일 판단)
- 책상/그림자 텍스처(`getDeskTopTexture`, `getShadowTexture`) — 이번
  스코프와 무관, 변경 없음

## A. 벽 데이터 모델 — 사각형 리스트 → 셀 그리드 래스터화

기존 11개 박스 세그먼트를 사람이 읽기 쉬운 "벽 사각형" 리스트로 유지하되,
좌표 단위를 셀로 표현하고, 모듈 로드 시 이를 1유닛 `WALL_GRID`(24×16
불리언 그리드, 원점 좌하단 x=-12, z=-8, 셀 (cx,cz)는 월드 좌표
[cx,cx+1]×[cz,cz+1]에 대응)로 래스터화한다.

```ts
// ui/src/scene/wallTiles.ts
interface WallRect {
  x0: number; // 셀 좌표, inclusive
  x1: number; // 셀 좌표, exclusive
  z0: number;
  z1: number;
}

const WALL_RECTS: WallRect[] = [
  // 외곽 둘레
  { x0: -12, x1: 12, z0: -8, z1: -7 }, // 상단
  { x0: -12, x1: 12, z0: 7, z1: 8 },   // 하단
  { x0: -12, x1: -11, z0: -8, z1: 8 }, // 좌측
  { x0: 11, x1: 12, z0: -8, z1: 8 },   // 우측

  // 세로 칸막이 x=-4 (연구/개발 vs 기획/본부), 중앙 통로 z∈[-1,1) 개방
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

export function buildWallGrid(rects: WallRect[]): boolean[][] {
  const grid = Array.from({ length: 16 }, () => Array(24).fill(false));
  for (const r of rects) {
    for (let cz = r.z0; cz < r.z1; cz += 1) {
      for (let cx = r.x0; cx < r.x1; cx += 1) {
        const gx = cx + 12;
        const gz = cz + 8;
        if (gx >= 0 && gx < 24 && gz >= 0 && gz < 16) {
          grid[gz][gx] = true;
        }
      }
    }
  }
  return grid;
}

export const WALL_GRID = buildWallGrid(WALL_RECTS);
```

> 좌표는 1단계 조사 당시의 기존 `Walls.tsx` 값(문서 상단 인용)을 1유닛
> 그리드로 변환한 값이며, 실제 구현 시 `Walls.tsx`의 현재 좌표와 다시
> 한번 대조해 문간 폭·칸막이 위치가 시각적으로 기존과 동등한지 확인한다.

## B. 비트마스크 계산 + wall_0.png 크롭

각 벽 셀에 대해 상하좌우 이웃 셀이 벽인지 검사해 4비트 마스크를 계산한다
(N=1, E=2, S=4, W=8; 그리드 밖은 "벽 아님"으로 취급해 외곽 벽이 바깥쪽을
향한 정상적인 가장자리 조각으로 렌더링되게 한다).

```ts
// ui/src/scene/wallTiles.ts (계속)
export function bitmaskAt(grid: boolean[][], gx: number, gz: number): number {
  const at = (x: number, z: number) =>
    z >= 0 && z < grid.length && x >= 0 && x < grid[0].length && grid[z][x];
  let mask = 0;
  if (at(gx, gz - 1)) mask |= 1; // N
  if (at(gx + 1, gz)) mask |= 2; // E
  if (at(gx, gz + 1)) mask |= 4; // S
  if (at(gx - 1, gz)) mask |= 8; // W
  return mask;
}
```

`wall_0.png`(64×128, 16×32짜리 조각이 4×4로 배열)에서 마스크값에 대응하는
조각을 크롭해 `CanvasTexture`로 만들고 마스크값별로 캐시한다 — 지금
바닥에 쓰는 `drawFloorTile`/`getFloorTexture()` 캐시 패턴과 동일한 구조로
`getWallTileTexture(mask: number): CanvasTexture`를 만든다.

```ts
const wallTileCache = new Map<number, THREE.CanvasTexture>();

export function getWallTileTexture(
  wallImage: HTMLImageElement,
  mask: number,
): THREE.CanvasTexture {
  const cached = wallTileCache.get(mask);
  if (cached) return cached;

  const col = mask % 4;
  const row = Math.floor(mask / 4);
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    wallImage,
    col * 16, row * 32, 16, 32,
    0, 0, 16, 32,
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  wallTileCache.set(mask, texture);
  return texture;
}
```

> **마스크값 → (row, col) 대응 확인 필요**: 위 `col = mask % 4, row =
> floor(mask / 4)`는 4×4 그리드를 마스크값 0~15 순서대로 좌상단부터
> 채운다는 가정이다. pixel-agents 소스(`spriteData.ts` 또는
> `constants.ts`)의 실제 배열 순서가 이와 다를 수 있으므로, 구현 계획
> 작성 시 소스를 다시 대조해 이 대응표를 확정한다(1단계 때 프레임
> 인덱스를 소스 대조로 확정한 것과 동일한 절차).

## C. 렌더링 — 셀당 박스 메시

`Walls.tsx`는 `WALL_GRID`를 순회하며 벽인 셀마다 `1 × WALL_HEIGHT × 1`
박스 메시를 하나씩 생성하고, `meshStandardMaterial`의 `map`에 B절에서
계산한 텍스처를 적용한다.

```tsx
// ui/src/scene/Walls.tsx
export function Walls() {
  const wallImage = useWallImage(); // char 이미지 프리로드와 동일 패턴
  const cells = useMemo(() => {
    const result: { x: number; z: number; mask: number }[] = [];
    for (let gz = 0; gz < WALL_GRID.length; gz += 1) {
      for (let gx = 0; gx < WALL_GRID[0].length; gx += 1) {
        if (WALL_GRID[gz][gx]) {
          result.push({ x: gx - 12, z: gz - 8, mask: bitmaskAt(WALL_GRID, gx, gz) });
        }
      }
    }
    return result;
  }, []);

  return (
    <>
      {cells.map(({ x, z, mask }) => (
        <mesh key={`${x},${z}`} position={[x + 0.5, WALL_HEIGHT / 2, z + 0.5]}>
          <boxGeometry args={[1, WALL_HEIGHT, 1]} />
          <meshStandardMaterial map={getWallTileTexture(wallImage, mask)} />
        </mesh>
      ))}
    </>
  );
}
```

전체 벽 셀 수는 약 106개(외곽 76 + 내부 칸막이 30) — 이 규모의 씬에서
개별 메시로 렌더링해도 성능에 영향이 없다. 기존 `OUTER_COLOR`/
`DIVIDER_COLOR` 평면색 상수는 제거된다(텍스처가 대체).

## D. 바닥 — floor_N.png로 교체

`officeTextures.ts`의 `getFloorTexture()`가 지금 `drawFloorTile(ctx,
evenCell)`(절차적 2색 체커보드)를 호출하는 부분을, `floor_0.png`와
`floor_1.png` 두 이미지를 각각 짝수/홀수 셀에 `drawImage`로 그려 넣는
방식으로 교체한다. 2×2 체커보드 반복 텍스처 파이프라인(`RepeatWrapping`,
`.repeat.set(9,8)`)은 그대로 유지한다 — 절차적 그리기 호출만 실제 이미지
`drawImage` 호출로 바뀐다.

구체적으로 어떤 두 종(`floor_0`~`floor_8` 중)을 쓸지는 구현 단계에서
실제 이미지를 렌더링해 보고 기존 체커보드와 명도 대비가 자연스러운
조합을 고른다(스펙에서 특정 번호를 강제하지 않음 — 시각적 판단이 필요한
부분이라 구현 계획에서 후보 2~3쌍을 스크린샷으로 비교 후 확정).

## 변경/신규 파일 요약

수정:
- `ui/src/scene/Walls.tsx` — 사각형 리스트 + 그리드 래스터화 + 셀별
  박스 렌더링으로 전면 재작성. `OUTER_COLOR`/`DIVIDER_COLOR` 제거
- `ui/src/scene/officeTextures.ts` — `getFloorTexture()`가 `floor_N.png`
  이미지를 그리도록 교체

신규:
- `ui/src/scene/wallTiles.ts` — `WALL_RECTS`, `buildWallGrid`,
  `bitmaskAt`, `getWallTileTexture` + 유닛 테스트

애셋(이미 다운로드 완료, 커밋 필요):
- `ui/public/pixel-agents-assets/floors/floor_0.png`~`floor_8.png`(9개)
- `ui/public/pixel-agents-assets/walls/wall_0.png`(1개)

## 테스트 전략

- `wallTiles.ts` 유닛 테스트:
  - `buildWallGrid`가 `WALL_RECTS`로부터 예상한 총 벽 셀 수를 만드는지
  - `bitmaskAt`이 알려진 좌표(예: 외곽 모서리, T자 교차점, 문간 끝)에서
    예상 마스크값을 반환하는지 — 최소 각 방향 조합(고립/직선/모서리/T자/
    십자) 1개씩
  - `bitmaskAt`이 그리드 밖 이웃을 "벽 아님"으로 처리하는지(외곽 셀
    바깥쪽 마스크 비트가 0인지)
- 기존 vitest 스위트 전체 통과 확인 (`npm --prefix ui run test`)
- 수동 확인 (`npm run dev`):
  1. 문간 위치가 기존 레이아웃과 크게 어긋나지 않고 각 방에 통로가
     남아있는지
  2. 벽 모서리/T자 교차점이 부자연스러운 조각 없이 자연스럽게 이어지는지
  3. 바닥이 새 이미지 타일로 보이고 반복 패턴이 이상하지 않은지
  4. 캐릭터가 새 벽/바닥 위에서 기존과 동일하게 보이는지(1단계 결과에
     회귀 없음)

## 범위 밖 (Out of scope)

- 벽 그리드와 캐릭터 이동/충돌 로직 연동
- 바닥 타일 오토타일링
- 책상/그림자 텍스처 교체
