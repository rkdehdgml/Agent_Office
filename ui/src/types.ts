export interface RawEvent {
  hook_event_name?: string;
  session_id?: string;
  agent_id?: string;
  agent_type?: string;
  tool_name?: string;
  tool_input?: unknown;
  cwd?: string;
  receivedAt?: number;
  [key: string]: unknown;
}
