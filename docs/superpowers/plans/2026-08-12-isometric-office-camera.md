# Isometric Office Camera + Room Walls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the office scene's vertical top-down camera with a fixed 50°-tilt quarter-view camera, add visible walls that separate the four department rooms (with a center gap so the existing cross-department visit animation doesn't clip through them), and add blob shadows so characters/furniture read as grounded instead of floating.

**Architecture:** Same react-three-fiber (R3F) app, same `officeReducer` / `useWalkerCommands` / `deskLayout` logic — this plan only touches the rendering layer. A new pure `cameraGeometry.ts` module computes the camera's fixed position from tilt/azimuth constants (unit-testable). A new `Walls.tsx` component adds outer + divider wall meshes. A new shadow-texture generator in `officeTextures.ts` is consumed by `CharacterActor.tsx`, `Desk.tsx`, and `Props.tsx`.

**Tech Stack:** React 18, react-three-fiber 8 / three.js 0.169 (existing dependency), `@react-three/drei` 9 (existing dependency), vitest (existing test runner, node environment — no jsdom).

## Global Constraints

- Reuse `useWalkerCommands`, `deskLayout.ts`, `officeReducer.ts` exactly as-is — this plan is presentation-layer only, do not change movement/state logic.
- Camera is fixed (tilt 50°, azimuth 45°, radius 24) — no user-facing orbit/zoom/drag controls. These are out of scope per `docs/superpowers/specs/2026-08-12-isometric-office-camera-design.md`.
- Walls are purely visual — no collision detection or pathfinding. The center 4×4 gap (x and z both in `[-2, 2]`) exists specifically so the straight-line walk animation in `useWalkerCommands.ts` doesn't visually clip through wall geometry; do not add per-desk-pair routing.
- No real-time shadow mapping (`Canvas shadows={false}` stays as-is) — shadows are flat alpha-blended "blob" planes, matching the spec's explicit rejection of shadow-map performance cost.
- Tests run in vitest's default **node** environment (no DOM/canvas). Only `cameraGeometry.ts` gets unit tests (pure math, no browser APIs) — canvas/Three.js-touching code (`officeTextures.ts`, `Walls.tsx`, the shadow meshes in `CharacterActor.tsx`/`Desk.tsx`/`Props.tsx`) stays untested, matching the existing convention (`Desk.tsx`, `Props.tsx`, `CharacterActor.tsx` have no test files today).
- The throwaway preview spike currently sitting **uncommitted** in `ui/src/scene/OfficeScene.tsx` (`TiltPreviewCamera`, `PreviewWalls`, arrow-key tilt adjustment) must be fully removed and replaced by the constant-based implementation from this plan — none of that spike code should remain or get committed.

---

### Task 1: Camera geometry pure function

**Files:**
- Create: `ui/src/scene/cameraGeometry.ts`
- Test: `ui/src/scene/cameraGeometry.test.ts`

**Interfaces:**
- Consumes: nothing (pure math).
- Produces: `CAMERA_TILT_DEG`, `CAMERA_AZIMUTH_DEG`, `CAMERA_RADIUS` constants and `cameraPositionForTilt(tiltDeg: number, azimuthDeg: number, radius: number): [number, number, number]` — used by Task 3 (`OfficeScene.tsx`).

- [ ] **Step 1: Write the failing test**

```ts
// ui/src/scene/cameraGeometry.test.ts
import { describe, expect, it } from "vitest";
import { CAMERA_AZIMUTH_DEG, CAMERA_RADIUS, CAMERA_TILT_DEG, cameraPositionForTilt } from "./cameraGeometry";

describe("cameraPositionForTilt", () => {
  it("sits directly overhead when tilt is 0, regardless of azimuth", () => {
    const [x, y, z] = cameraPositionForTilt(0, 45, 10);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(10, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it("sits at ground level along the azimuth direction when tilt is 90", () => {
    const [x, y, z] = cameraPositionForTilt(90, 0, 10);
    expect(x).toBeCloseTo(10, 5);
    expect(y).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it("matches the confirmed office camera position (tilt 50, azimuth 45, radius 24)", () => {
    const [x, y, z] = cameraPositionForTilt(50, 45, 24);
    expect(x).toBeCloseTo(13.0, 1);
    expect(y).toBeCloseTo(15.43, 1);
    expect(z).toBeCloseTo(13.0, 1);
  });

  it("exports the confirmed constants used by the scene", () => {
    expect(CAMERA_TILT_DEG).toBe(50);
    expect(CAMERA_AZIMUTH_DEG).toBe(45);
    expect(CAMERA_RADIUS).toBe(24);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `ui/`): `npm run test -- cameraGeometry`
Expected: FAIL — `Cannot find module './cameraGeometry'`

- [ ] **Step 3: Write minimal implementation**

```ts
// ui/src/scene/cameraGeometry.ts

