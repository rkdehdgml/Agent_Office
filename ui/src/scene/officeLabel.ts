import { HQ_ROOM } from "../officeReducer";
import { teamNameFor } from "./teamLabels";
import { rankFor } from "./rank";

export function labelFor(agentType: string, completedCount: number, isFixed: boolean): string {
  const team = teamNameFor(agentType);
  if (agentType === HQ_ROOM) return `${team} · 부장`;
  const rank = isFixed ? "팀장" : rankFor(completedCount);
  return `${team} · ${rank}`;
}
