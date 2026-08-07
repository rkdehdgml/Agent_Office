export interface HookEvent {
  hook_event_name?: string;
  session_id?: string;
  agent_id?: string;
  agent_type?: string;
  tool_name?: string;
  tool_input?: unknown;
  cwd?: string;
  [key: string]: unknown;
}

export interface ReceivedEvent extends HookEvent {
  receivedAt: number;
}
