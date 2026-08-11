import type { CharacterStatus } from "../officeReducer";

/**
 * The hook events wired today (see officeReducer.ts) don't include a
 * "waiting for permission" state, so the speech-bubble treatment only
 * applies to the failure status for now.
 */
export function isSpeechBubbleStatus(status: CharacterStatus): boolean {
  return status === "문제 발생 ⚠️";
}
