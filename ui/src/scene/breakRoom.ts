import type { Character, OfficeState } from "../officeReducer";

export function isIdleForBreakRoom(character: Character): boolean {
  return character.active && character.status === "출근";
}

export function pickBreakRoomVisitors(
  state: OfficeState,
  alreadyVisitingKeys: Set<string>,
  maxVisitors: number,
  random: () => number = Math.random
): Array<{ agentType: string; agentId: string }> {
  const slotsFree = maxVisitors - alreadyVisitingKeys.size;
  if (slotsFree <= 0) return [];

  const candidates = Object.values(state.rooms)
    .flatMap((room) => Object.values(room.characters))
    .filter((c) => isIdleForBreakRoom(c) && !alreadyVisitingKeys.has(`${c.agentType}/${c.agentId}`));

  const shuffled = [...candidates].sort(() => random() - 0.5);
  return shuffled.slice(0, slotsFree).map((c) => ({ agentType: c.agentType, agentId: c.agentId }));
}
