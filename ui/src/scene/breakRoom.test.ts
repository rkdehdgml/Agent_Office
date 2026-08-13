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
    // Candidates start in insertion order [a, b, c]. With a constant
    // random() = 0.5, the Fisher-Yates walk is:
    //   i=2: j = floor(0.5 * 3) = 1 -> swap(2,1): [a, c, b]
    //   i=1: j = floor(0.5 * 2) = 1 -> swap(1,1): [a, c, b]
    // so the shuffled order is deterministically [a, c, b], and the top 2
    // free slots pick [a, c].
    const picks = pickBreakRoomVisitors(state, new Set(), 2, () => 0.5);
    expect(picks.map((p) => p.agentId)).toEqual(["a", "c"]);
  });

  it("actually reorders candidates via a real Fisher-Yates shuffle (not a no-op)", () => {
    const state = stateWith([
      char({ agentId: "a", status: "출근" }),
      char({ agentId: "b", status: "출근" }),
      char({ agentId: "c", status: "출근" }),
    ]);
    // With a constant random() = 0, the Fisher-Yates walk is:
    //   i=2: j = floor(0 * 3) = 0 -> swap(2,0): [c, b, a]
    //   i=1: j = floor(0 * 2) = 0 -> swap(1,0): [b, c, a]
    // so the full shuffled order is [b, c, a] -- distinctly reordered from
    // the original insertion order [a, b, c]. This would fail if the
    // shuffle were removed (identity order) or reverted to the broken
    // sort-comparator pattern (which leaves a constant-comparing input
    // unchanged).
    const picks = pickBreakRoomVisitors(state, new Set(), 3, () => 0);
    expect(picks.map((p) => p.agentId)).toEqual(["b", "c", "a"]);
  });
});
