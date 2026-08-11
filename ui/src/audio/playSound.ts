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
