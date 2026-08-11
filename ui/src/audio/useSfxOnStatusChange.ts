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
