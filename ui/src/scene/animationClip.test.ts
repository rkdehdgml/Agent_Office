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
