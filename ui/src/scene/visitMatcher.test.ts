import { describe, expect, it } from "vitest";
import { createVisitMatcher } from "./visitMatcher";
import { HQ_ROOM } from "../officeReducer";

describe("createVisitMatcher", () => {
  it("returns null for unrelated events", () => {
    const matcher = createVisitMatcher();
    expect(matcher({ hook_event_name: "PostToolUse" })).toBeNull();
  });

  it("returns null on PreToolUse(Agent) itself, then a VisitCommand on the following SubagentStart", () => {
    const matcher = createVisitMatcher();
    const first = matcher({ hook_event_name: "PreToolUse", tool_name: "Agent" });
    expect(first).toBeNull();

    const second = matcher({ hook_event_name: "SubagentStart", agent_type: "dev-dept", agent_id: "d1" });
    expect(second).toEqual({
      caller: { agentType: HQ_ROOM, agentId: HQ_ROOM },
      target: { agentType: "dev-dept", agentId: "d1" },
    });
  });

  it("does not treat PreToolUse for a different tool as a pending call", () => {
    const matcher = createVisitMatcher();
    matcher({ hook_event_name: "PreToolUse", tool_name: "Bash" });
    const result = matcher({ hook_event_name: "SubagentStart", agent_type: "dev-dept", agent_id: "d1" });
    expect(result).toBeNull();
  });

  it("consumes the pending caller so a second SubagentStart without a new call returns null", () => {
    const matcher = createVisitMatcher();
    matcher({ hook_event_name: "PreToolUse", tool_name: "Agent" });
    matcher({ hook_event_name: "SubagentStart", agent_type: "dev-dept", agent_id: "d1" });
    const second = matcher({ hook_event_name: "SubagentStart", agent_type: "research-dept", agent_id: "r1" });
    expect(second).toBeNull();
  });

  it("preserves the caller's own agent_type/agent_id when a subagent calls another subagent", () => {
    const matcher = createVisitMatcher();
    matcher({ hook_event_name: "PreToolUse", tool_name: "Agent", agent_type: "dev-dept", agent_id: "d1" });
    const result = matcher({ hook_event_name: "SubagentStart", agent_type: "research-dept", agent_id: "r1" });
    expect(result).toEqual({
      caller: { agentType: "dev-dept", agentId: "d1" },
      target: { agentType: "research-dept", agentId: "r1" },
    });
  });
});
