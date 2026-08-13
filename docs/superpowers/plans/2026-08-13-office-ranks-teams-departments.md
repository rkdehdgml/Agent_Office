# 직급/팀 표시 + 오프라인 숨김 + 부서 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a completed-count-based rank system with Korean team labels, always-present team-lead/HQ characters, a new "디자인퍼블리싱팀" department (real subagent + room), a break room that idle agents randomly visit, and fade-then-hide behavior for agents that go offline.

**Architecture:** Pure, independently-testable modules (`rank.ts`, `teamLabels.ts`, `officeLabel.ts`, `breakRoom.ts`) feed display/scheduling decisions into the existing R3F scene components (`CharacterActor.tsx`, `OfficeScene.tsx`, `Walls.tsx`, `deskLayout.ts`). The office floor plan grows from a 2×2 quadrant grid to a 3×2 grid (5 rooms + 1 open break room), sharing a full-width open corridor band at `z∈[-2,2]` the same way the current 2×2 design shares a central open square.

**Tech Stack:** React + react-three-fiber + drei + three.js, TypeScript, vitest (node environment).

## Global Constraints

- All new pure logic (`rank.ts`, `teamLabels.ts`, `officeLabel.ts`, `breakRoom.ts`) must have vitest unit tests — no DOM/jsdom, this project's vitest runs in node environment.
- Follow existing file conventions: one `Record<string, ...>` lookup + a small accessor function, matching `PALETTE`/`DEPARTMENT_COLOR`/`DESK_SLOTS` style already in the codebase.
- Walls remain purely visual — no collision/pathfinding is added (established in [[2026-08-12-isometric-office-camera-design]] and unchanged here).
- Work happens in the existing worktree/branch `isometric-office-camera` at `C:\Users\CEO\Desktop\AgentOffice\.worktrees\isometric-office-camera` (already isolated from `master`, already has the camera/walls/shadows work committed). All file paths below are relative to that worktree's repo root.
- Run `npm --prefix ui run test` after every task; it must stay green.

---

### Task 1: Rank pure function + `completedCount` tracking

**Files:**
- Modify: `ui/src/officeReducer.ts`
- Create: `ui/src/scene/rank.ts`
- Test: `ui/src/scene/rank.test.ts`

**Interfaces:**
- Produces: `Character.completedCount: number` (new field on the existing `Character` interface)
- Produces: `export type Rank = "사원" | "대리" | "과장"` and `export function rankFor(completedCount: number): Rank` from `ui/src/scene/rank.ts`

- [ ] **Step 1: Write the failing test for `rankFor`**

```ts
// ui/src/scene/rank.test.ts
import { describe, expect, it } from "vitest";
import { rankFor } from "./rank";

describe("rankFor", () => {
  it("returns 사원 for 0 completed tasks", () => {
    expect(rankFor(0)).toBe("사원");
  });

  it("returns 사원 for 2 completed tasks (below 대리 threshold)", () => {
    expect(rankFor(2)).toBe("사원");
  });

  it("returns 대리 for 3 completed tasks (대리 threshold)", () => {
    expect(rankFor(3)).toBe("대리");
  });

  it("returns 대리 for 5 completed tasks (below 과장 threshold)", () => {
    expect(rankFor(5)).toBe("대리");
  });

  it("returns 과장 for 6 completed tasks (과장 threshold)", () => {
    expect(rankFor(6)).toBe("과장");
  });

  it("returns 과장 for large completed counts", () => {
    expect(rankFor(100)).toBe("과장");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix ui run test -- rank.test.ts`
Expected: FAIL — `./rank` module does not exist

- [ ] **Step 3: Implement `rank.ts`**

```ts
// ui/src/scene/rank.ts
export type Rank = "사원" | "대리" | "과장";

export function rankFor(completedCount: number): Rank {
  if (completedCount >= 6) return "과장";
  if (completedCount >= 3) return "대리";
  return "사원";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix ui run test -- rank.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Add `completedCount` to `Character` and wire increment/reset in `officeReducer.ts`**

In `ui/src/officeReducer.ts`, modify the `Character` interface (currently lines 17-23):

```ts
export interface Character {
  agentId: string;
  agentType: string;
  status: CharacterStatus;
  previousStatus: CharacterStatus;
  active: boolean;
  completedCount: number;
}
```

Modify the default-character literal inside `updateCharacter` (currently lines 73-79) to include the new field:

```ts
  const existing: Character = room.characters[agentId] ?? {
    agentId,
    agentType,
    status: "작업 중",
    previousStatus: "작업 중",
    active: true,
    completedCount: 0,
  };
```

Modify the `SubagentStart` case (currently lines 112-118) to reset the count on a fresh dispatch:

```ts
    case "SubagentStart":
      return updateCharacter(next, agentType, agentId, (c) => ({
        ...c,
        status: "출근",
        previousStatus: "출근",
        active: true,
        completedCount: 0,
      }));
```

Modify the `PostToolUse` case (currently lines 128-134) to increment the count:

```ts
    case "PostToolUse":
      return updateCharacter(next, agentType, agentId, (c) => ({
        ...c,
        status: "완료 ✅",
        previousStatus: c.status,
        active: true,
        completedCount: c.completedCount + 1,
      }));
```

- [ ] **Step 6: Update `deskLayout.test.ts`'s character literal to include the new required field**

In `ui/src/scene/deskLayout.test.ts`, the `stateWithCharacters` helper (currently line 41) builds `Character` literals directly. Add the field:

```ts
              { agentId: id, agentType, status: ACTIVE, previousStatus: ACTIVE, active: true, completedCount: 0 },
