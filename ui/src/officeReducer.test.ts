import { describe, expect, it } from "vitest";
import { applyEvent, initialOfficeState, HQ_ROOM } from "./officeReducer";
import type { RawEvent } from "./types";

describe("applyEvent", () => {
  it("creates a room and character on SubagentStart", () => {
    const event: RawEvent = { hook_event_name: "SubagentStart", agent_id: "a1", agent_type: "research-dept" };
    const state = applyEvent(initialOfficeState(), event);
    const character = state.rooms["research-dept"].characters["a1"];
    expect(character.status).toBe("출근");
    expect(character.active).toBe(true);
  });

  it("maps PreToolUse tool_name to the correct status", () => {
    let state = applyEvent(initialOfficeState(), {
      hook_event_name: "SubagentStart",
      agent_id: "a1",
      agent_type: "research-dept",
    });
    state = applyEvent(state, {
      hook_event_name: "PreToolUse",
      agent_id: "a1",
      agent_type: "research-dept",
      tool_name: "Read",
    });
    expect(state.rooms["research-dept"].characters["a1"].status).toBe("자료 찾는 중 🔍");
  });

  it("falls back to '작업 중' for an unmapped tool_name", () => {
    const state = applyEvent(initialOfficeState(), {
      hook_event_name: "PreToolUse",
      agent_id: "a1",
      agent_type: "research-dept",
      tool_name: "SomeOtherTool",
    });
    expect(state.rooms["research-dept"].characters["a1"].status).toBe("작업 중");
  });

  it("routes events without agent_type to the HQ room", () => {
    const state = applyEvent(initialOfficeState(), { hook_event_name: "UserPromptSubmit" });
    expect(state.rooms[HQ_ROOM].characters[HQ_ROOM].status).toBe("지시 접수 📨");
  });

  it("marks the character inactive on SubagentStop", () => {
    let state = applyEvent(initialOfficeState(), {
      hook_event_name: "SubagentStart",
      agent_id: "a1",
      agent_type: "dev-dept",
    });
    state = applyEvent(state, { hook_event_name: "SubagentStop", agent_id: "a1", agent_type: "dev-dept" });
    const character = state.rooms["dev-dept"].characters["a1"];
    expect(character.status).toBe("퇴근");
    expect(character.active).toBe(false);
  });

  it("ignores an unknown hook_event_name for state but still logs it", () => {
    const state = applyEvent(initialOfficeState(), { hook_event_name: "SomeFutureEvent", agent_type: "dev-dept" });
    expect(state.rooms["dev-dept"]).toBeUndefined();
    expect(state.log).toHaveLength(1);
    expect(state.log[0].hookEventName).toBe("SomeFutureEvent");
  });

  it("does not throw when agent_id, agent_type, and hook_event_name are all missing", () => {
    expect(() => applyEvent(initialOfficeState(), {})).not.toThrow();
  });
});
