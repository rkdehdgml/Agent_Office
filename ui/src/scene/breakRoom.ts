import type { Character, OfficeState } from "../officeReducer";

export function isIdleForBreakRoom(character: Character): boolean {
  return character.active && character.status === "출근";
}

/**
 * Fisher-Yates shuffle driven by an injected random function. Replaces the
 * well-known broken `array.sort(() => random() - 0.5)` pattern, which is
 * non-transitive and biased (and with a constant comparator like `() =>
 * 0.5` doesn't shuffle at all, since a stable sort leaves equal-comparing
 * elements in their original order).
 */
function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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

  const shuffled = shuffle(candidates, random);
  return shuffled.slice(0, slotsFree).map((c) => ({ agentType: c.agentType, agentId: c.agentId }));
}
