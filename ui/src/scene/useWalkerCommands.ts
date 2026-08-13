import { useCallback, useRef } from "react";
import { createVisitMatcher } from "./visitMatcher";
import { homePositionFor } from "./deskLayout";
import type { Vec2 } from "./deskLayout";
import type { OfficeState } from "../officeReducer";
import type { RawEvent } from "../types";

export type WalkPhase = "walking-to-visit" | "greeting" | "walking-back";

export interface WalkCommand {
  phase: WalkPhase;
  role: "caller" | "partner";
  target: Vec2;
  home: Vec2;
  phaseStartedAt: number;
  partnerKey?: string;
  waitDurationMs?: number;
}

function keyFor(agentType: string, agentId: string): string {
  return `${agentType}/${agentId}`;
}

/**
 * Owns the "who is walking to visit whom" animation commands for the 3D
 * scene, driven by the raw hook-event stream (via `onRawEvent`, called
 * alongside the normal officeReducer dispatch) rather than the derived
 * OfficeState — the reducer's LogEntry shape doesn't carry `agent_id`, so
 * it can't be used to pair a caller with the specific subagent it just
 * started.
 */
export function useWalkerCommands(state: OfficeState) {
  const stateRef = useRef(state);
  stateRef.current = state;

  const matcherRef = useRef(createVisitMatcher());
  const commandsRef = useRef<Map<string, WalkCommand>>(new Map());

  const onRawEvent = useCallback((event: RawEvent) => {
    const result = matcherRef.current(event);
    if (!result) return;

    const now = performance.now();
    const callerKey = keyFor(result.caller.agentType, result.caller.agentId);
    const targetKey = keyFor(result.target.agentType, result.target.agentId);
    const callerHome = homePositionFor(stateRef.current, result.caller.agentType, result.caller.agentId);
    const targetHome = homePositionFor(stateRef.current, result.target.agentType, result.target.agentId);

    commandsRef.current.set(callerKey, {
      phase: "walking-to-visit",
      role: "caller",
      target: targetHome,
      home: callerHome,
      phaseStartedAt: now,
      partnerKey: targetKey,
    });
  }, []);

  return { commandsRef, onRawEvent };
}
