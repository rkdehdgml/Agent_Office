import { describe, expect, it } from "vitest";
import { animationClipFor, CLIP_FRAMES } from "./animationClip";
import type { AnimationClip } from "./animationClip";

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