/** Fixed quarter-view camera, chosen interactively via a preview spike — see
 * docs/superpowers/specs/2026-08-12-isometric-office-camera-design.md */
export const CAMERA_TILT_DEG = 50;
export const CAMERA_AZIMUTH_DEG = 45;
export const CAMERA_RADIUS = 24;

export function cameraPositionForTilt(
  tiltDeg: number,
  azimuthDeg: number,
  radius: number
): [number, number, number] {
  const tilt = (tiltDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;
  return [radius * Math.sin(tilt) * Math.cos(az), radius * Math.cos(tilt), radius * Math.sin(tilt) * Math.sin(az)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- cameraGeometry`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add ui/src/scene/cameraGeometry.ts ui/src/scene/cameraGeometry.test.ts
git commit -m "Add pure camera-position function for the fixed quarter-view angle"
```

---

### Task 2: Room walls component

**Files:**
- Create: `ui/src/scene/Walls.tsx`

**Interfaces:**
- Consumes: nothing (self-contained geometry using the same coordinate space as `OfficeScene.tsx`'s floor plane: x in `[-9, 9]`, z in `[-8, 8]`, centered at the origin).
- Produces: `Walls` component (default export style matching `Props.tsx`: a named function component with no props) — used by Task 3 (`OfficeScene.tsx`).

The floor is an 18×16 plane centered at the origin (`ui/src/scene/OfficeScene.tsx:28-31`, unchanged by this plan). The four department quadrants split at `x=0` and `z=0` (`ui/src/scene/deskLayout.ts:9-30` — desks always have `|x| >= 2` and `|z| >= 2`, so a center gap of `[-2, 2]` on both axes never overlaps a desk). Divider walls are split into two segments per axis to leave that 4×4 center square fully open, so the straight-line cross-department walk in `useWalkerCommands.ts` never visually clips through a wall.

- [ ] **Step 1: Write the component**

```tsx
// ui/src/scene/Walls.tsx
const WALL_HEIGHT = 1.6;
const WALL_THICKNESS = 0.25;
const OUTER_COLOR = "#1b2130";
const DIVIDER_COLOR = "#2a2f42";

export function Walls() {
  return (
    <>
      {/* Outer perimeter */}
      <mesh position={[0, WALL_HEIGHT / 2, -8]}>
        <boxGeometry args={[18, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2, 8]}>
        <boxGeometry args={[18, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>
      <mesh position={[-9, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 16]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>
      <mesh position={[9, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 16]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>

      {/* x=0 divider (research/dev on the left vs. planning/HQ on the right),
          split around z=0 to leave the center 4x4 square open */}
      <mesh position={[0, WALL_HEIGHT / 2, -5]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 6]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2, 5]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 6]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>

      {/* z=0 divider (research/planning on top vs. dev/HQ on the bottom),
          split around x=0 to leave the center 4x4 square open */}
      <mesh position={[-5.5, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[7, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>
      <mesh position={[5.5, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[7, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/scene/Walls.tsx
git commit -m "Add room-dividing walls with a center gap for cross-department walks"
```

(No test step: this is a pure R3F geometry component with no logic to unit-test, matching the existing convention for `Desk.tsx`/`Props.tsx`. It's verified visually in Task 6.)

---

### Task 3: Wire the fixed camera and walls into the scene, remove the preview spike

**Files:**
- Modify: `ui/src/scene/OfficeScene.tsx`

**Interfaces:**
- Consumes: `cameraPositionForTilt`, `CAMERA_TILT_DEG`, `CAMERA_AZIMUTH_DEG`, `CAMERA_RADIUS` from Task 1 (`./cameraGeometry`); `Walls` from Task 2 (`./Walls`).
- Produces: nothing new for later tasks — this is the final assembly point.

The current file (with the uncommitted preview spike) has `TiltPreviewCamera`, `PreviewWalls`, and their `useState`/`useEffect`/`Html` imports. This step deletes all of that and replaces it with the confirmed constant-based camera plus the real `Walls` component.

- [ ] **Step 1: Replace the file contents**

```tsx
// ui/src/scene/OfficeScene.tsx
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { Desk } from "./Desk";
import { Props } from "./Props";
import { Walls } from "./Walls";
import { CharacterActor } from "./CharacterActor";
import { deskSlotsFor, homePositionFor } from "./deskLayout";
import { HQ_ROOM } from "../officeReducer";
import type { OfficeState } from "../officeReducer";
import type { WalkCommand } from "./useWalkerCommands";
import { getFloorTexture } from "./officeTextures";
import { CAMERA_AZIMUTH_DEG, CAMERA_RADIUS, CAMERA_TILT_DEG, cameraPositionForTilt } from "./cameraGeometry";

const DEPARTMENTS = ["research-dept", "planning-dept", "dev-dept", HQ_ROOM];

const CAMERA_POSITION = cameraPositionForTilt(CAMERA_TILT_DEG, CAMERA_AZIMUTH_DEG, CAMERA_RADIUS);

export function OfficeScene({
  state,
  commandsRef,
}: {
  state: OfficeState;
  commandsRef: React.MutableRefObject<Map<string, WalkCommand>>;
}) {
  const characters = Object.values(state.rooms).flatMap((room) => Object.values(room.characters));

  return (
    <Canvas shadows={false}>
      <OrthographicCamera makeDefault position={CAMERA_POSITION} zoom={38} onUpdate={(cam) => cam.lookAt(0, 0, 0)} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 16]} />
        <meshStandardMaterial map={getFloorTexture()} />
      </mesh>
      <Walls />
      {DEPARTMENTS.flatMap((dept) =>
        deskSlotsFor(dept).map((slot, i) => <Desk key={`desk-${dept}-${i}`} position={slot} agentType={dept} />)
      )}
      <Props />
      {characters.map((character) => (
        <CharacterActor
          key={`${character.agentType}/${character.agentId}`}
          character={character}
          home={homePositionFor(state, character.agentType, character.agentId)}
          commandsRef={commandsRef}
        />
      ))}
    </Canvas>
  );
}
```

- [ ] **Step 2: Confirm the spike is gone**

Run: `grep -n "TiltPreviewCamera\|PreviewWalls" ui/src/scene/OfficeScene.tsx`
Expected: no matches.

- [ ] **Step 3: Run the full test suite**

Run (from `ui/`): `npm run test`
Expected: all existing suites still pass (this task doesn't touch tested logic, only the camera/wall wiring).

- [ ] **Step 4: Commit**

```bash
git add ui/src/scene/OfficeScene.tsx
git commit -m "Switch office scene to the fixed 50-degree quarter-view camera"
```

---

### Task 4: Blob shadow texture and character shadow

**Files:**
- Modify: `ui/src/scene/officeTextures.ts`
- Modify: `ui/src/scene/CharacterActor.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `getShadowTexture(): CanvasTexture` from `officeTextures.ts` — also used by Task 5 (`Desk.tsx`, `Props.tsx`).

- [ ] **Step 1: Add the shadow texture generator**

Add to `ui/src/scene/officeTextures.ts` (after the existing `getDeskTopTexture` function, keeping the same `import` line at the top which already includes `CanvasTexture`, `SRGBColorSpace`):

```ts
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

- [ ] **Step 2: Add a shadow plane under the character sprite**

In `ui/src/scene/CharacterActor.tsx`, add the import:

```ts
import { getShadowTexture } from "./officeTextures";
```

Then add a shadow `<mesh>` as the first child inside the returned `<group>` (`ui/src/scene/CharacterActor.tsx:120-127`), before the `<sprite>`:

```tsx
  return (
    <group ref={groupRef} position={[home.x, 0, home.z]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial map={getShadowTexture()} transparent depthWrite={false} />
      </mesh>
      <sprite scale={[0.9, 1.25, 1]} position={[0, 0.65, 0]}>
        <spriteMaterial map={texture} transparent opacity={character.active ? 1 : 0.5} />
      </sprite>
      <StatusLabel name={key} status={character.status} active={character.active} />
    </group>
  );
```

Note: the shadow mesh is a child of the same `<group>` whose `position.y` is animated for the idle bob (`ui/src/scene/CharacterActor.tsx:113`), so it will bob very slightly (±0.08 units) along with the sprite. That's an accepted trade-off for this plan — decoupling the shadow from the bob would require moving it outside the group and duplicating the walk-position tracking, which isn't worth it for an 8cm wobble.

- [ ] **Step 3: Commit**

```bash
git add ui/src/scene/officeTextures.ts ui/src/scene/CharacterActor.tsx
git commit -m "Add blob shadow texture and ground characters with it"
```

---

### Task 5: Blob shadows for desks and props

**Files:**
- Modify: `ui/src/scene/Desk.tsx`
- Modify: `ui/src/scene/Props.tsx`

**Interfaces:**
- Consumes: `getShadowTexture` from Task 4 (`./officeTextures`).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Add a shadow plane under each desk**

In `ui/src/scene/Desk.tsx`, add the import:

```ts
import { getShadowTexture } from "./officeTextures";
```

Add a shadow `<mesh>` as the first child inside the `<group>` (`ui/src/scene/Desk.tsx:15-16`), before the desktop `<mesh>`:

```tsx
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.3, 0.9]} />
        <meshBasicMaterial map={getShadowTexture()} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[1.2, 0.5, 0.8]} />
        <meshStandardMaterial map={getDeskTopTexture()} />
      </mesh>
      <mesh position={[0, 0.65, -0.1]}>
        <boxGeometry args={[0.4, 0.3, 0.05]} />
        <meshStandardMaterial color="#1c1c1c" />
      </mesh>
      <mesh position={[0, 0.51, 0.42]}>
        <boxGeometry args={[0.3, 0.02, 0.15]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
```

- [ ] **Step 2: Add a shadow plane under each prop**

Replace the full contents of `ui/src/scene/Props.tsx`:

```tsx
import { getShadowTexture } from "./officeTextures";

export function Props() {
  return (
    <>
      <Plant position={[-8, 0, -7]} />
      <Plant position={[8, 0, 7]} />
      <WaterCooler position={[0, 0, 6.5]} />
    </>
  );
}

function Shadow({ size }: { size: number }) {
  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={getShadowTexture()} transparent depthWrite={false} />
    </mesh>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Shadow size={0.7} />
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.6, 8]} />
        <meshStandardMaterial color="#6b4f3a" />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial color="#3fae6a" />
      </mesh>
    </group>
  );
}

function WaterCooler({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Shadow size={0.55} />
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 1, 10]} />
        <meshStandardMaterial color="#dbe6ea" />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 3: Run the full test suite**

Run (from `ui/`): `npm run test`
Expected: all existing suites still pass (no logic touched, only JSX geometry).

- [ ] **Step 4: Commit**

```bash
git add ui/src/scene/Desk.tsx ui/src/scene/Props.tsx
git commit -m "Ground desks and props with blob shadows"
```

---

### Task 6: End-to-end verification

**Files:** None (verification only — if something's broken, fix forward in the relevant file from Tasks 1-5, then re-run this task's checks).

- [ ] **Step 1: Run the full automated test suite**

Run (from `ui/`): `npm run test`
Expected: all tests pass, including the new `cameraGeometry` suite.

- [ ] **Step 2: Check whether the dev stack is already running**

Run: check for existing listeners on the known ports before starting anything —

```bash
netstat -ano | grep -E ":(4000|4001|5173|5174)\b"
```

- If nothing is listening: start it yourself in the background — `npm run dev` from the repo root (starts the event server on :4000/:4001 and the Vite UI dev server, normally :5173 but may fall back to :5174 if that port is already held).
- If something is already listening: reuse it, do not start a second one.
- If you find duplicate/stale listeners: stop them first (`taskkill /PID <pid> /F` using the PID from `netstat`), then start a fresh `npm run dev`.

- [ ] **Step 3: Inject a cross-department visit via curl**

This exercises the exact path the wall center-gap in Task 2 was designed for: a caller in `research-dept` (quadrant x<0, z<0) walking to visit a target in `planning-dept` (quadrant x>0, z<0) — straight across the x=0 divider.

```bash
curl -X POST localhost:4000/events -H "Content-Type: application/json" -d '{"hook_event_name":"SubagentStart","agent_id":"verify-caller","agent_type":"research-dept"}'
curl -X POST localhost:4000/events -H "Content-Type: application/json" -d '{"hook_event_name":"PreToolUse","agent_id":"verify-caller","agent_type":"research-dept","tool_name":"Agent"}'
curl -X POST localhost:4000/events -H "Content-Type: application/json" -d '{"hook_event_name":"SubagentStart","agent_id":"verify-target","agent_type":"planning-dept"}'
```

- [ ] **Step 4: Open the UI in a real browser and visually confirm**

Open `http://localhost:5173` (or `:5174` if that's where Vite landed) and confirm:
- The camera is a tilted quarter-view (not flat top-down, not a fully side-on view) and the whole floor + all four rooms are visible in the scene container.
- Four rooms are visually separated by walls, with a clearly open crossroads area in the center (not fully boxed in).
- Within ~1.5s of the third curl call, `verify-caller` walks from its research-dept desk, through the open center gap, to `verify-target`'s planning-dept desk — without visually clipping through either divider wall — then walks back after the greeting pause.
- Characters, desks, and props all have a soft dark shadow blob under them and don't look like they're floating above the floor.

- [ ] **Step 5: Clean up the verification agents**

```bash
curl -X POST localhost:4000/events -H "Content-Type: application/json" -d '{"hook_event_name":"SubagentStop","agent_id":"verify-caller","agent_type":"research-dept"}'
curl -X POST localhost:4000/events -H "Content-Type: application/json" -d '{"hook_event_name":"SubagentStop","agent_id":"verify-target","agent_type":"planning-dept"}'
```

- [ ] **Step 6: Report results**

If every check in Step 4 passes: report done, no commit needed for this task (verification-only). If any check fails: fix forward in the owning file, re-run the full test suite (Step 1), and re-verify (Steps 3-5) before reporting done.
