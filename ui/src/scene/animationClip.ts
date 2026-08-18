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

export const CLIP_FRAMES: Record<AnimationClip, readonly number[]> = {
  idle: [1],
  walk: [0, 1, 2, 1],
  type: [3, 4],
  read: [5, 6],
  alert: [5, 6],
};
