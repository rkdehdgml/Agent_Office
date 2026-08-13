import { HQ_ROOM } from "../officeReducer";

const TEAM_NAMES: Record<string, string> = {
  "research-dept": "리서치팀",
  "planning-dept": "기획팀",
  "dev-dept": "개발팀",
  "design-publishing-dept": "디자인퍼블리싱팀",
};

export function teamNameFor(agentType: string): string {
  if (agentType === HQ_ROOM) return "본부";
  return TEAM_NAMES[agentType] ?? agentType;
}
