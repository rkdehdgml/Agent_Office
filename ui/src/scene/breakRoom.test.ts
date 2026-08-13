import { describe, expect, it } from "vitest";
import { isIdleForBreakRoom, pickBreakRoomVisitors } from "./breakRoom";
import { initialOfficeState } from "../officeReducer";
import type { Character, OfficeState } from "../officeReducer";

function char(overrides: Partial<Character>): Character {
  return {
    agentId: "a",
    agentType: "dev-dept",
    status: "출근",
    previousStatus: "출근",
    active: true,
    completedCount: 0,
    ...overrides,
  };
}

describe("isIdleForBreakRoom", () => {
  it("is true for an active character still at 출근 status", () => {
    expect(isIdleForBreakRoom(char({ status: "출근", active: true }))).toBe(true);
  });

  it("is false once the character has picked up any work", () => {
    expect(isIdleForBreakRoom(char({ status: "작업 중", active: true }))).toBe(false);
  });

  it("is false for an inactive (offline) character", () => {
    expect(isIdleForBreakRoom(char({ status: "출근", active: false }))).toBe(false);
  });
});

describe("pickBreakRoomVisitors", () => {
  function stateWith(chars: Character[]): OfficeState {
    const state = initialOfficeState();
    for (const c of chars) {
      state.rooms[c.agentType] = state.rooms[c.agentType] ?? { agentType: c.agentType, characters: {} };
      state.rooms[c.agentType].characters[c.agentId] = c;
    }
    return state;
  }

  it("returns nothing when there are no idle candidates", () => {
    const state = stateWith([char({ agentId: "a", status: "작업 중" })]);
    expect(pickBreakRoomVisitors(state, new Set(), 2)).toEqual([]);
  });

  it("returns nothing once maxVisitors is already reached", () => {
    const state = stateWith([char({ agentId: "a", status: "출근" })]);
    const alreadyVisiting = new Set(["dev-dept/x", "dev-dept/y"]);
    expect(pickBreakRoomVisitors(state, alreadyVisiting, 2)).toEqual([]);
  });

  it("never re-picks a character already visiting", () => {
    const state = stateWith([char({ agentId: "a", status: "출근" })]);
    const alreadyVisiting = new Set(["dev-dept/a"]);
    expect(pickBreakRoomVisitors(state, alreadyVisiting, 2)).toEqual([]);
  });

  it("picks up to the remaining free slots, using the injected random function", () => {
    const state = stateWith([
      char({ agentId: "a", status: "출근" }),
      char({ agentId: "b", status: "출근" }),
      char({ agentId: "c", status: "출근" }),
    ]);
    const picks = pickBreakRoomVisitors(state, new Set(), 2, () => 0.5);
    expect(picks.length).toBe(2);
    const ids = picks.map((p) => p.agentId);
    expect(new Set(ids).size).toBe(2);
  });
});
