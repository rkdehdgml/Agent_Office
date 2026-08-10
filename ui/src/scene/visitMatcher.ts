import { HQ_ROOM } from "../officeReducer";
import type { RawEvent } from "../types";

export interface AgentRef {
  agentType: string;
  agentId: string;
}

export interface VisitCommand {
  caller: AgentRef;
  target: AgentRef;
}

/**
 * Tracks the single most recent "about to call a subagent" event
 * (PreToolUse with tool_name "Agent") and pairs it with the SubagentStart
 * that follows, producing a VisitCommand the 3D layer uses to animate the
 * caller walking to the new subagent's desk. Only one call is tracked at a
 * time (last write wins) — an intentional approximation for a personal
 * tool, not a queue for perfectly concurrent calls.
 */
export function createVisitMatcher() {
  let pending: AgentRef | null = null;

  return function onEvent(event: RawEvent): VisitCommand | null {
    const name = event.hook_event_name;
    if (name === "PreToolUse" && event.tool_name === "Agent") {
      pending = { agentType: event.agent_type ?? HQ_ROOM, agentId: event.agent_id ?? HQ_ROOM };
      return null;
    }
    if (name === "SubagentStart" && pending) {
      const target: AgentRef = { agentType: event.agent_type ?? HQ_ROOM, agentId: event.agent_id ?? HQ_ROOM };
      const command: VisitCommand = { caller: pending, target };
      pending = null;
      return command;
    }
    return null;
  };
}
