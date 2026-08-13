import { describe, expect, it } from "vitest";
import { deskPositionFor, deskSlotsFor, homePositionFor, leadSlotFor, BREAK_ROOM_SLOTS } from "./deskLayout";
import { initialOfficeState, HQ_ROOM } from "../officeReducer";
import type { OfficeState, CharacterStatus } from "../officeReducer";

describe("deskSlotsFor", () => {
  it("returns fixed slots for a known department", () => {
    expect(deskSlotsFor("dev-dept").length).toBeGreaterThan(0);
  });

  it("falls back to the same default slots for any unknown department", () => {
    expect(deskSlotsFor("unknown-dept-a")).toEqual(deskSlotsFor("unknown-dept-b"));
  });
});

describe("deskPositionFor", () => {
  it("cycles back to slot 0 when orderIndex exceeds the slot count", () => {
    const slots = deskSlotsFor("research-dept");
    expect(deskPositionFor("research-dept", slots.length)).toEqual(slots[0]);
  });

  it("returns distinct positions for distinct order indexes within range", () => {
    expect(deskPositionFor("dev-dept", 0)).not.toEqual(deskPositionFor("dev-dept", 1));
  });
});

describe("homePositionFor", () => {
  const ACTIVE: CharacterStatus = "출근";

  function stateWithCharacters(agentType: string, agentIds: string[]): OfficeState {
    const state = initialOfficeState();
    return {
      ...state,
      rooms: {
        ...state.rooms,
        [agentType]: {
          agentType,
          characters: Object.fromEntries(
            agentIds.map((id) => [
              id,
              { agentId: id, agentType, status: ACTIVE, previousStatus: ACTIVE, active: true, completedCount: 0 },
            ])
          ),
        },
      },
    };
  }

  it("assigns desk positions by sorted agentId order within the room", () => {
    const state = stateWithCharacters("dev-dept", ["b", "a"]);
    expect(homePositionFor(state, "dev-dept", "a")).toEqual(deskPositionFor("dev-dept", 0));
    expect(homePositionFor(state, "dev-dept", "b")).toEqual(deskPositionFor("dev-dept", 1));
  });

  it("falls back to slot 0 when the room doesn't exist yet", () => {
    const state = initialOfficeState();
    expect(homePositionFor(state, "research-dept", "ghost")).toEqual(deskPositionFor("research-dept", 0));
  });

  it("returns the HQ desk position for the HQ_ROOM constant", () => {
    const state = stateWithCharacters(HQ_ROOM, [HQ_ROOM]);
    expect(homePositionFor(state, HQ_ROOM, HQ_ROOM)).toEqual(deskPositionFor(HQ_ROOM, 0));
  });
});

describe("deskSlotsFor — 5-room layout", () => {
  it("gives the new design-publishing-dept 3 slots like the other teams", () => {
    expect(deskSlotsFor("design-publishing-dept").length).toBe(3);
  });

  it("gives HQ exactly 1 slot", () => {
    expect(deskSlotsFor(HQ_ROOM).length).toBe(1);
  });
});

describe("leadSlotFor", () => {
  it("returns a distinct fixed position for each of the 4 teams", () => {
    const positions = ["research-dept", "planning-dept", "dev-dept", "design-publishing-dept"].map(leadSlotFor);
    const unique = new Set(positions.map((p) => `${p.x},${p.z}`));
    expect(unique.size).toBe(4);
  });

  it("never overlaps a team's own earned-rank desk slots", () => {
    for (const dept of ["research-dept", "planning-dept", "dev-dept", "design-publishing-dept"]) {
      const lead = leadSlotFor(dept);
      const earned = deskSlotsFor(dept);
      expect(earned).not.toContainEqual(lead);
    }
  });
});

describe("BREAK_ROOM_SLOTS", () => {
  it("has exactly 2 distinct positions", () => {
    expect(BREAK_ROOM_SLOTS.length).toBe(2);
    expect(BREAK_ROOM_SLOTS[0]).not.toEqual(BREAK_ROOM_SLOTS[1]);
  });
});
