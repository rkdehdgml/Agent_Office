import { useEffect, useRef } from "react";
import { pickBreakRoomVisitors } from "./breakRoom";
import { homePositionFor, BREAK_ROOM_SLOTS } from "./deskLayout";
import type { OfficeState } from "../officeReducer";
import type { WalkCommand } from "./useWalkerCommands";

const CHECK_INTERVAL_MS = 15000;
const MAX_VISITORS = 2;
const MIN_WAIT_MS = 60000;
const MAX_WAIT_MS = 180000;

export function useBreakRoomScheduler(
  state: OfficeState,
  commandsRef: React.MutableRefObject<Map<string, WalkCommand>>
) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const visitingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => {
      for (const key of visitingRef.current) {
        if (!commandsRef.current.has(key)) visitingRef.current.delete(key);
      }

      const picks = pickBreakRoomVisitors(stateRef.current, visitingRef.current, MAX_VISITORS);
      picks.forEach((pick) => {
        const key = `${pick.agentType}/${pick.agentId}`;
        const home = homePositionFor(stateRef.current, pick.agentType, pick.agentId);
        const slotIndex = visitingRef.current.size % BREAK_ROOM_SLOTS.length;
        commandsRef.current.set(key, {
          phase: "walking-to-visit",
          role: "caller",
          target: BREAK_ROOM_SLOTS[slotIndex],
          home,
          phaseStartedAt: performance.now(),
          waitDurationMs: MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS),
        });
        visitingRef.current.add(key);
      });
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [commandsRef]);
}