```

- [ ] **Step 7: Run full test suite to verify no regressions**

Run: `npm --prefix ui run test`
Expected: PASS, all suites green

- [ ] **Step 8: Commit**

```bash
git add ui/src/officeReducer.ts ui/src/scene/rank.ts ui/src/scene/rank.test.ts ui/src/scene/deskLayout.test.ts
git commit -m "feat: add completedCount tracking and rankFor pure function"
```

---

### Task 2: Team display-name pure function

**Files:**
- Create: `ui/src/scene/teamLabels.ts`
- Test: `ui/src/scene/teamLabels.test.ts`

**Interfaces:**
- Consumes: `HQ_ROOM` from `../officeReducer` (existing export)
- Produces: `export function teamNameFor(agentType: string): string`

- [ ] **Step 1: Write the failing test**

```ts
// ui/src/scene/teamLabels.test.ts
import { describe, expect, it } from "vitest";
import { teamNameFor } from "./teamLabels";
import { HQ_ROOM } from "../officeReducer";

describe("teamNameFor", () => {
  it("maps research-dept to 리서치팀", () => {
    expect(teamNameFor("research-dept")).toBe("리서치팀");
  });

  it("maps planning-dept to 기획팀", () => {
    expect(teamNameFor("planning-dept")).toBe("기획팀");
  });

  it("maps dev-dept to 개발팀", () => {
    expect(teamNameFor("dev-dept")).toBe("개발팀");
  });

  it("maps design-publishing-dept to 디자인퍼블리싱팀", () => {
    expect(teamNameFor("design-publishing-dept")).toBe("디자인퍼블리싱팀");
  });

  it("maps HQ_ROOM to 본부", () => {
    expect(teamNameFor(HQ_ROOM)).toBe("본부");
  });

  it("falls back to the raw slug for an unknown department", () => {
    expect(teamNameFor("unknown-dept")).toBe("unknown-dept");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix ui run test -- teamLabels.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement `teamLabels.ts`**

```ts
// ui/src/scene/teamLabels.ts
import { HQ_ROOM } from "../officeReducer";

const TEAM_NAMES: Record<string, string> = {
  "research-dept": "리서치팀",
  "planning-dept": "기획팀",
  "dev-dept": "개발팀",
  "design-publishing-dept": "디자인퍼블리싱팀",
};

export function teamNameFor(agentType: string): string {
  if (agentType === HQ_ROOM) return "본부";
  return TEAM_NAMES[agentType] ?? agentType;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix ui run test -- teamLabels.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add ui/src/scene/teamLabels.ts ui/src/scene/teamLabels.test.ts
git commit -m "feat: add teamNameFor pure function for Korean team labels"
```

---

### Task 3: Combined label pure function

**Files:**
- Create: `ui/src/scene/officeLabel.ts`
- Test: `ui/src/scene/officeLabel.test.ts`

**Interfaces:**
- Consumes: `teamNameFor` from `./teamLabels` (Task 2), `rankFor`/`Rank` from `./rank` (Task 1), `HQ_ROOM` from `../officeReducer`
- Produces: `export function labelFor(agentType: string, completedCount: number, isFixed: boolean): string`

- [ ] **Step 1: Write the failing test**

```ts
// ui/src/scene/officeLabel.test.ts
import { describe, expect, it } from "vitest";
import { labelFor } from "./officeLabel";
import { HQ_ROOM } from "../officeReducer";

describe("labelFor", () => {
  it("always shows 부장 for HQ regardless of completedCount or isFixed", () => {
    expect(labelFor(HQ_ROOM, 0, false)).toBe("본부 · 부장");
    expect(labelFor(HQ_ROOM, 99, true)).toBe("본부 · 부장");
  });

  it("shows 팀장 for a fixed team-lead character regardless of completedCount", () => {
    expect(labelFor("dev-dept", 0, true)).toBe("개발팀 · 팀장");
    expect(labelFor("dev-dept", 99, true)).toBe("개발팀 · 팀장");
  });

  it("shows the earned rank for a non-fixed team character", () => {
    expect(labelFor("dev-dept", 0, false)).toBe("개발팀 · 사원");
    expect(labelFor("dev-dept", 3, false)).toBe("개발팀 · 대리");
    expect(labelFor("dev-dept", 6, false)).toBe("개발팀 · 과장");
  });

  it("uses the mapped team name for the new department", () => {
    expect(labelFor("design-publishing-dept", 0, false)).toBe("디자인퍼블리싱팀 · 사원");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix ui run test -- officeLabel.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement `officeLabel.ts`**

```ts
// ui/src/scene/officeLabel.ts
import { HQ_ROOM } from "../officeReducer";
import { teamNameFor } from "./teamLabels";
import { rankFor } from "./rank";

export function labelFor(agentType: string, completedCount: number, isFixed: boolean): string {
  const team = teamNameFor(agentType);
  if (agentType === HQ_ROOM) return `${team} · 부장`;
  const rank = isFixed ? "팀장" : rankFor(completedCount);
  return `${team} · ${rank}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix ui run test -- officeLabel.test.ts`
Expected: PASS (4 tests, 8 assertions)

- [ ] **Step 5: Commit**

```bash
git add ui/src/scene/officeLabel.ts ui/src/scene/officeLabel.test.ts
git commit -m "feat: add labelFor combining team name and rank/lead/HQ display"
```

---

### Task 4: New department subagent + color wiring

**Files:**
- Create: `.claude/agents/design-publishing-dept.md`
- Modify: `ui/src/scene/CharacterActor.tsx` (PALETTE only, no other changes in this task)
- Modify: `ui/src/scene/Desk.tsx` (DEPARTMENT_COLOR only)

**Interfaces:**
- Produces: subagent `name: design-publishing-dept`, callable the same way `dev-dept`/`planning-dept`/`research-dept` already are
- Produces: `PALETTE["design-publishing-dept"]` and `DEPARTMENT_COLOR["design-publishing-dept"]` entries other tasks can rely on existing

- [ ] **Step 1: Create the subagent definition**

```markdown
---
name: design-publishing-dept
description: 디자인 및 퍼블리싱 담당 서브에이전트. UI/화면 디자인과 퍼블리싱(마크업/스타일) 작업에 사용한다.
---

당신은 디자인 및 퍼블리싱 부서 담당자입니다. 화면/컴포넌트의 시각 디자인을 제안하고,
필요하면 HTML/CSS 마크업(퍼블리싱)까지 구현합니다. 기존 디자인 톤과 일관성을 유지합니다.
```

Save as `.claude/agents/design-publishing-dept.md`.

- [ ] **Step 2: Add the new department to `PALETTE` in `CharacterActor.tsx`**

In `ui/src/scene/CharacterActor.tsx`, modify the `PALETTE` record (currently lines 13-18):

```ts
const PALETTE: Record<string, { body: string; hair: string; skin: string; pants: string }> = {
  "research-dept": { body: "#3d7ea6", hair: "#3a2a20", skin: "#e8b98a", pants: "#26333d" },
  "planning-dept": { body: "#8a5cc2", hair: "#241a2e", skin: "#f0c9a0", pants: "#2e2438" },
  "dev-dept": { body: "#3fae6a", hair: "#1c1c1c", skin: "#e0ab7c", pants: "#22331f" },
  "design-publishing-dept": { body: "#c2547e", hair: "#2a1a20", skin: "#e8b98a", pants: "#3a2430" },
  [HQ_ROOM]: { body: "#b08d57", hair: "#3a2a20", skin: "#e8b98a", pants: "#4a3a28" },
};
```

- [ ] **Step 3: Add the new department to `DEPARTMENT_COLOR` in `Desk.tsx`**

In `ui/src/scene/Desk.tsx`, modify the `DEPARTMENT_COLOR` record (currently lines 5-10):

```ts
const DEPARTMENT_COLOR: Record<string, string> = {
  "research-dept": "#3d7ea6",
  "planning-dept": "#8a5cc2",
  "dev-dept": "#3fae6a",
  "design-publishing-dept": "#c2547e",
  [HQ_ROOM]: "#b08d57",
};
```

- [ ] **Step 4: Run full test suite to verify no regressions**

Run: `npm --prefix ui run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .claude/agents/design-publishing-dept.md ui/src/scene/CharacterActor.tsx ui/src/scene/Desk.tsx
git commit -m "feat: add design-publishing-dept subagent and its color palette"
```

---

### Task 5: Desk layout expansion — 5 rooms, team-lead slots, break room slots

**Files:**
- Modify: `ui/src/scene/deskLayout.ts`
- Modify: `ui/src/scene/deskLayout.test.ts`

**Interfaces:**
- Produces: `DESK_SLOTS` covering `research-dept`, `planning-dept`, `dev-dept`, `design-publishing-dept` (3 slots each), `[HQ_ROOM]` (1 slot)
- Produces: `export function leadSlotFor(agentType: string): Vec2` — one fixed desk position per team, for the 4 non-HQ departments
- Produces: `export const BREAK_ROOM_SLOTS: Vec2[]` — 2 fixed standing positions inside the break room

The new floor plan is a 3-column × 2-row grid, outer bounds `x∈[-12,12]`, `z∈[-8,8]` (24×16). Column centers: `x=-8` (col1), `x=0` (col2), `x=8` (col3). Row centers: `z=-4` (row1/top), `z=4` (row2/bottom). Layout:

| | col1 (x=-8) | col2 (x=0) | col3 (x=8) |
|---|---|---|---|
| row1 (z=-4) | research-dept | planning-dept | design-publishing-dept |
| row2 (z=4) | dev-dept | HQ_ROOM | (break room, no desks) |

- [ ] **Step 1: Write the failing tests for the new/changed slot data**

Add to `ui/src/scene/deskLayout.test.ts` (append after the existing `describe("homePositionFor", ...)` block):

```ts
describe("deskSlotsFor — 5-room layout", () => {
  it("gives the new design-publishing-dept 3 slots like the other teams", () => {
    expect(deskSlotsFor("design-publishing-dept").length).toBe(3);
  });

  it("gives HQ exactly 1 slot", () => {
    expect(deskSlotsFor(HQ_ROOM).length).toBe(1);
  });
});

describe("leadSlotFor", () => {
  it("returns a distinct fixed position for each of the 4 teams", () => {
    const positions = ["research-dept", "planning-dept", "dev-dept", "design-publishing-dept"].map(leadSlotFor);
    const unique = new Set(positions.map((p) => `${p.x},${p.z}`));
    expect(unique.size).toBe(4);
  });

  it("never overlaps a team's own earned-rank desk slots", () => {
    for (const dept of ["research-dept", "planning-dept", "dev-dept", "design-publishing-dept"]) {
      const lead = leadSlotFor(dept);
      const earned = deskSlotsFor(dept);
      expect(earned).not.toContainEqual(lead);
    }
  });
});

describe("BREAK_ROOM_SLOTS", () => {
  it("has exactly 2 distinct positions", () => {
    expect(BREAK_ROOM_SLOTS.length).toBe(2);
    expect(BREAK_ROOM_SLOTS[0]).not.toEqual(BREAK_ROOM_SLOTS[1]);
  });
});
```

Update the import line at the top of the file to include the new exports:

```ts
import { deskPositionFor, deskSlotsFor, homePositionFor, leadSlotFor, BREAK_ROOM_SLOTS } from "./deskLayout";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix ui run test -- deskLayout.test.ts`
Expected: FAIL — `leadSlotFor`/`BREAK_ROOM_SLOTS` not exported, HQ slot count is 3 not 1

- [ ] **Step 3: Rewrite `deskLayout.ts`**

```ts
import { HQ_ROOM } from "../officeReducer";
import type { OfficeState } from "../officeReducer";

export interface Vec2 {
  x: number;
  z: number;
}

const DESK_SLOTS: Record<string, Vec2[]> = {
  "research-dept": [
    { x: -10, z: -6 },
    { x: -8, z: -6 },
    { x: -6, z: -6 },
  ],
  "planning-dept": [
    { x: -2, z: -6 },
    { x: 0, z: -6 },
    { x: 2, z: -6 },
  ],
  "design-publishing-dept": [
    { x: 6, z: -6 },
    { x: 8, z: -6 },
    { x: 10, z: -6 },
  ],
  "dev-dept": [
    { x: -10, z: 6 },
    { x: -8, z: 6 },
    { x: -6, z: 6 },
  ],
  [HQ_ROOM]: [{ x: 0, z: 6 }],
};

const DEFAULT_SLOTS: Vec2[] = [
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: -1, z: 0 },
];

const LEAD_SLOTS: Record<string, Vec2> = {
  "research-dept": { x: -8, z: -7 },
  "planning-dept": { x: 0, z: -7 },
  "design-publishing-dept": { x: 8, z: -7 },
  "dev-dept": { x: -8, z: 7 },
};

const DEFAULT_LEAD_SLOT: Vec2 = { x: 0, z: 0 };

export const BREAK_ROOM_SLOTS: Vec2[] = [
  { x: 7, z: 4 },
  { x: 9, z: 4 },
];

export function deskSlotsFor(agentType: string): Vec2[] {
  return DESK_SLOTS[agentType] ?? DEFAULT_SLOTS;
}

export function deskPositionFor(agentType: string, orderIndex: number): Vec2 {
  const slots = deskSlotsFor(agentType);
  return slots[orderIndex % slots.length];
}

/**
 * The fixed desk position for a team's always-present team-lead character.
 * Reserved separately from `DESK_SLOTS` so the earned-rank cycling in
 * `deskPositionFor` never assigns a real dynamic character into a
 * team-lead's seat.
 */
export function leadSlotFor(agentType: string): Vec2 {
  return LEAD_SLOTS[agentType] ?? DEFAULT_LEAD_SLOT;
}

/**
 * The fixed "home desk" position for a specific character, derived from
 * their room membership order (stable sort of agentIds within the room).
 * Falls back to slot 0 if the room/character doesn't exist yet in `state`
 * — this happens routinely for a split second right after a SubagentStart
 * event, since the walker system computes a target position synchronously
 * (from the raw event stream) before React has re-rendered the reducer's
 * state; slot 0 is an acceptable approximation for that brief window.
 */
export function homePositionFor(state: OfficeState, agentType: string, agentId: string): Vec2 {
  const room = state.rooms[agentType];
  if (!room) return deskPositionFor(agentType, 0);
  const orderedIds = Object.keys(room.characters).sort();
  const index = orderedIds.indexOf(agentId);
  return deskPositionFor(agentType, index === -1 ? 0 : index);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix ui run test -- deskLayout.test.ts`
Expected: PASS, all cases including pre-existing ones

- [ ] **Step 5: Run full test suite to verify no regressions**

Run: `npm --prefix ui run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add ui/src/scene/deskLayout.ts ui/src/scene/deskLayout.test.ts
git commit -m "feat: expand desk layout to 5 rooms with team-lead and break room slots"
```

---

### Task 6: Walls — 3×2 grid with open corridor and open break room

**Files:**
- Modify: `ui/src/scene/Walls.tsx`

**Interfaces:**
- No exported API change — `Walls` remains a zero-prop component. Geometry must match the floor bounds this task defines (`x∈[-12,12]`, `z∈[-8,8]`), which Task 7 also uses for the floor plane and desk/character positions.

- [ ] **Step 1: Rewrite `Walls.tsx`**

```tsx
const WALL_HEIGHT = 1.6;
const WALL_THICKNESS = 0.25;
const OUTER_COLOR = "#3c4562";
const DIVIDER_COLOR = "#57608a";

export function Walls() {
  return (
    <>
      {/* Outer perimeter: floor is 24 (x) x 16 (z), centered at origin */}
      <mesh position={[0, WALL_HEIGHT / 2, -8]}>
        <boxGeometry args={[24, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2, 8]}>
        <boxGeometry args={[24, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>
      <mesh position={[-12, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 16]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>
      <mesh position={[12, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 16]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>

      {/* Column divider at x=-4 (research/dev on the left vs. planning/HQ on
          the right), split top/bottom to leave the shared corridor band
          z in [-2,2] open */}
      <mesh position={[-4, WALL_HEIGHT / 2, -5]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 6]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>
      <mesh position={[-4, WALL_HEIGHT / 2, 5]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 6]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>

      {/* Column divider at x=4 (planning/HQ vs. design-publishing). Only the
          top segment exists — the bottom segment would sit between HQ and
          the break room, and the break room stays open on all sides */}
      <mesh position={[4, WALL_HEIGHT / 2, -5]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 6]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>

      {/* Row divider at z=0 (top row vs. bottom row), broken into 3 short
          wall slivers so each column keeps a 4-wide doorway onto the shared
          corridor band. x in [4,12] (design-publishing/break room column) is
          left fully open — no sliver there — so the break room has no walls
          around it at all. */}
      <mesh position={[-11, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[2, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>
      <mesh position={[-4, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[4, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>
      <mesh position={[3, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[2, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>
    </>
  );
}
```

- [ ] **Step 2: Run full test suite to verify no regressions**

Run: `npm --prefix ui run test`
Expected: PASS (no test covers `Walls.tsx` directly — this is a visual-only component, verified manually in Task 7)

- [ ] **Step 3: Commit**

```bash
git add ui/src/scene/Walls.tsx
git commit -m "feat: rewrite Walls for 3x2 room grid with open break room"
```

---

### Task 7: Wire the 3×2 layout into `OfficeScene` (floor, desks, camera retune)

**Files:**
- Modify: `ui/src/scene/OfficeScene.tsx`
- Modify: `ui/src/scene/Props.tsx`

**Interfaces:**
- Consumes: `deskSlotsFor` from Task 5, `Walls` from Task 6
- No new exports — this task makes the scene render the expanded floor plan and adds break-room decor props.

- [ ] **Step 1: Update `DEPARTMENTS`, floor size, and camera in `OfficeScene.tsx`**

In `ui/src/scene/OfficeScene.tsx`, modify the `DEPARTMENTS` list (currently line 14):

```ts
const DEPARTMENTS = ["research-dept", "planning-dept", "dev-dept", "design-publishing-dept", HQ_ROOM];
```

Modify the floor `planeGeometry` args (currently `args={[18, 16]}` at line 33) to match the new 24×16 floor:

```tsx
        <planeGeometry args={[24, 16]} />
```

Modify the camera radius/zoom constants area. `CAMERA_TILT_DEG`/`CAMERA_AZIMUTH_DEG` stay from `cameraGeometry.ts` unchanged; only the radius/zoom passed into `OfficeScene.tsx` need retuning for the wider floor. Change the `OrthographicCamera` line (currently line 29) and the `CAMERA_POSITION` computation (currently line 16):

```ts
const CAMERA_POSITION = cameraPositionForTilt(CAMERA_TILT_DEG, CAMERA_AZIMUTH_DEG, 30);
```

```tsx
      <OrthographicCamera makeDefault position={CAMERA_POSITION} zoom={29} onUpdate={(cam) => cam.lookAt(0, 0, 0)} />
```

(These are starting values based on the floor's x-extent growing from 18 to 24, ~1.33x wider: `24 → radius 30` keeps the same distance-to-size ratio as the original `18 → radius 24`, and `zoom 38 / 1.33 ≈ 29` compensates so the wider floor still fits the viewport. Step 4 below verifies this visually and allows adjustment — orthographic framing at a tilt isn't a simple linear formula, so treat these as a starting point, not a guarantee.)

- [ ] **Step 2: Add break room decor to `Props.tsx`**

In `ui/src/scene/Props.tsx`, add a plant and water cooler inside the break room area (centered around `x=8, z=4`, matching Task 5's `BREAK_ROOM_SLOTS`). Modify the `Props()` function (currently lines 3-11):

```tsx
export function Props() {
  return (
    <>
      <Plant position={[-8, 0, -7]} />
      <Plant position={[8, 0, 7]} />
      <WaterCooler position={[0, 0, 6.5]} />
      <Plant position={[11, 0, 7]} />
      <WaterCooler position={[5, 0, 4]} />
    </>
  );
}
```

- [ ] **Step 3: Run full test suite to verify no regressions**

Run: `npm --prefix ui run test`
Expected: PASS

- [ ] **Step 4: Manually verify the layout in the browser**

Run: `npm --prefix ui run dev` (reuse the already-running event server on 4000/4001 if present; kill any stale Vite instance serving a different checkout first)

Open the app and confirm:
1. 6 cells are visible in a 3-column × 2-row grid: research/planning/design-publishing on top, dev/HQ/break-room on bottom.
2. The break room (bottom-right) has no walls around it and shows a plant + water cooler.
3. The whole floor fits in the viewport without being cut off or looking tiny — if not, adjust `zoom`/radius from Step 1 and re-check.

- [ ] **Step 5: Commit**

```bash
git add ui/src/scene/OfficeScene.tsx ui/src/scene/Props.tsx
git commit -m "feat: wire 3x2 room layout into OfficeScene with retuned camera"
```

---

### Task 8: Team-lead/HQ fixed characters + label composition

**Files:**
- Create: `ui/src/scene/teamLeadCharacters.ts`
- Modify: `ui/src/scene/CharacterActor.tsx`
- Modify: `ui/src/scene/OfficeScene.tsx`
- Modify: `ui/src/scene/StatusLabel.tsx`

**Interfaces:**
- Consumes: `leadSlotFor` (Task 5), `labelFor` (Task 3)
- Produces: `export const TEAM_LEAD_TYPES: string[]` from `teamLeadCharacters.ts` — the 4 non-HQ department slugs that get a fixed 팀장
- `CharacterActor` gains a new optional prop `isFixed?: boolean` (default `false`)

- [ ] **Step 1: Create `teamLeadCharacters.ts`**

```ts
// ui/src/scene/teamLeadCharacters.ts
export const TEAM_LEAD_TYPES: string[] = [
  "research-dept",
  "planning-dept",
  "dev-dept",
  "design-publishing-dept",
];
```

- [ ] **Step 2: Thread `isFixed` and `labelFor` through `CharacterActor.tsx`**

In `ui/src/scene/CharacterActor.tsx`, add the import:

```ts
import { labelFor } from "./officeLabel";
```

Modify the component signature (currently lines 31-39) to accept `isFixed`:

```tsx
export function CharacterActor({
  character,
  home,
  commandsRef,
  isFixed = false,
}: {
  character: Character;
  home: Vec2;
  commandsRef: React.MutableRefObject<Map<string, WalkCommand>>;
  isFixed?: boolean;
}) {
```

Replace the `key`/label line (currently line 48, `const key = ...` stays, but the raw slug-based label goes away) and the `<StatusLabel>` usage (currently line 130). Replace:

```tsx
      <StatusLabel name={key} status={character.status} active={character.active} />
```

with:

```tsx
      <StatusLabel
        name={labelFor(character.agentType, character.completedCount, isFixed)}
        status={character.status}
        active={character.active}
      />
```

- [ ] **Step 3: Render `TEAM_LEAD_TYPES` as fixed characters in `OfficeScene.tsx`**

In `ui/src/scene/OfficeScene.tsx`, add imports:

```ts
import { TEAM_LEAD_TYPES } from "./teamLeadCharacters";
import { leadSlotFor } from "./deskLayout";
```

Add the fixed-character rendering, plus a physical desk for each team lead (so the lead doesn't stand in empty space), right before the existing `{characters.map(...)}` block (currently starting at line 41):

```tsx
      {TEAM_LEAD_TYPES.map((agentType) => (
        <Desk key={`lead-desk-${agentType}`} position={leadSlotFor(agentType)} agentType={agentType} />
      ))}
      {TEAM_LEAD_TYPES.map((agentType) => (
        <CharacterActor
          key={`lead-${agentType}`}
          character={{
            agentId: `lead-${agentType}`,
            agentType,
            status: "출근",
            previousStatus: "출근",
            active: true,
            completedCount: 0,
          }}
          home={leadSlotFor(agentType)}
          commandsRef={commandsRef}
          isFixed
        />
      ))}
```

- [ ] **Step 4: Confirm `StatusLabel` still works unmodified**

`ui/src/scene/StatusLabel.tsx` already takes `name: string` and renders it verbatim — no change needed. This step is a no-op confirmation, not a code change.

- [ ] **Step 5: Run full test suite to verify no regressions**

Run: `npm --prefix ui run test`
Expected: PASS

- [ ] **Step 6: Manually verify in the browser**

Run: `npm --prefix ui run dev`

Confirm:
1. Each of the 4 team rooms always shows one "팀장" character even with no active subagent dispatch.
2. HQ always shows its character labeled "본부 · 부장" once any HQ event has fired (unchanged HQ creation behavior).
3. A real dispatched subagent shows a label like "개발팀 · 사원" instead of the old `dev-dept/<id>` raw text.

- [ ] **Step 7: Commit**

```bash
git add ui/src/scene/teamLeadCharacters.ts ui/src/scene/CharacterActor.tsx ui/src/scene/OfficeScene.tsx
git commit -m "feat: render fixed team-lead characters and Korean team+rank labels"
```

---

### Task 9: Offline characters fade out, then hide

**Files:**
- Modify: `ui/src/scene/CharacterActor.tsx`

**Interfaces:**
- No exported API change. Internal behavior only: when a non-fixed character's `active` flips `true → false`, the sprite fades out over 1.5s and then the group is hidden (not unmounted).

- [ ] **Step 1: Add fade-out state and remove the instant gray/translucent look**

In `ui/src/scene/CharacterActor.tsx`, remove the now-unused instant-inactive styling. Delete these two lines (currently lines 20-21):

```ts
const INACTIVE_COLOR = "#767676";
const INACTIVE_PALETTE = { body: INACTIVE_COLOR, hair: INACTIVE_COLOR, skin: INACTIVE_COLOR, pants: INACTIVE_COLOR };
```

Add a fade duration constant near the other constants (currently lines 23-27):

```ts
const FADE_DURATION_MS = 1500;
```

Add fade-tracking refs alongside the existing refs (currently lines 40-46):

```ts
  const groupRef = useRef<Group>(null);
  const posRef = useRef<Vec2>({ x: home.x, z: home.z });
  const phaseRef = useRef<LocalPhase>("idle");
  const targetRef = useRef<Vec2>(home);
  const phaseStartedAtRef = useRef<number>(performance.now());
  const appliedCommandRef = useRef<WalkCommand | null>(null);
  const [renderPhase, setRenderPhase] = useState<LocalPhase>("idle");
  const wasActiveRef = useRef<boolean>(character.active);
  const fadeStartedAtRef = useRef<number | null>(null);
  const hiddenRef = useRef<boolean>(false);
  const materialRef = useRef<SpriteMaterial>(null);
```

Add the `SpriteMaterial` type import (currently `import type { Group } from "three";` at line 3):

```ts
import type { Group, SpriteMaterial } from "three";
```

- [ ] **Step 2: Detect the active→false transition and drive opacity inside `useFrame`**

Inside the existing `useFrame((_, delta) => { ... })` callback (currently lines 51-115), add fade handling right before the final `if (!groupRef.current) return;` block (currently line 109):

```ts
    if (!isFixed && wasActiveRef.current && !character.active) {
      fadeStartedAtRef.current = now;
    }
    wasActiveRef.current = character.active;

    if (!isFixed && fadeStartedAtRef.current !== null) {
      const elapsed = now - fadeStartedAtRef.current;
      const opacity = Math.max(0, 1 - elapsed / FADE_DURATION_MS);
      if (materialRef.current) materialRef.current.opacity = opacity;
      if (opacity <= 0) hiddenRef.current = true;
    }

    if (groupRef.current) groupRef.current.visible = !hiddenRef.current;
```

- [ ] **Step 3: Simplify the sprite palette/opacity JSX now that instant-inactive styling is gone**

Modify the palette line (currently line 118, `const spritePalette = character.active ? palette : INACTIVE_PALETTE;`):

```ts
  const texture = useCharacterSpriteTexture(palette, clip);
```

(This replaces both the old `spritePalette` variable and the `texture` line below it — delete the old `const spritePalette = ...` line entirely, and the old `const texture = useCharacterSpriteTexture(spritePalette, clip);` line.)

Modify the `<sprite>` JSX (currently lines 127-129) to use the material ref and start at full opacity (fade is driven imperatively via `materialRef` in `useFrame`, not via a `character.active` ternary, so a freshly-inactive character still renders at opacity 1 for the first frame of its fade):

```tsx
      <sprite scale={[0.9, 1.25, 1]} position={[0, 0.65, 0]}>
        <spriteMaterial ref={materialRef} map={texture} transparent opacity={1} />
      </sprite>
```

- [ ] **Step 4: Run full test suite to verify no regressions**

Run: `npm --prefix ui run test`
Expected: PASS (no existing test renders `CharacterActor` directly — this project's vitest suite runs in node environment without a DOM/WebGL context, so this component's behavior is verified manually)

- [ ] **Step 5: Manually verify in the browser**

Run: `npm --prefix ui run dev`, dispatch a subagent, let it finish (SubagentStop / "퇴근").

Confirm:
1. The character does NOT disappear or turn gray instantly.
2. Over about 1.5 seconds it fades out in its normal team color, then vanishes completely.
3. Team-lead/HQ fixed characters are unaffected (never fade, always fully visible).

- [ ] **Step 6: Commit**

```bash
git add ui/src/scene/CharacterActor.tsx
git commit -m "feat: fade out offline characters instead of instant gray/translucent"
```

---

### Task 10: Break room — idle agents randomly visit and return

**Files:**
- Create: `ui/src/scene/breakRoom.ts`
- Test: `ui/src/scene/breakRoom.test.ts`
- Create: `ui/src/scene/useBreakRoomScheduler.ts`
- Modify: `ui/src/scene/useWalkerCommands.ts`
- Modify: `ui/src/scene/CharacterActor.tsx`
- Modify: `ui/src/scene/OfficeScene.tsx`

**Interfaces:**
- Consumes: `Character`/`OfficeState` from `../officeReducer`, `BREAK_ROOM_SLOTS`/`homePositionFor` from `./deskLayout` (Task 5), `WalkCommand` from `./useWalkerCommands`
- Produces: `export function isIdleForBreakRoom(character: Character): boolean` and `export function pickBreakRoomVisitors(state: OfficeState, alreadyVisitingKeys: Set<string>, maxVisitors: number, random?: () => number): Array<{ agentType: string; agentId: string }>` from `breakRoom.ts`
- Produces: `export function useBreakRoomScheduler(state: OfficeState, commandsRef: React.MutableRefObject<Map<string, WalkCommand>>): void` from `useBreakRoomScheduler.ts`
- Modifies: `WalkCommand` gains optional `waitDurationMs?: number`

- [ ] **Step 1: Write the failing tests for the pure selection logic**

```ts
// ui/src/scene/breakRoom.test.ts
import { describe, expect, it } from "vitest";
import { isIdleForBreakRoom, pickBreakRoomVisitors } from "./breakRoom";
import { initialOfficeState } from "../officeReducer";
import type { Character, OfficeState } from "../officeReducer";

function char(overrides: Partial<Character>): Character {
  return {
    agentId: "a",
    agentType: "dev-dept",
    status: "출근",
    previousStatus: "출근",
    active: true,
    completedCount: 0,
    ...overrides,
  };
}

describe("isIdleForBreakRoom", () => {
  it("is true for an active character still at 출근 status", () => {
    expect(isIdleForBreakRoom(char({ status: "출근", active: true }))).toBe(true);
  });

  it("is false once the character has picked up any work", () => {
    expect(isIdleForBreakRoom(char({ status: "작업 중", active: true }))).toBe(false);
  });

  it("is false for an inactive (offline) character", () => {
    expect(isIdleForBreakRoom(char({ status: "출근", active: false }))).toBe(false);
  });
});

describe("pickBreakRoomVisitors", () => {
  function stateWith(chars: Character[]): OfficeState {
    const state = initialOfficeState();
    for (const c of chars) {
      state.rooms[c.agentType] = state.rooms[c.agentType] ?? { agentType: c.agentType, characters: {} };
      state.rooms[c.agentType].characters[c.agentId] = c;
    }
    return state;
  }

  it("returns nothing when there are no idle candidates", () => {
    const state = stateWith([char({ agentId: "a", status: "작업 중" })]);
    expect(pickBreakRoomVisitors(state, new Set(), 2)).toEqual([]);
  });

  it("returns nothing once maxVisitors is already reached", () => {
    const state = stateWith([char({ agentId: "a", status: "출근" })]);
    const alreadyVisiting = new Set(["dev-dept/x", "dev-dept/y"]);
    expect(pickBreakRoomVisitors(state, alreadyVisiting, 2)).toEqual([]);
  });

  it("never re-picks a character already visiting", () => {
    const state = stateWith([char({ agentId: "a", status: "출근" })]);
    const alreadyVisiting = new Set(["dev-dept/a"]);
    expect(pickBreakRoomVisitors(state, alreadyVisiting, 2)).toEqual([]);
  });

  it("picks up to the remaining free slots, using the injected random function", () => {
    const state = stateWith([
      char({ agentId: "a", status: "출근" }),
      char({ agentId: "b", status: "출근" }),
      char({ agentId: "c", status: "출근" }),
    ]);
    const picks = pickBreakRoomVisitors(state, new Set(), 2, () => 0.5);
    expect(picks.length).toBe(2);
    const ids = picks.map((p) => p.agentId);
    expect(new Set(ids).size).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix ui run test -- breakRoom.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement `breakRoom.ts`**

```ts
// ui/src/scene/breakRoom.ts
import type { Character, OfficeState } from "../officeReducer";

export function isIdleForBreakRoom(character: Character): boolean {
  return character.active && character.status === "출근";
}

export function pickBreakRoomVisitors(
  state: OfficeState,
  alreadyVisitingKeys: Set<string>,
  maxVisitors: number,
  random: () => number = Math.random
): Array<{ agentType: string; agentId: string }> {
  const slotsFree = maxVisitors - alreadyVisitingKeys.size;
  if (slotsFree <= 0) return [];

  const candidates = Object.values(state.rooms)
    .flatMap((room) => Object.values(room.characters))
    .filter((c) => isIdleForBreakRoom(c) && !alreadyVisitingKeys.has(`${c.agentType}/${c.agentId}`));

  const shuffled = [...candidates].sort(() => random() - 0.5);
  return shuffled.slice(0, slotsFree).map((c) => ({ agentType: c.agentType, agentId: c.agentId }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix ui run test -- breakRoom.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Add `waitDurationMs` to `WalkCommand` and use it in `CharacterActor.tsx`'s greeting timeout**

In `ui/src/scene/useWalkerCommands.ts`, modify the `WalkCommand` interface (currently lines 10-17):

```ts
export interface WalkCommand {
  phase: WalkPhase;
  role: "caller" | "partner";
  target: Vec2;
  home: Vec2;
  phaseStartedAt: number;
  partnerKey?: string;
  waitDurationMs?: number;
}
```

In `ui/src/scene/CharacterActor.tsx`, modify the greeting-timeout check inside `useFrame` (currently lines 94-107, the `else if (phaseRef.current === "greeting")` branch):

```ts
    } else if (phaseRef.current === "greeting") {
      const waitDuration = appliedCommandRef.current?.waitDurationMs ?? GREETING_DURATION_MS;
      if (now - phaseStartedAtRef.current >= waitDuration) {
```

(Only the `if` condition line changes — the rest of that branch's body is unchanged.)

- [ ] **Step 6: Implement `useBreakRoomScheduler.ts`**

```ts
// ui/src/scene/useBreakRoomScheduler.ts
import { useEffect, useRef } from "react";
import { pickBreakRoomVisitors } from "./breakRoom";
import { homePositionFor, BREAK_ROOM_SLOTS } from "./deskLayout";
import type { OfficeState } from "../officeReducer";
import type { WalkCommand } from "./useWalkerCommands";

const CHECK_INTERVAL_MS = 15000;
const MAX_VISITORS = 2;
const MIN_WAIT_MS = 60000;
const MAX_WAIT_MS = 180000;

export function useBreakRoomScheduler(
  state: OfficeState,
  commandsRef: React.MutableRefObject<Map<string, WalkCommand>>
) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const visitingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => {
      for (const key of visitingRef.current) {
        if (!commandsRef.current.has(key)) visitingRef.current.delete(key);
      }

      const picks = pickBreakRoomVisitors(stateRef.current, visitingRef.current, MAX_VISITORS);
      picks.forEach((pick) => {
        const key = `${pick.agentType}/${pick.agentId}`;
        const home = homePositionFor(stateRef.current, pick.agentType, pick.agentId);
        const slotIndex = visitingRef.current.size % BREAK_ROOM_SLOTS.length;
        commandsRef.current.set(key, {
          phase: "walking-to-visit",
          role: "caller",
          target: BREAK_ROOM_SLOTS[slotIndex],
          home,
          phaseStartedAt: performance.now(),
          waitDurationMs: MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS),
        });
        visitingRef.current.add(key);
      });
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [commandsRef]);
}
```

- [ ] **Step 7: Wire the scheduler into `OfficeScene.tsx`**

Add the import:

```ts
import { useBreakRoomScheduler } from "./useBreakRoomScheduler";
```

Call it inside the `OfficeScene` component body, before the `return (...)` (right after the existing `const characters = ...` line):

```ts
  useBreakRoomScheduler(state, commandsRef);
```

- [ ] **Step 8: Run full test suite to verify no regressions**

Run: `npm --prefix ui run test`
Expected: PASS

- [ ] **Step 9: Manually verify in the browser**

Run: `npm --prefix ui run dev`, dispatch a subagent and let it sit idle right after `SubagentStart` (before any tool call) for at least 15 seconds.

Confirm:
1. Within ~15 seconds, the idle character may walk to the break room (near the plant/water cooler at the bottom-right cell).
2. It stays there roughly 1-3 minutes, then walks back to its desk on its own.
3. At most 2 characters are ever in the break room at once.

- [ ] **Step 10: Commit**

```bash
git add ui/src/scene/breakRoom.ts ui/src/scene/breakRoom.test.ts ui/src/scene/useBreakRoomScheduler.ts ui/src/scene/useWalkerCommands.ts ui/src/scene/CharacterActor.tsx ui/src/scene/OfficeScene.tsx
git commit -m "feat: add break room with random idle-agent visits"
```

---

## Final verification

- [ ] Run `npm --prefix ui run test` one more time end-to-end — full suite green.
- [ ] Run through the full manual checklist from Tasks 7, 8, 9, and 10 together in one `npm run dev` session, since they interact visually (layout + labels + fade-out + break room all on screen at once).
