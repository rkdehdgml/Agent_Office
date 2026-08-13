import { HQ_ROOM } from "../officeReducer";
import type { OfficeState } from "../officeReducer";

export interface Vec2 {
  x: number;
  z: number;
}

const DESK_SLOTS: Record<string, Vec2[]> = {
  "research-dept": [
    { x: -10, z: -6 },
    { x: -8, z: -6 },
    { x: -6, z: -6 },
  ],
  "planning-dept": [
    { x: -2, z: -6 },
    { x: 0, z: -6 },
    { x: 2, z: -6 },
  ],
  "design-publishing-dept": [
    { x: 6, z: -6 },
    { x: 8, z: -6 },
    { x: 10, z: -6 },
  ],
  "dev-dept": [
    { x: -10, z: 6 },
    { x: -8, z: 6 },
    { x: -6, z: 6 },
  ],
  [HQ_ROOM]: [{ x: 0, z: 6 }],
};

const DEFAULT_SLOTS: Vec2[] = [
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: -1, z: 0 },
];

const LEAD_SLOTS: Record<string, Vec2> = {
  "research-dept": { x: -8, z: -7 },
  "planning-dept": { x: 0, z: -7 },
  "design-publishing-dept": { x: 8, z: -7 },
  "dev-dept": { x: -8, z: 7 },
};

const DEFAULT_LEAD_SLOT: Vec2 = { x: 0, z: 0 };

export const BREAK_ROOM_SLOTS: Vec2[] = [
  { x: 7, z: 4 },
  { x: 9, z: 4 },
];

export function deskSlotsFor(agentType: string): Vec2[] {
  return DESK_SLOTS[agentType] ?? DEFAULT_SLOTS;
}

export function deskPositionFor(agentType: string, orderIndex: number): Vec2 {
  const slots = deskSlotsFor(agentType);
  return slots[orderIndex % slots.length];
}

/**
 * The fixed desk position for a team's always-present team-lead character.
 * Reserved separately from `DESK_SLOTS` so the earned-rank cycling in
 * `deskPositionFor` never assigns a real dynamic character into a
 * team-lead's seat.
 */
export function leadSlotFor(agentType: string): Vec2 {
  return LEAD_SLOTS[agentType] ?? DEFAULT_LEAD_SLOT;
}

/**
 * The fixed "home desk" position for a specific character, derived from
 * their room membership order (stable sort of agentIds within the room).
 * Falls back to slot 0 if the room/character doesn't exist yet in `state`
 * — this happens routinely for a split second right after a SubagentStart
 * event, since the walker system computes a target position synchronously
 * (from the raw event stream) before React has re-rendered the reducer's
 * state; slot 0 is an acceptable approximation for that brief window.
 */
export function homePositionFor(state: OfficeState, agentType: string, agentId: string): Vec2 {
  const room = state.rooms[agentType];
  if (!room) return deskPositionFor(agentType, 0);
  const orderedIds = Object.keys(room.characters).sort();
  const index = orderedIds.indexOf(agentId);
  return deskPositionFor(agentType, index === -1 ? 0 : index);
}
