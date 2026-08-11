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
