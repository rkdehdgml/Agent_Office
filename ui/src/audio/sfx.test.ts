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
