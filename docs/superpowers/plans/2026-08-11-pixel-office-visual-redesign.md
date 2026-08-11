# Pixel-Art Topdown Office Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the office scene's voxel/perspective rendering with an orthographic top-down camera and billboard sprite characters, matching the Pixel Agents reference style, while reusing all existing movement/state logic unchanged.

**Architecture:** Same react-three-fiber (R3F) app, same `officeReducer` / `useWalkerCommands` / `deskLayout` logic. Only the rendering layer changes: `PerspectiveCamera` → `OrthographicCamera`, box-geometry characters → camera-facing sprite billboards driven by a new pure `animationClipFor` mapping, plus a new floating name/status label and a default-muted sound layer.

**Tech Stack:** React 18, react-three-fiber 8 / three.js 0.169 (already a dependency), `@react-three/drei` 9 (already a dependency, used here for `<Html>`), vitest (existing test runner, node environment — no jsdom).

## Global Constraints

- Reuse `useWalkerCommands`, `deskLayout.ts`, `officeReducer.ts`, and the walking/greeting phase logic exactly as-is — do not change their behavior, only consume their outputs from the new rendering layer.
- Office layout editor (user-editable floor/wall/furniture placement) is explicitly out of scope.
- Sound effects default to **muted**; the user opts in via a toggle button. No persistence required across reloads.
- Character art for this plan is **procedurally generated pixel art** (canvas-drawn, matches the technique already validated with the user via a live browser demo during brainstorming) — not the real MetroCity/Kenney asset packs. Those require a manual browser-based download from itch.io/kenney.nl that cannot be scripted reliably from this environment (verified: itch.io's free-asset download flow needs an interactive claim step, not a stable direct URL). Task 10 documents the manual swap-in procedure for later; the app must look and behave correctly with the procedural art in the meantime.
- Tests run in vitest's default **node** environment (no DOM/canvas). Keep pure logic (status→clip/sound mapping, mute state) in files with no browser API calls so they stay unit-testable; canvas/Three.js-touching code stays untested, matching the existing convention (`Desk.tsx`, `Props.tsx`, `CharacterActor.tsx` have no test files today).
- `CharacterStatus` (from `ui/src/officeReducer.ts`) is the single source of truth for status strings — do not invent new status values.

---

### Task 1: Animation clip mapping

**Files:**
- Create: `ui/src/scene/animationClip.ts`
- Test: `ui/src/scene/animationClip.test.ts`

**Interfaces:**
- Consumes: `CharacterStatus` from `ui/src/officeReducer.ts` (existing).
- Produces: `AnimationClip` type (`"idle" | "walk" | "read" | "type" | "alert"`) and `animationClipFor(status, phase, active)` — used by Task 6 (`CharacterActor.tsx`).

- [ ] **Step 1: Write the failing test**

```ts
// ui/src/scene/animationClip.test.ts
import { describe, expect, it } from "vitest";
import { animationClipFor } from "./animationClip";

describe("animationClipFor", () => {
  it("returns 'read' for research/search statuses", () => {
    expect(animationClipFor("자료 찾는 중 🔍", "idle", true)).toBe("read");
    expect(animationClipFor("검색 중 🌐", "idle", true)).toBe("read");
  });

  it("returns 'type' for the writing status", () => {
    expect(animationClipFor("작성 중 ✍️", "idle", true)).toBe("type");
  });

  it("returns 'alert' for the failure status", () => {
    expect(animationClipFor("문제 발생 ⚠️", "idle", true)).toBe("alert");
  });

  it("returns 'walk' whenever the character is mid-walk, regardless of status", () => {
    expect(animationClipFor("작성 중 ✍️", "walking-to-visit", true)).toBe("walk");
    expect(animationClipFor("문제 발생 ⚠️", "walking-back", true)).toBe("walk");
  });

  it("falls back to 'idle' for statuses with no dedicated clip", () => {
    expect(animationClipFor("출근", "idle", true)).toBe("idle");
    expect(animationClipFor("명령 실행 중 ⚙️", "idle", true)).toBe("idle");
    expect(animationClipFor("업무 지시 중 📋", "idle", true)).toBe("idle");
    expect(animationClipFor("작업 중", "idle", true)).toBe("idle");
    expect(animationClipFor("완료 ✅", "idle", true)).toBe("idle");
    expect(animationClipFor("퇴근", "idle", true)).toBe("idle");
    expect(animationClipFor("지시 접수 📨", "idle", true)).toBe("idle");
    expect(animationClipFor("업무 종료", "idle", true)).toBe("idle");
  });

  it("returns 'idle' for an inactive character even mid-walk-status", () => {
    expect(animationClipFor("작성 중 ✍️", "walking-to-visit", false)).toBe("idle");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `ui/`): `npm run test -- animationClip`
Expected: FAIL — `Cannot find module './animationClip'`

- [ ] **Step 3: Write minimal implementation**

```ts
// ui/src/scene/animationClip.ts
import type { CharacterStatus } from "../officeReducer";

export type AnimationClip = "idle" | "walk" | "read" | "type" | "alert";

type WalkPhase = "idle" | "walking-to-visit" | "greeting" | "walking-back";

const STATUS_CLIP: Partial<Record<CharacterStatus, AnimationClip>> = {
  "자료 찾는 중 🔍": "read",
  "검색 중 🌐": "read",
  "작성 중 ✍️": "type",
  "문제 발생 ⚠️": "alert",
};

export function animationClipFor(status: CharacterStatus, phase: WalkPhase, active: boolean): AnimationClip {
  if (!active) return "idle";
  if (phase === "walking-to-visit" || phase === "walking-back") return "walk";
  return STATUS_CLIP[status] ?? "idle";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- animationClip`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add ui/src/scene/animationClip.ts ui/src/scene/animationClip.test.ts
git commit -m "Add status-to-animation-clip mapping for pixel sprite redesign"
```

---

### Task 2: Speech-bubble status rule

**Files:**
- Create: `ui/src/scene/statusLabelRules.ts`
- Test: `ui/src/scene/statusLabelRules.test.ts`

**Interfaces:**
- Consumes: `CharacterStatus` from `ui/src/officeReducer.ts`.
- Produces: `isSpeechBubbleStatus(status)` — used by Task 7 (`StatusLabel.tsx`).

- [ ] **Step 1: Write the failing test**

```ts
// ui/src/scene/statusLabelRules.test.ts
import { describe, expect, it } from "vitest";
import { isSpeechBubbleStatus } from "./statusLabelRules";
import type { CharacterStatus } from "../officeReducer";

const ALL_STATUSES: CharacterStatus[] = [
  "출근",
  "자료 찾는 중 🔍",
  "작성 중 ✍️",
  "명령 실행 중 ⚙️",
  "검색 중 🌐",
  "업무 지시 중 📋",
  "작업 중",
  "완료 ✅",
  "문제 발생 ⚠️",
  "퇴근",
  "지시 접수 📨",
  "업무 종료",
];

describe("isSpeechBubbleStatus", () => {
  it("is true only for the failure status", () => {
    expect(isSpeechBubbleStatus("문제 발생 ⚠️")).toBe(true);
    for (const status of ALL_STATUSES.filter((s) => s !== "문제 발생 ⚠️")) {
      expect(isSpeechBubbleStatus(status)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- statusLabelRules`
Expected: FAIL — `Cannot find module './statusLabelRules'`

- [ ] **Step 3: Write minimal implementation**

```ts
// ui/src/scene/statusLabelRules.ts
import type { CharacterStatus } from "../officeReducer";

/**
 * The hook events wired today (see officeReducer.ts) don't include a
 * "waiting for permission" state, so the speech-bubble treatment only
 * applies to the failure status for now.
 */
export function isSpeechBubbleStatus(status: CharacterStatus): boolean {
  return status === "문제 발생 ⚠️";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- statusLabelRules`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add ui/src/scene/statusLabelRules.ts ui/src/scene/statusLabelRules.test.ts
git commit -m "Add speech-bubble status rule for character name tags"
```

---

### Task 3: Sound mapping and mute controller

**Files:**
- Create: `ui/src/audio/sfx.ts`
- Test: `ui/src/audio/sfx.test.ts`

**Interfaces:**
- Consumes: `CharacterStatus` from `ui/src/officeReducer.ts`.
- Produces: `SoundId` type (`"complete" | "failure" | "leave"`), `sfxForStatusChange(previous, current)`, `createSfxController(playSound)` returning `{ isMuted(), toggleMute(), play(soundId) }` — used by Task 8.

- [ ] **Step 1: Write the failing test**

```ts
// ui/src/audio/sfx.test.ts
import { describe, expect, it, vi } from "vitest";
import { createSfxController, sfxForStatusChange } from "./sfx";

describe("sfxForStatusChange", () => {
  it("maps entering '완료 ✅' to 'complete'", () => {
    expect(sfxForStatusChange("작업 중", "완료 ✅")).toBe("complete");
  });

  it("maps entering '문제 발생 ⚠️' to 'failure'", () => {
    expect(sfxForStatusChange("출근", "문제 발생 ⚠️")).toBe("failure");
  });

  it("maps entering '퇴근' to 'leave'", () => {
    expect(sfxForStatusChange("작업 중", "퇴근")).toBe("leave");
  });

  it("returns null when the status didn't change", () => {
    expect(sfxForStatusChange("완료 ✅", "완료 ✅")).toBeNull();
  });

  it("returns null for statuses with no sound mapped", () => {
    expect(sfxForStatusChange("출근", "작성 중 ✍️")).toBeNull();
  });
});

describe("createSfxController", () => {
  it("defaults to muted", () => {
    const controller = createSfxController(vi.fn());
    expect(controller.isMuted()).toBe(true);
  });

  it("does not invoke playSound while muted", () => {
    const playSound = vi.fn();
    const controller = createSfxController(playSound);
    controller.play("complete");
    expect(playSound).not.toHaveBeenCalled();
  });

  it("invokes playSound after unmuting", () => {
    const playSound = vi.fn();
    const controller = createSfxController(playSound);
    controller.toggleMute();
    expect(controller.isMuted()).toBe(false);
    controller.play("complete");
    expect(playSound).toHaveBeenCalledWith("complete");
  });

  it("toggleMute flips back to muted on a second call", () => {
    const controller = createSfxController(vi.fn());
    controller.toggleMute();
    controller.toggleMute();
    expect(controller.isMuted()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- sfx`
Expected: FAIL — `Cannot find module './sfx'`

- [ ] **Step 3: Write minimal implementation**

```ts
// ui/src/audio/sfx.ts
import type { CharacterStatus } from "../officeReducer";

export type SoundId = "complete" | "failure" | "leave";

const STATUS_SOUND: Partial<Record<CharacterStatus, SoundId>> = {
  "완료 ✅": "complete",
  "문제 발생 ⚠️": "failure",
  "퇴근": "leave",
};

export function sfxForStatusChange(previous: CharacterStatus, current: CharacterStatus): SoundId | null {
  if (previous === current) return null;
  return STATUS_SOUND[current] ?? null;
}

export interface SfxController {
  isMuted(): boolean;
  toggleMute(): void;
  play(soundId: SoundId): void;
}

export function createSfxController(playSound: (soundId: SoundId) => void): SfxController {
  let muted = true;
  return {
    isMuted: () => muted,
    toggleMute: () => {
      muted = !muted;
    },
    play: (soundId: SoundId) => {
      if (!muted) playSound(soundId);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- sfx`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add ui/src/audio/sfx.ts ui/src/audio/sfx.test.ts
git commit -m "Add sound mapping and default-muted sfx controller"
```

---

### Task 4: Procedural pixel sprite texture pipeline

**Files:**
- Create: `ui/src/scene/pixelSprite.ts`
- Create: `ui/src/scene/useCharacterSpriteTexture.ts`

**Interfaces:**
- Consumes: `AnimationClip` from Task 1.
- Produces: `CharacterPalette` type, `SPRITE_WIDTH`/`SPRITE_HEIGHT` constants, `drawCharacterFrame(ctx, palette, frame)`; `useCharacterSpriteTexture(palette, clip)` React hook returning a `THREE.CanvasTexture` — used by Task 6 (`CharacterActor.tsx`).
- No test file: this task only touches Canvas 2D / three.js APIs, which aren't available in the vitest node environment — consistent with `Desk.tsx`/`Props.tsx` having no tests today. Verified visually in Task 11.

- [ ] **Step 1: Write the pixel sprite drawing module**

```ts
// ui/src/scene/pixelSprite.ts
export const SPRITE_WIDTH = 16;
export const SPRITE_HEIGHT = 22;

export interface CharacterPalette {
  body: string;
  hair: string;
  skin: string;
  pants: string;
}

/**
 * Two walk frames (legs alternate) plus a static idle/read/type/alert pose
 * (frame 0) are enough for the current animation set — see animationClip.ts.
 */
export function drawCharacterFrame(ctx: CanvasRenderingContext2D, palette: CharacterPalette, frame: 0 | 1): void {
  ctx.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT);
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  px(4, 0, 8, 2, palette.hair);
  px(5, 2, 6, 4, palette.skin);
  px(3, 6, 10, 8, palette.body);
  const armSwing = frame === 1 ? 1 : 0;
  px(1, 7 + armSwing, 2, 6, palette.skin);
  px(13, 7 + (1 - armSwing), 2, 6, palette.skin);
  if (frame === 0) {
    px(4, 14, 3, 7, palette.pants);
    px(9, 14, 3, 7, palette.pants);
  } else {
    px(3, 14, 3, 8, palette.pants);
    px(10, 14, 3, 6, palette.pants);
  }
}
```

- [ ] **Step 2: Write the texture hook**

```ts
// ui/src/scene/useCharacterSpriteTexture.ts
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, NearestFilter } from "three";
import { drawCharacterFrame, SPRITE_HEIGHT, SPRITE_WIDTH } from "./pixelSprite";
import type { CharacterPalette } from "./pixelSprite";
import type { AnimationClip } from "./animationClip";

const WALK_FRAME_INTERVAL_MS = 220;

/**
 * Returns a live CanvasTexture for a character. Frame 0 is used for every
 * clip except "walk", which alternates 0/1 on a timer to animate legs.
 */
export function useCharacterSpriteTexture(palette: CharacterPalette, clip: AnimationClip): CanvasTexture {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  if (!canvasRef.current) {
    const canvas = document.createElement("canvas");
    canvas.width = SPRITE_WIDTH;
    canvas.height = SPRITE_HEIGHT;
    canvasRef.current = canvas;
  }

  const texture = useMemo(() => {
    const tex = new CanvasTexture(canvasRef.current!);
    tex.magFilter = NearestFilter;
    tex.minFilter = NearestFilter;
    return tex;
  }, []);

  const frameRef = useRef<0 | 1>(0);

  useEffect(() => {
    const ctx = canvasRef.current!.getContext("2d")!;
    if (clip !== "walk") {
      frameRef.current = 0;
      drawCharacterFrame(ctx, palette, 0);
      texture.needsUpdate = true;
      return;
    }
    const id = setInterval(() => {
      frameRef.current = frameRef.current === 0 ? 1 : 0;
      drawCharacterFrame(ctx, palette, frameRef.current);
      texture.needsUpdate = true;
    }, WALK_FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [palette, clip, texture]);

  return texture;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build` (from `ui/`)
Expected: succeeds with no TypeScript errors (this only compiles; Task 6 wires it into a visible component).

- [ ] **Step 4: Commit**

```bash
git add ui/src/scene/pixelSprite.ts ui/src/scene/useCharacterSpriteTexture.ts
git commit -m "Add procedural pixel sprite drawing and texture hook"
```

---

### Task 5: Orthographic top-down camera

**Files:**
- Modify: `ui/src/scene/OfficeScene.tsx:1-24`

**Interfaces:**
- No new exports; internal camera setup only.

- [ ] **Step 1: Replace the perspective camera with an orthographic top-down one**

In `ui/src/scene/OfficeScene.tsx`, change the import and the `<Canvas>` contents:

```tsx
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
```

Replace:

```tsx
<PerspectiveCamera makeDefault position={[14, 16, 14]} fov={35} onUpdate={(cam) => cam.lookAt(0, 0, 0)} />
```

with:

```tsx
<OrthographicCamera makeDefault position={[0, 20, 0.01]} zoom={38} onUpdate={(cam) => cam.lookAt(0, 0, 0)} />
```

(`z=0.01` instead of `0` avoids a degenerate up-vector when looking straight down the Y axis. `zoom` controls how much floor is visible — 38 is a starting point tuned in Task 11's manual check; adjust there if the whole floor doesn't fit in the 640px-tall `.scene-container`.)

- [ ] **Step 2: Typecheck**

Run: `npm run build` (from `ui/`)
Expected: succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add ui/src/scene/OfficeScene.tsx
git commit -m "Switch office camera from isometric perspective to orthographic top-down"
```

---

### Task 6: Sprite billboard characters

**Files:**
- Modify: `ui/src/scene/CharacterActor.tsx` (full rewrite of the render body; keep the existing `useFrame` movement/phase logic at lines 45-104 unchanged)

**Interfaces:**
- Consumes: `animationClipFor` (Task 1), `useCharacterSpriteTexture` + `CharacterPalette` (Task 4).
- Produces: no new exports — `CharacterActor` keeps its existing prop signature `{ character, home, commandsRef }`.

- [ ] **Step 1: Replace the box-mesh JSX with a sprite, driven by the animation clip**

Keep everything in `CharacterActor.tsx` above the `return` statement (lines 1-110, the movement/phase `useFrame` logic) unchanged. Only replace the imports and the returned JSX:

```tsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { HQ_ROOM } from "../officeReducer";
import type { Character } from "../officeReducer";
import type { Vec2 } from "./deskLayout";
import type { WalkCommand } from "./useWalkerCommands";
import { animationClipFor } from "./animationClip";
import { useCharacterSpriteTexture } from "./useCharacterSpriteTexture";
import { StatusLabel } from "./StatusLabel";

// ... PALETTE / DEFAULT_PALETTE / INACTIVE_COLOR / timing constants unchanged ...
```

At the end of the component, track the current `LocalPhase` in a small piece of render state so it can drive `animationClipFor` (the existing code only keeps phase in a ref, which doesn't trigger re-renders — add a mirrored `useState` that's updated wherever `phaseRef.current` is assigned inside `useFrame`):

```tsx
const [renderPhase, setRenderPhase] = useState<LocalPhase>("idle");
```

Add `setRenderPhase(phaseRef.current)` immediately after every `phaseRef.current = ...` assignment inside the existing `useFrame` callback (there are 4: on command apply, on arriving at a visit target, on finishing a greeting as caller, on finishing a greeting as partner/idle-return). Import `useState` from `"react"` alongside the existing `useRef` import.

Replace the returned JSX (previously five `<mesh>` boxes) with:

```tsx
  const clip = animationClipFor(character.status, renderPhase, character.active);
  const spritePalette = character.active ? palette : { body: INACTIVE_COLOR, hair: INACTIVE_COLOR, skin: INACTIVE_COLOR, pants: INACTIVE_COLOR };
  const texture = useCharacterSpriteTexture(spritePalette, clip);

  return (
    <group ref={groupRef} position={[home.x, 0, home.z]}>
      <sprite scale={[0.9, 1.25, 1]} position={[0, 0.65, 0]}>
        <spriteMaterial map={texture} transparent opacity={character.active ? 1 : 0.5} />
      </sprite>
      <StatusLabel name={key} status={character.status} active={character.active} />
    </group>
  );
```

Remove the now-unused `skinColor`/`bodyColor`/`hairColor`/`pantsColor`/`opacity` local variables that only fed the deleted `<mesh>` elements (keep `PALETTE`, `DEFAULT_PALETTE`, `INACTIVE_COLOR` themselves — still used above).

Also export the `LocalPhase` type (currently a local, unexported type alias) so it's a single source of truth:

```ts
export type LocalPhase = "idle" | "walking-to-visit" | "greeting" | "walking-back";
```

- [ ] **Step 2: Typecheck**

Run: `npm run build` (from `ui/`)
Expected: fails only on the missing `./StatusLabel` import (created in Task 7) — confirm the error is exactly that and nothing else in this file.

- [ ] **Step 3: Commit**

```bash
git add ui/src/scene/CharacterActor.tsx
git commit -m "Render characters as animated pixel sprite billboards"
```

(This task's build will go green once Task 7 adds `StatusLabel.tsx` — that's expected; the two are sequenced this way because `CharacterActor` is the more complex, higher-risk change and should be reviewed on its own.)

---

### Task 7: Floating name/status label

**Files:**
- Create: `ui/src/scene/StatusLabel.tsx`
- Modify: `ui/src/App.css` (append label styles)

**Interfaces:**
- Consumes: `isSpeechBubbleStatus` (Task 2), `CharacterStatus` (existing).
- Produces: `StatusLabel` component with props `{ name: string; status: CharacterStatus; active: boolean }` — consumed by Task 6's `CharacterActor.tsx`.

- [ ] **Step 1: Write the component**

```tsx
// ui/src/scene/StatusLabel.tsx
import { Html } from "@react-three/drei";
import type { CharacterStatus } from "../officeReducer";
import { isSpeechBubbleStatus } from "./statusLabelRules";

export function StatusLabel({ name, status, active }: { name: string; status: CharacterStatus; active: boolean }) {
  if (!active) return null;
  const bubble = isSpeechBubbleStatus(status);
  return (
    <Html position={[0, 1.5, 0]} center distanceFactor={8} zIndexRange={[10, 0]}>
      <div className={`office-label${bubble ? " office-label--bubble" : ""}`}>
        <div className="office-label__name">{name}</div>
        <div className="office-label__status">{status}</div>
      </div>
    </Html>
  );
}
```

- [ ] **Step 2: Append CSS**

Add to the end of `ui/src/App.css`:

```css
.office-label {
  pointer-events: none;
  background: rgba(20, 16, 12, 0.85);
  color: #f4e9d8;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.15);
  text-align: center;
}
.office-label__name { font-weight: 700; }
.office-label__status { opacity: 0.85; }
.office-label--bubble {
  background: #f4e9d8;
  color: #2b2420;
  border-radius: 10px;
  border: none;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build` (from `ui/`)
Expected: succeeds (this also resolves the import Task 6 was left waiting on).

- [ ] **Step 4: Commit**

```bash
git add ui/src/scene/StatusLabel.tsx ui/src/App.css
git commit -m "Add floating name/status label above each character"
```

---

### Task 8: Wire up sound playback and the mute toggle

**Files:**
- Create: `ui/src/audio/playSound.ts`
- Create: `ui/src/audio/useSfxOnStatusChange.ts`
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/App.css` (append mute button styles)

**Interfaces:**
- Consumes: `SoundId`, `sfxForStatusChange`, `createSfxController` (Task 3); `OfficeState` (existing).
- Produces: `playSound(soundId)`, `useSfxOnStatusChange(state, sfxController)` hook.

- [ ] **Step 1: Write the audio element wrapper**

```ts
// ui/src/audio/playSound.ts
import type { SoundId } from "./sfx";

const SOUND_FILES: Record<SoundId, string> = {
  complete: "/sfx/complete.mp3",
  failure: "/sfx/failure.mp3",
  leave: "/sfx/leave.mp3",
};

/**
 * Sound files ship separately (see docs/superpowers/specs/2026-08-11-pixel-office-visual-redesign-design.md
 * "에셋" section) — until they're added under ui/public/sfx/, playback
 * fails silently rather than throwing, since sound is opt-in and muted by
 * default.
 */
export function playSound(soundId: SoundId): void {
  const audio = new Audio(SOUND_FILES[soundId]);
  audio.play().catch(() => {});
}
```

- [ ] **Step 2: Write the status-change-to-sound hook**

```ts
// ui/src/audio/useSfxOnStatusChange.ts
import { useEffect, useRef } from "react";
import type { OfficeState, CharacterStatus } from "../officeReducer";
import { sfxForStatusChange } from "./sfx";
import type { SfxController } from "./sfx";

export function useSfxOnStatusChange(state: OfficeState, sfxController: SfxController): void {
  const lastSeenRef = useRef<Map<string, CharacterStatus>>(new Map());

  useEffect(() => {
    for (const room of Object.values(state.rooms)) {
      for (const character of Object.values(room.characters)) {
        const key = `${character.agentType}/${character.agentId}`;
        const previous = lastSeenRef.current.get(key);
        if (previous !== undefined) {
          const soundId = sfxForStatusChange(previous, character.status);
          if (soundId) sfxController.play(soundId);
        }
        lastSeenRef.current.set(key, character.status);
      }
    }
  }, [state, sfxController]);
}
```

(`previous !== undefined` skips the very first sighting of each character — otherwise reconnecting to the WebSocket and replaying up to 200 history events would fire a sound for every character's first observed status, e.g. every already-departed character in the history would "leave" again on load.)

- [ ] **Step 3: Wire into App.tsx**

In `ui/src/App.tsx`, change the top `"react"` import line from:

```tsx
import { useCallback, useEffect, useReducer, useRef } from "react";
```

to:

```tsx
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
```

Add below the other imports:

```tsx
import { createSfxController } from "./audio/sfx";
import { playSound } from "./audio/playSound";
import { useSfxOnStatusChange } from "./audio/useSfxOnStatusChange";
```

Inside `App()`, after the existing `useWalkerCommands` line, add:

```tsx
const sfxController = useMemo(() => createSfxController(playSound), []);
useSfxOnStatusChange(state, sfxController);
const [muted, setMuted] = useState(sfxController.isMuted());
```

In the header JSX, add a toggle button next to the existing `ws-status` span:

```tsx
<button
  className="mute-toggle"
  onClick={() => {
    sfxController.toggleMute();
    setMuted(sfxController.isMuted());
  }}
>
  {muted ? "🔇 소리 켜기" : "🔊 소리 끄기"}
</button>
```

- [ ] **Step 4: Append CSS**

Add to `ui/src/App.css`:

```css
.mute-toggle {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid #2a2f42;
  background: #161822;
  color: #eee;
  cursor: pointer;
}
.mute-toggle:hover { background: #1c2030; }
```

- [ ] **Step 5: Typecheck and run full test suite**

Run: `npm run build && npm run test` (from `ui/`)
Expected: build succeeds, all existing tests plus Tasks 1-3's new tests pass.

- [ ] **Step 6: Commit**

```bash
git add ui/src/audio/playSound.ts ui/src/audio/useSfxOnStatusChange.ts ui/src/App.tsx ui/src/App.css
git commit -m "Wire up default-muted sound effects with a mute toggle"
```

---

### Task 9: Procedural pixel floor and desk-top textures

**Files:**
- Create: `ui/src/scene/pixelTile.ts`
- Create: `ui/src/scene/officeTextures.ts`
- Modify: `ui/src/scene/OfficeScene.tsx:27-30` (floor mesh material)
- Modify: `ui/src/scene/Desk.tsx:16-19` (desk body mesh material)

**Interfaces:**
- Produces: `getFloorTexture()`, `getDeskTopTexture()` (both return a cached `THREE.CanvasTexture`, built once and reused across all instances) — consumed by `OfficeScene.tsx` and `Desk.tsx`.
- No test file: same reasoning as Task 4 (canvas/three.js only, no DOM in vitest). Verified visually in Task 11.
- Props.tsx (plant/water cooler) intentionally keeps its solid-color cylinder/sphere geometry — "tile texture" only reads meaningfully on the flat floor/desk-top surfaces that face the new top-down camera directly; round decorative props are left as-is to avoid speculative texture work with no visible payoff, matching Task 10's plan to bring in real interior art for these later anyway.

- [ ] **Step 1: Write the tile-drawing module**

```ts
// ui/src/scene/pixelTile.ts
export const TILE_SIZE = 16;

export function drawFloorTile(ctx: CanvasRenderingContext2D, evenCell: boolean): void {
  ctx.fillStyle = evenCell ? "#3a2f28" : "#342a24";
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
  ctx.fillRect(0, TILE_SIZE - 2, TILE_SIZE, 2);
}

export function drawDeskTopTile(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#5a4632";
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = "#6b5540";
  for (let x = 0; x < TILE_SIZE; x += 4) {
    ctx.fillRect(x, 0, 2, TILE_SIZE);
  }
}
```

- [ ] **Step 2: Write the cached texture builders**

```ts
// ui/src/scene/officeTextures.ts
import { CanvasTexture, NearestFilter, RepeatWrapping } from "three";
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
  deskTopTexture.magFilter = NearestFilter;
  deskTopTexture.minFilter = NearestFilter;
  return deskTopTexture;
}
```

(`repeat.set(9, 8)` against the floor plane's `[18, 16]` world-unit size gives roughly a 2-unit tile — a starting point tuned visually in Task 11, same as the camera zoom in Task 5.)

- [ ] **Step 3: Apply the floor texture in OfficeScene.tsx**

Add the import:

```tsx
import { getFloorTexture } from "./officeTextures";
```

Replace:

```tsx
<meshStandardMaterial color="#3a2f28" />
```

with:

```tsx
<meshStandardMaterial map={getFloorTexture()} />
```

- [ ] **Step 4: Apply the desk-top texture in Desk.tsx**

Add the import:

```tsx
import { getDeskTopTexture } from "./officeTextures";
```

Replace the desk body mesh's material:

```tsx
<mesh position={[0, 0.25, 0]}>
  <boxGeometry args={[1.2, 0.5, 0.8]} />
  <meshStandardMaterial color="#5a4632" />
</mesh>
```

with:

```tsx
<mesh position={[0, 0.25, 0]}>
  <boxGeometry args={[1.2, 0.5, 0.8]} />
  <meshStandardMaterial map={getDeskTopTexture()} />
</mesh>
```

(This tiles the same texture across all six box faces rather than just the top — an accepted simplification for a personal-scale tool; the top face is what the orthographic top-down camera actually shows.)

- [ ] **Step 5: Typecheck**

Run: `npm run build` (from `ui/`)
Expected: succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add ui/src/scene/pixelTile.ts ui/src/scene/officeTextures.ts ui/src/scene/OfficeScene.tsx ui/src/scene/Desk.tsx
git commit -m "Add procedural pixel-tile textures for the floor and desks"
```

---

### Task 10: Document the manual real-asset swap-in

**Files:**
- Modify: `README.md` (repo root — if it doesn't cover the UI yet, add a new section; check the existing README structure from the 2026-08-07 project before deciding where this section goes)

**Interfaces:** None (documentation only).

- [ ] **Step 1: Add a "픽셀아트 에셋 교체" section to the README**

Document, as literal steps a human will follow later:

1. Download the free character pack from `https://jik-a-4.itch.io/metrocity-free-topdown-character-pack` (click "Download Now", choose "No thanks, just take me to the downloads" to skip the optional payment, save the zip).
2. Download the matching free interior/furniture pack from the same creator (search "JIK-A-4 top down interior" on itch.io — linked from the character pack's page).
3. Extract character sprite sheet PNGs into `ui/public/sprites/characters/`, interior tile PNGs into `ui/public/sprites/interior/`.
4. Update `ui/src/scene/pixelSprite.ts`'s `drawCharacterFrame` to instead draw a `drawImage` crop from the real sheet (open the PNG in any image viewer to read its frame grid dimensions — MetroCity sheets are typically laid out in fixed-size rows per animation direction) rather than the procedural `fillRect` blocks. Keep the same function signature (`(ctx, palette, frame) => void`) so `useCharacterSpriteTexture.ts` and every caller need no changes — only the drawing internals differ.
5. For the department color tint (currently done by generating each palette's colors directly, since there's only one procedural template), switch to `ctx.globalCompositeOperation = "multiply"` after drawing the real sprite, filling the department color as an overlay, then reset the composite mode — so a single real sprite sheet serves all four departments.
6. For sound effects, download Kenney's free CC0 UI Audio pack from `https://kenney.nl/assets/ui-audio`, pick 3 short clips, save them as `ui/public/sfx/complete.mp3`, `ui/public/sfx/failure.mp3`, `ui/public/sfx/leave.mp3` (matching the filenames already referenced in `ui/src/audio/playSound.ts`) — no code change needed, `playSound.ts` already points at these paths.
7. Add a credits line: "Character/interior art by JIK-A-4 (MetroCity, free). UI sound effects by Kenney (kenney.nl, CC0)."

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Document manual real-asset swap-in procedure for pixel sprites"
```

---

### Task 11: End-to-end verification

**Files:** None (verification only — fix forward in the relevant file from Tasks 1-8 if something's broken, then re-run this task's checks).

- [ ] **Step 1: Run the full automated test suite**

Run (from `ui/`): `npm run test`
Expected: all tests pass, including the new `animationClip`, `statusLabelRules`, and `sfx` suites.

- [ ] **Step 2: Check whether the dev stack is already running**

Run: check for existing listeners on the known ports before starting anything —

```bash
netstat -ano | grep -E ":(4000|4001|5173)\b"
```

- If nothing is listening: start it yourself in the background — `npm run dev` from the repo root (starts the event server on :4000/:4001 and the Vite UI dev server on :5173 via `concurrently`). If `npm run dev` fails to start (e.g. port already held by an unrelated process, permissions issue), stop and tell the user the exact error plus the manual command (`npm run dev` from the repo root) so they can start it themselves.
- If something is already listening on all three ports: that's a single already-running `npm run dev` — reuse it, do not start a second one.
- If you find **duplicate** listeners (e.g. two separate processes both bound near these ports, or a stale process holding one port while another holds the others): stop the existing one(s) first (`taskkill /PID <pid> /F` using the PID from `netstat`), then start a fresh `npm run dev` yourself, and verify against that one.

- [ ] **Step 3: Inject a full event sequence via curl**

```bash
curl -X POST localhost:4000/events -H "Content-Type: application/json" -d '{"hook_event_name":"SubagentStart","agent_id":"verify-1","agent_type":"dev-dept"}'
curl -X POST localhost:4000/events -H "Content-Type: application/json" -d '{"hook_event_name":"PreToolUse","agent_id":"verify-1","agent_type":"dev-dept","tool_name":"Read"}'
curl -X POST localhost:4000/events -H "Content-Type: application/json" -d '{"hook_event_name":"PostToolUse","agent_id":"verify-1","agent_type":"dev-dept","tool_name":"Read"}'
curl -X POST localhost:4000/events -H "Content-Type: application/json" -d '{"hook_event_name":"PreToolUse","agent_id":"verify-1","agent_type":"dev-dept","tool_name":"Write"}'
curl -X POST localhost:4000/events -H "Content-Type: application/json" -d '{"hook_event_name":"PostToolUseFailure","agent_id":"verify-1","agent_type":"dev-dept","tool_name":"Write"}'
curl -X POST localhost:4000/events -H "Content-Type: application/json" -d '{"hook_event_name":"SubagentStop","agent_id":"verify-1","agent_type":"dev-dept"}'
```

- [ ] **Step 4: Open the UI in a real browser and visually confirm**

Open `http://localhost:5173` yourself (e.g. via the `claude-in-chrome` skill/tools, or the project's `run` skill if it covers this app) and confirm, following each curl call above in order:
- Camera is a flat top-down view (no diagonal/isometric tilt) and the whole floor + desks are visible in the 640px-tall scene container.
- The `verify-1` character appears at its dev-dept desk facing the camera as a pixel sprite (not a box).
- Read → sprite/status label shows the "read" state ("자료 찾는 중 🔍"); PostToolUse → briefly "완료 ✅" then reverts.
- Write → "작성 중 ✍️"; PostToolUseFailure → "문제 발생 ⚠️" rendered as a speech bubble (distinct style from the plain name tag).
- SubagentStop → character turns semi-transparent/greyscale ("퇴근").
- The mute toggle button is present, starts in the muted state, and its label/icon flips when clicked (audible sound won't play yet — sound files are added later per Task 10 — but toggling should not throw a console error).
- The floor reads as a tiled pixel pattern (not a flat solid color) and desks show the wood-grain tile texture.
- No console errors in the browser dev tools.

- [ ] **Step 5: Fix forward and re-verify**

If any check in Step 4 fails, fix it in the relevant file from Tasks 1-8, re-run `npm run build && npm run test`, and repeat Steps 3-4 for the specific broken behavior. Do not mark this task done until all Step 4 checks pass.

- [ ] **Step 6: Report results**

Summarize, for the user: which checks passed, which ports/processes ended up running (and whether an existing server was stopped and restarted per Step 2), and the exact `http://localhost:5173` URL to look at themselves.
