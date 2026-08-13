import type { RawEvent } from "./types";

export type CharacterStatus =
  | "출근"
  | "자료 찾는 중 🔍"
  | "작성 중 ✍️"
  | "명령 실행 중 ⚙️"
  | "검색 중 🌐"
  | "업무 지시 중 📋"
  | "작업 중"
  | "완료 ✅"
  | "문제 발생 ⚠️"
  | "퇴근"
  | "지시 접수 📨"
  | "업무 종료";

export interface Character {
  agentId: string;
  agentType: string;
  status: CharacterStatus;
  previousStatus: CharacterStatus;
  active: boolean;
  completedCount: number;
}

export interface Room {
  agentType: string;
  characters: Record<string, Character>;
}

export interface LogEntry {
  id: string;
  receivedAt: number;
  hookEventName: string;
  agentType: string;
  toolName: string;
}

export interface OfficeState {
  rooms: Record<string, Room>;
  log: LogEntry[];
}

export const HQ_ROOM = "본부";

const TOOL_STATUS: Record<string, CharacterStatus> = {
  Read: "자료 찾는 중 🔍",
  Glob: "자료 찾는 중 🔍",
  Grep: "자료 찾는 중 🔍",
  Write: "작성 중 ✍️",
  Edit: "작성 중 ✍️",
  Bash: "명령 실행 중 ⚙️",
  WebSearch: "검색 중 🌐",
  WebFetch: "검색 중 🌐",
  Agent: "업무 지시 중 📋",
};

function ensureRoom(state: OfficeState, agentType: string): OfficeState {
  if (state.rooms[agentType]) return state;
  return {
    ...state,
    rooms: { ...state.rooms, [agentType]: { agentType, characters: {} } },
  };
}

function updateCharacter(
  state: OfficeState,
  agentType: string,
  agentId: string,
  update: (c: Character) => Character
): OfficeState {
  const withRoom = ensureRoom(state, agentType);
  const room = withRoom.rooms[agentType];
  const existing: Character = room.characters[agentId] ?? {
    agentId,
    agentType,
    status: "작업 중",
    previousStatus: "작업 중",
    active: true,
    completedCount: 0,
  };
  const updated = update(existing);
  return {
    ...withRoom,
    rooms: {
      ...withRoom.rooms,
      [agentType]: {
        ...room,
        characters: { ...room.characters, [agentId]: updated },
      },
    },
  };
}

export function applyEvent(state: OfficeState, event: RawEvent): OfficeState {
  const name = event.hook_event_name;
  const agentType = event.agent_type ?? HQ_ROOM;
  const agentId = event.agent_id ?? HQ_ROOM;
  const toolName = event.tool_name ?? "";

  let next = state;
  if (name && !name.startsWith("__")) {
    const log: LogEntry = {
      id: `${event.receivedAt ?? Date.now()}-${Math.random().toString(36).slice(2)}`,
      receivedAt: event.receivedAt ?? Date.now(),
      hookEventName: name,
      agentType,
      toolName,
    };
    next = { ...state, log: [...state.log, log].slice(-200) };
  }

  switch (name) {
    case "SubagentStart":
      return updateCharacter(next, agentType, agentId, (c) => ({
        ...c,
        status: "출근",
        previousStatus: "출근",
        active: true,
        completedCount: 0,
      }));
    case "PreToolUse": {
      const status = TOOL_STATUS[toolName] ?? "작업 중";
      return updateCharacter(next, agentType, agentId, (c) => ({
        ...c,
        status,
        previousStatus: status,
        active: true,
      }));
    }
    case "PostToolUse":
      return updateCharacter(next, agentType, agentId, (c) => ({
        ...c,
        status: "완료 ✅",
        previousStatus: c.status,
        active: true,
        completedCount: c.completedCount + 1,
      }));
    case "PostToolUseFailure":
      return updateCharacter(next, agentType, agentId, (c) => ({
        ...c,
        status: "문제 발생 ⚠️",
        previousStatus: "문제 발생 ⚠️",
        active: true,
      }));
    case "SubagentStop":
      return updateCharacter(next, agentType, agentId, (c) => ({
        ...c,
        status: "퇴근",
        previousStatus: "퇴근",
        active: false,
      }));
    case "UserPromptSubmit":
      return updateCharacter(next, HQ_ROOM, HQ_ROOM, (c) => ({
        ...c,
        status: "지시 접수 📨",
        previousStatus: "지시 접수 📨",
        active: true,
      }));
    case "Stop":
      return updateCharacter(next, HQ_ROOM, HQ_ROOM, (c) => ({
        ...c,
        status: "업무 종료",
        previousStatus: "업무 종료",
        active: true,
      }));
    case "__revertStatus":
      return updateCharacter(next, agentType, agentId, (c) =>
        c.status === "완료 ✅" ? { ...c, status: c.previousStatus } : c
      );
    default:
      return next;
  }
}

export function initialOfficeState(): OfficeState {
  return { rooms: {}, log: [] };
}

export function revertStatusEvent(agentType: string, agentId: string): RawEvent {
  return { hook_event_name: "__revertStatus", agent_type: agentType, agent_id: agentId };
}
