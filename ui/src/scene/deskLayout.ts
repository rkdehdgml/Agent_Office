import { HQ_ROOM } from "../officeReducer";
import type { OfficeState } from "../officeReducer";

export interface Vec2 {
  x: number;
  z: number;
}

const DESK_SLOTS: Record<string, Vec2[]> = {
  "research-dept": [
    { x: -6, z: -4 },
    { x: -4, z: -4 },
    { x: -6, z: -2 },
  ],
  "planning-dept": [
    { x: 2, z: -4 },
    { x: 4, z: -4 },
    { x: 2, z: -2 },
  ],
  "dev-dept": [
    { x: -6, z: 2 },
    { x: -4, z: 2 },
    { x: -6, z: 4 },
  ],
  [HQ_ROOM]: [
    { x: 2, z: 2 },
    { x: 4, z: 2 },
    { x: 2, z: 4 },
  ],
};

const DEFAULT_SLOTS: Vec2[] = [
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: -1, z: 0 },
];

export function deskSlotsFor(agentType: string): Vec2[] {
  return DESK_SLOTS[agentType] ?? DEFAULT_SLOTS;
}

export function deskPositionFor(agentType: string, orderIndex: number): Vec2 {
  const slots = deskSlotsFor(agentType);
  return slots[orderIndex % slots.length];
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
