import { useEffect, useRef } from "react";
import { pickBreakRoomVisitors } from "./breakRoom";
import { homePositionFor, BREAK_ROOM_SLOTS } from "./deskLayout";
import type { OfficeState } from "../officeReducer";
import type { WalkCommand } from "./useWalkerCommands";

const CHECK_INTERVAL_MS = 15000;
const MAX_VISITORS = 2;
const MIN_WAIT_MS = 60000;
const MAX_WAIT_MS = 180000;

function splitKey(key: string): { agentType: string; agentId: string } {
  const separatorIndex = key.indexOf("/");
  return { agentType: key.slice(0, separatorIndex), agentId: key.slice(separatorIndex + 1) };
}

function isCharacterActive(state: OfficeState, agentType: string, agentId: string): boolean {
  return state.rooms[agentType]?.characters[agentId]?.active ?? false;
}

export function useBreakRoomScheduler(
  state: OfficeState,
  commandsRef: React.MutableRefObject<Map<string, WalkCommand>>
) {
  const stateRef = useRef(state);
  stateRef.current = state;
  // Maps a visiting character's key to the specific BREAK_ROOM_SLOTS index
  // it currently occupies, so a new visitor is only ever assigned a slot
  // index that isn't already in use (rather than one derived from the
  // current size of the visiting set, which can double-assign a slot once
  // visitors start leaving out of order).
  const visitingRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const interval = setInterval(() => {
      for (const key of Array.from(visitingRef.current.keys())) {
        const stillCommanded = commandsRef.current.has(key);
        const { agentType, agentId } = splitKey(key);
        const stillActive = isCharacterActive(stateRef.current, agentType, agentId);
        // Prune both: a visitor whose WalkCommand finished naturally, and
        // one whose character went offline (SubagentStop) mid-visit — the
        // latter fades out and hides but its WalkCommand keeps running its
        // full waitDurationMs (up to 3 minutes), so without this check it
        // would keep occupying a slot while invisible.
        if (!stillCommanded || !stillActive) {
          visitingRef.current.delete(key);
        }
      }

      const visitingKeys = new Set(visitingRef.current.keys());
      const picks = pickBreakRoomVisitors(stateRef.current, visitingKeys, MAX_VISITORS);
      for (const pick of picks) {
        const key = `${pick.agentType}/${pick.agentId}`;
        const home = homePositionFor(stateRef.current, pick.agentType, pick.agentId);
        const usedSlots = new Set(visitingRef.current.values());
        let slotIndex = 0;
        while (usedSlots.has(slotIndex) && slotIndex < BREAK_ROOM_SLOTS.length) slotIndex++;
        if (slotIndex >= BREAK_ROOM_SLOTS.length) continue; // no free slot; skip this pick

        commandsRef.current.set(key, {
          phase: "walking-to-visit",
          role: "caller",
          target: BREAK_ROOM_SLOTS[slotIndex],
          home,
          phaseStartedAt: performance.now(),
          waitDurationMs: MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS),
        });
        visitingRef.current.set(key, slotIndex);
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [commandsRef]);
}
