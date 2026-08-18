# pixel-agents 캐릭터 애셋 통합 (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AgentOffice's hand-drawn, per-department-recolored canvas character sprite with pixel-agents' real PNG character art, and expand the animation set from 2 frames (idle/walk-alt) to the full walk/idle/type/read/alert set pixel-agents' frame layout supports.

**Architecture:** Keep the existing "live `CanvasTexture` redrawn on an interval" rendering pipeline unchanged. Swap only what feeds the canvas draw call: instead of `fillRect`-based palette drawing, crop a 16×32 frame out of a preloaded `char_N.png` via `drawImage`. A new frame-index table (`CLIP_FRAMES`) drives which frames each `AnimationClip` cycles through, and a new department→file map (`characterFileFor`/`characterImageFor`) replaces the old department→color map (`PALETTE`).

**Tech Stack:** React + `@react-three/fiber`/`three` (existing), Vite static assets in `ui/public/`, Vitest for pure-function unit tests.

**Spec:** `docs/superpowers/specs/2026-08-18-pixel-agents-character-integration-design.md`

## Global Constraints

- Character PNG frame size: 16×32px (`FRAME_W=16`, `FRAME_H=32`) — not the old 16×22 hand-drawn sprite size.
- Only the "right" direction row is used this phase: `RIGHT_ROW_Y = 64` (row offset within each 112×96 `char_N.png`).
- Frame redraw interval: 220ms (unchanged from today's `WALK_FRAME_INTERVAL_MS`).
- Department → character file is a fixed 1:1 map: `research-dept→char_0.png`, `planning-dept→char_1.png`, `dev-dept→char_2.png`, `design-publishing-dept→char_3.png`, `HQ_ROOM→char_4.png`, unknown→`char_5.png` (fallback/spare).
- Team/rank badge display (`"{팀명} · {직급}"` via `officeLabel.ts`'s `labelFor`) is already implemented and must NOT be touched by this plan.
- No directional (up/down/left/right) sprite facing this phase — always the "right" row.
- Assets already downloaded to `ui/public/pixel-agents-assets/characters/char_0.png`..`char_5.png`, currently untracked in git.

---

### Task 1: Frame-index table for animation clips

**Files:**
- Modify: `ui/src/scene/animationClip.ts`
- Test: `ui/src/scene/animationClip.test.ts`

**Interfaces:**
- Consumes: `AnimationClip` type (already defined in this file: `"idle" | "walk" | "read" | "type" | "alert"`).
- Produces: `CLIP_FRAMES: Record<AnimationClip, readonly number[]>` — later tasks (Task 4) read this to know which pixel-agents frame indices to cycle through for a given clip, and at what step order.

- [ ] **Step 1: Write the failing test**

Add to `ui/src/scene/animationClip.test.ts` (append after the existing `describe("animationClipFor", ...)` block):

```ts
describe("CLIP_FRAMES", () => {
  const clips: AnimationClip[] = ["idle", "walk", "read", "type", "alert"];

  it("defines a frame list for every animation clip", () => {
    for (const clip of clips) {
      expect(CLIP_FRAMES[clip]).toBeDefined();
      expect(CLIP_FRAMES[clip].length).toBeGreaterThan(0);
    }
  });

  it("keeps every frame index within the 0-6 sprite sheet range", () => {
    for (const clip of clips) {
      for (const frame of CLIP_FRAMES[clip]) {
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThanOrEqual(6);
      }
    }
  });

  it("cycles the walk clip through a 4-step ping-pong of frames 0-2", () => {
    expect(CLIP_FRAMES.walk).toEqual([0, 1, 2, 1]);
  });

  it("holds idle on the resting mid-walk frame", () => {
    expect(CLIP_FRAMES.idle).toEqual([1]);
  });

  it("alternates type between frames 3 and 4", () => {
    expect(CLIP_FRAMES.type).toEqual([3, 4]);
  });

  it("alternates read and alert between frames 5 and 6", () => {
    expect(CLIP_FRAMES.read).toEqual([5, 6]);
    expect(CLIP_FRAMES.alert).toEqual([5, 6]);
  });
});
```

Update the import line at the top of the test file (it currently only imports `animationClipFor`) to also bring in `CLIP_FRAMES` and the `AnimationClip` type:

```ts
import { animationClipFor, CLIP_FRAMES } from "./animationClip";
import type { AnimationClip } from "./animationClip";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix ui run test -- animationClip`
Expected: FAIL — `CLIP_FRAMES` is not exported from `./animationClip`.

- [ ] **Step 3: Implement `CLIP_FRAMES`**

Append to `ui/src/scene/animationClip.ts` (after the existing `animationClipFor` function):

```ts
export const CLIP_FRAMES: Record<AnimationClip, readonly number[]> = {
  idle: [1],
  walk: [0, 1, 2, 1],
  type: [3, 4],
  read: [5, 6],
  alert: [5, 6],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix ui run test -- animationClip`
Expected: PASS, all cases including the pre-existing `animationClipFor` suite.

- [ ] **Step 5: Commit**

```bash
git add ui/src/scene/animationClip.ts ui/src/scene/animationClip.test.ts
git commit -m "feat: add pixel-agents frame-index table per animation clip"
```

---

### Task 2: Department → character file mapping + image preload cache

**Files:**
- Create: `ui/src/scene/characterSprites.ts`
- Test: `ui/src/scene/characterSprites.test.ts`
- Asset: `ui/public/pixel-agents-assets/characters/char_0.png`..`char_5.png` (already present on disk, untracked — this task commits them)

**Interfaces:**
- Consumes: `HQ_ROOM` from `../officeReducer` (already exported and used the same way in `CharacterActor.tsx`).
- Produces: `characterFileFor(agentType: string): string` and `characterImageFor(agentType: string): HTMLImageElement` — Task 5 (`CharacterActor.tsx`) calls `characterImageFor` to get the image to pass into the sprite texture hook.

- [ ] **Step 1: Write the failing test**

Create `ui/src/scene/characterSprites.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { characterFileFor } from "./characterSprites";
import { HQ_ROOM } from "../officeReducer";

describe("characterFileFor", () => {
  it("maps research-dept to char_0.png", () => {
    expect(characterFileFor("research-dept")).toBe("char_0.png");
  });

  it("maps planning-dept to char_1.png", () => {
    expect(characterFileFor("planning-dept")).toBe("char_1.png");
  });

  it("maps dev-dept to char_2.png", () => {
    expect(characterFileFor("dev-dept")).toBe("char_2.png");
  });

  it("maps design-publishing-dept to char_3.png", () => {
    expect(characterFileFor("design-publishing-dept")).toBe("char_3.png");
  });

  it("maps HQ_ROOM to char_4.png", () => {
    expect(characterFileFor(HQ_ROOM)).toBe("char_4.png");
  });

  it("falls back to char_5.png for an unknown department", () => {
    expect(characterFileFor("unknown-dept")).toBe("char_5.png");
  });
});
```

Note: `characterImageFor` is intentionally NOT tested here — it calls `new Image()`, which requires a DOM environment this project's Vitest config does not provide (all existing `.test.ts` files in `ui/src/scene/` test pure functions only, no jsdom setup exists). It's exercised through manual browser verification in Task 6 instead.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix ui run test -- characterSprites`
Expected: FAIL — cannot find module `./characterSprites`.

- [ ] **Step 3: Implement `characterSprites.ts`**

Create `ui/src/scene/characterSprites.ts`:

```ts
import { HQ_ROOM } from "../officeReducer";

export const CHARACTER_FILE: Record<string, string> = {
  "research-dept": "char_0.png",
  "planning-dept": "char_1.png",
  "dev-dept": "char_2.png",
  "design-publishing-dept": "char_3.png",
  [HQ_ROOM]: "char_4.png",
};
const DEFAULT_CHARACTER_FILE = "char_5.png";

export function characterFileFor(agentType: string): string {
  return CHARACTER_FILE[agentType] ?? DEFAULT_CHARACTER_FILE;
}

const CHARACTER_ASSET_BASE = "/pixel-agents-assets/characters/";
const imageCache = new Map<string, HTMLImageElement>();

/**
 * Returns a shared, lazily-created <img> for the character file mapped to
 * agentType. The same HTMLImageElement instance is reused across all
 * characters sharing a department, so the browser only fetches each of the
 * 6 sprite sheets once.
 */
export function characterImageFor(agentType: string): HTMLImageElement {
  const file = characterFileFor(agentType);
  let img = imageCache.get(file);
  if (!img) {
    img = new Image();
    img.src = `${CHARACTER_ASSET_BASE}${file}`;
    imageCache.set(file, img);
  }
  return img;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix ui run test -- characterSprites`
Expected: PASS.

- [ ] **Step 5: Commit (code + assets together)**

```bash
git add ui/src/scene/characterSprites.ts ui/src/scene/characterSprites.test.ts ui/public/pixel-agents-assets/characters/
git commit -m "feat: add department-to-pixel-agents-character file mapping"
```

---

### Task 3: PNG-crop-based frame drawing

**Files:**
- Modify: `ui/src/scene/pixelSprite.ts` (full rewrite — every existing line changes or is removed)

**Interfaces:**
- Consumes: nothing new — draws directly from an `HTMLImageElement` passed in by the caller (Task 4).
- Produces: `SPRITE_WIDTH = 16`, `SPRITE_HEIGHT = 32` (height changes from the old 22 — every consumer of these constants, i.e. Task 4's canvas sizing, must use the new value), and `drawCharacterFrame(ctx: CanvasRenderingContext2D, img: HTMLImageElement, frameIndex: number): void`.

This task has no dedicated unit test — `drawCharacterFrame` mutates a `CanvasRenderingContext2D`, which (like `characterImageFor`) needs a DOM/canvas environment this project's plain-node Vitest setup doesn't provide. It's covered by manual browser verification in Task 6, consistent with how the pre-existing hand-drawn version was never unit-tested either (only pure helpers like `rankFor`/`teamNameFor` have tests in this codebase).

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `ui/src/scene/pixelSprite.ts` with:

```ts
export const SPRITE_WIDTH = 16;
export const SPRITE_HEIGHT = 32;

const RIGHT_ROW_Y = 64;

/**
 * Crops one 16x32 frame out of a pixel-agents char_N.png sprite sheet
 * (112x96: 3 direction rows x 7 frames) and draws it into ctx. Only the
 * "right" direction row is used — see the Phase 1 design spec for why
 * directional facing is out of scope this pass.
 */
export function drawCharacterFrame(ctx: CanvasRenderingContext2D, img: HTMLImageElement, frameIndex: number): void {
  ctx.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT);
  ctx.drawImage(
    img,
    frameIndex * SPRITE_WIDTH, RIGHT_ROW_Y, SPRITE_WIDTH, SPRITE_HEIGHT,
    0, 0, SPRITE_WIDTH, SPRITE_HEIGHT,
  );
}
```

This removes the `CharacterPalette` interface and the old `fillRect`-based drawing entirely — grep confirms `CharacterPalette` and this file's exports are only consumed by `useCharacterSpriteTexture.ts` (Task 4) and `CharacterActor.tsx` (Task 5), both updated in this same plan.

- [ ] **Step 2: Typecheck**

Run: `npm --prefix ui run build` (or the project's typecheck script if one exists separately — check `ui/package.json` scripts; use `tsc --noEmit` via the build script)
Expected: FAILS at this point, because `useCharacterSpriteTexture.ts` (Task 4, not yet done) still imports the old `CharacterPalette` type and calls `drawCharacterFrame` with the old 3-arg palette signature. This is expected — Task 4 fixes it. Do not attempt to make the build pass within this task.

- [ ] **Step 3: Commit**

```bash
git add ui/src/scene/pixelSprite.ts
git commit -m "feat: draw character frames from pixel-agents PNG crops instead of fillRect"
```

---

### Task 4: Wire clip-based frame cycling into the texture hook

**Files:**
- Modify: `ui/src/scene/useCharacterSpriteTexture.ts` (full rewrite)

**Interfaces:**
- Consumes: `drawCharacterFrame`, `SPRITE_HEIGHT`, `SPRITE_WIDTH` from `./pixelSprite` (Task 3's new signature: `(ctx, img, frameIndex)`); `CLIP_FRAMES`, `AnimationClip` from `./animationClip` (Task 1).
- Produces: `useCharacterSpriteTexture(image: HTMLImageElement, clip: AnimationClip): CanvasTexture` — signature changes from the old `(palette: CharacterPalette, clip: AnimationClip)`. Task 5 updates its one call site to match.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `ui/src/scene/useCharacterSpriteTexture.ts` with:

```ts
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, NearestFilter, SRGBColorSpace } from "three";
import { drawCharacterFrame, SPRITE_HEIGHT, SPRITE_WIDTH } from "./pixelSprite";
import { CLIP_FRAMES } from "./animationClip";
import type { AnimationClip } from "./animationClip";

const FRAME_INTERVAL_MS = 220;

/**
 * Returns a live CanvasTexture for a character. Which frames it cycles
 * through, and at what pace, is driven entirely by CLIP_FRAMES[clip] —
 * a clip with a single frame (e.g. "idle") draws once and never starts
 * an interval.
 */
export function useCharacterSpriteTexture(image: HTMLImageElement, clip: AnimationClip): CanvasTexture {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  if (!canvasRef.current) {
    const canvas = document.createElement("canvas");
    canvas.width = SPRITE_WIDTH;
    canvas.height = SPRITE_HEIGHT;
    canvasRef.current = canvas;
  }

  const texture = useMemo(() => {
    const tex = new CanvasTexture(canvasRef.current!);
    tex.colorSpace = SRGBColorSpace;
    tex.magFilter = NearestFilter;
    tex.minFilter = NearestFilter;
    return tex;
  }, []);

  const stepRef = useRef(0);

  useEffect(() => {
    const ctx = canvasRef.current!.getContext("2d")!;
    const frames = CLIP_FRAMES[clip];
    stepRef.current = 0;
    drawCharacterFrame(ctx, image, frames[0]);
    texture.needsUpdate = true;

    if (frames.length <= 1) return;
    const id = setInterval(() => {
      stepRef.current = (stepRef.current + 1) % frames.length;
      drawCharacterFrame(ctx, image, frames[stepRef.current]);
      texture.needsUpdate = true;
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [image, clip, texture]);

  return texture;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm --prefix ui run build`
Expected: Still FAILS — `CharacterActor.tsx` (Task 5, not yet done) still calls `useCharacterSpriteTexture(palette, clip)` with the old signature. Expected at this point; Task 5 fixes it.

- [ ] **Step 3: Commit**

```bash
git add ui/src/scene/useCharacterSpriteTexture.ts
git commit -m "feat: cycle sprite texture frames per-clip via CLIP_FRAMES"
```

---

### Task 5: Wire CharacterActor to the new image-based sprite pipeline

**Files:**
- Modify: `ui/src/scene/CharacterActor.tsx:1-22` (imports + `PALETTE`/`DEFAULT_PALETTE` removal), `:56-57` (palette lookup → image lookup), `:161-173` (texture hook call + sprite scale/position)

**Interfaces:**
- Consumes: `characterImageFor` from `./characterSprites` (Task 2); `useCharacterSpriteTexture(image, clip)` new signature (Task 4).
- Produces: nothing new for later tasks — this is the last code task.

- [ ] **Step 1: Update imports and remove the palette table**

In `ui/src/scene/CharacterActor.tsx`, replace lines 1-21:

```ts
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, SpriteMaterial } from "three";
import type { Character } from "../officeReducer";
import type { Vec2 } from "./deskLayout";
import type { WalkCommand } from "./useWalkerCommands";
import { animationClipFor } from "./animationClip";
import { useCharacterSpriteTexture } from "./useCharacterSpriteTexture";
import { characterImageFor } from "./characterSprites";
import { StatusLabel } from "./StatusLabel";
import { getShadowTexture } from "./officeTextures";
import { labelFor } from "./officeLabel";
```

with:

```ts
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, SpriteMaterial } from "three";
import type { Character } from "../officeReducer";
import type { Vec2 } from "./deskLayout";
import type { WalkCommand } from "./useWalkerCommands";
import { animationClipFor } from "./animationClip";
import { useCharacterSpriteTexture } from "./useCharacterSpriteTexture";
import { characterImageFor } from "./characterSprites";
import { StatusLabel } from "./StatusLabel";
import { getShadowTexture } from "./officeTextures";
import { labelFor } from "./officeLabel";
```

(This removes the `HQ_ROOM` import, which was only used to key `PALETTE`, and the now-deleted `PALETTE`/`DEFAULT_PALETTE` consts below it.)

- [ ] **Step 2: Remove the `PALETTE`/`DEFAULT_PALETTE` constants**

Delete these lines entirely (immediately after the imports):

```ts
const PALETTE: Record<string, { body: string; hair: string; skin: string; pants: string }> = {
  "research-dept": { body: "#3d7ea6", hair: "#3a2a20", skin: "#e8b98a", pants: "#26333d" },
  "planning-dept": { body: "#8a5cc2", hair: "#241a2e", skin: "#f0c9a0", pants: "#2e2438" },
  "dev-dept": { body: "#3fae6a", hair: "#1c1c1c", skin: "#e0ab7c", pants: "#22331f" },
  "design-publishing-dept": { body: "#c2547e", hair: "#2a1a20", skin: "#e8b98a", pants: "#3a2430" },
  [HQ_ROOM]: { body: "#b08d57", hair: "#3a2a20", skin: "#e8b98a", pants: "#4a3a28" },
};
const DEFAULT_PALETTE = { body: "#8a8a8a", hair: "#2b2b2b", skin: "#d8b48a", pants: "#3a3a3a" };
```

- [ ] **Step 3: Replace the palette lookup with an image lookup**

Find this line (inside the `CharacterActor` function body, right after `const key = ...`):

```ts
  const palette = PALETTE[character.agentType] ?? DEFAULT_PALETTE;
```

Replace with:

```ts
  const characterImage = characterImageFor(character.agentType);
```

- [ ] **Step 4: Update the texture hook call**

Find:

```ts
  const clip = animationClipFor(character.status, renderPhase, character.active);
  const texture = useCharacterSpriteTexture(palette, clip);
```

Replace with:

```ts
  const clip = animationClipFor(character.status, renderPhase, character.active);
  const texture = useCharacterSpriteTexture(characterImage, clip);
```

- [ ] **Step 5: Rescale the sprite plane for the new 16x32 frame aspect ratio**

The old hand-drawn sprite was 16x22 (aspect 0.727), matched by `scale={[0.9, 1.25, 1]}` and `position={[0, 0.65, 0]}`. pixel-agents frames are 16x32 (aspect 0.5). Keeping the same width (0.9) and applying the new aspect ratio: `height = 0.9 / 0.5 = 1.8`. Scaling the vertical position offset by the same ratio the old values used (`0.65 / 1.25 ≈ 0.52`) gives `0.52 * 1.8 ≈ 0.9`.

Find:

```tsx
      <group ref={spriteGroupRef}>
        <sprite scale={[0.9, 1.25, 1]} position={[0, 0.65, 0]}>
          <spriteMaterial ref={materialRef} map={texture} transparent opacity={1} />
        </sprite>
      </group>
```

Replace with:

```tsx
      <group ref={spriteGroupRef}>
        <sprite scale={[0.9, 1.8, 1]} position={[0, 0.9, 0]}>
          <spriteMaterial ref={materialRef} map={texture} transparent opacity={1} />
        </sprite>
      </group>
```

- [ ] **Step 6: Typecheck**

Run: `npm --prefix ui run build`
Expected: PASSES — this was the last file with a stale reference to the old palette-based API.

- [ ] **Step 7: Run the full test suite**

Run: `npm --prefix ui run test`
Expected: PASS — all existing suites (rank, teamLabels, animationClip, characterSprites, deskLayout, breakRoom, etc.) still pass; this task touched no pure-function logic they cover.

- [ ] **Step 8: Commit**

```bash
git add ui/src/scene/CharacterActor.tsx
git commit -m "feat: render characters from pixel-agents sprite sheets instead of palette fills"
```

---

### Task 6: Manual verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm --prefix ui run dev` (leave running; note the printed local URL, typically `http://localhost:5173`)

- [ ] **Step 2: Trigger or wait for characters across all 4 departments**

Confirm in the browser that `research-dept`, `planning-dept`, `dev-dept`, and `design-publishing-dept` characters each render a visibly different pixel-agents character sprite (not the old flat-color hand-drawn shape), and the `HQ_ROOM`/본부 character renders yet another distinct one.

- [ ] **Step 3: Confirm the sprite isn't visually squashed/stretched or floating**

Check the character's feet roughly meet the shadow ellipse under it (from `getShadowTexture()`), and the sprite doesn't look horizontally squashed or vertically stretched relative to its pixel art. If it looks off, adjust the `scale`/`position` values from Task 5 Step 5 (this is expected fine-tuning — the computed values are a starting point, not guaranteed pixel-perfect without seeing it rendered).

- [ ] **Step 4: Confirm all 5 animation clips render distinct frames**

Drive each status through the app (or via triggering real subagent tool events) and confirm:
- `walk` (character mid-walk to break room or a visit): legs visibly cycle through more than 2 positions — richer than before.
- `idle`: static resting pose.
- `type` (작성 중 ✍️ status): 2-frame typing animation.
- `read` (자료 찾는 중 🔍 / 검색 중 🌐 status): 2-frame reading animation, visually distinct from `type`.
- `alert` (문제 발생 ⚠️ status): same frames as `read` per the design's YAGNI call — confirm it's at least not broken/blank.

- [ ] **Step 5: Confirm team/rank badges still work unchanged**

Confirm each character's label still reads `"{팀명} · {직급}"` (e.g. `"리서치팀 · 대리"`) exactly as before — this plan didn't touch `StatusLabel.tsx`/`officeLabel.ts`, so this step is a regression check, not new functionality.

- [ ] **Step 6: Confirm fixed team-lead/HQ characters render correctly too**

Confirm the always-present 팀장/부장 fixed characters (`isFixed` characters) also show pixel-agents art (not blank/broken), since they share the same `characterImageFor` path as event-driven characters.

- [ ] **Step 7: Stop the dev server**

No commit for this task — it's verification only. If Step 3 required scale/position tweaks, fold that fix into a follow-up commit:

```bash
git add ui/src/scene/CharacterActor.tsx
git commit -m "fix: tune character sprite scale/position after visual check"
```

(Only run this commit if you actually changed values during Step 3 — skip it otherwise.)
