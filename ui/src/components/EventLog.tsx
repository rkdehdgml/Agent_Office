import type { LogEntry } from "../officeReducer";
import { teamNameFor } from "../scene/teamLabels";

export function EventLog({ entries }: { entries: LogEntry[] }) {
  const recent = entries.slice(-50).reverse();
  return (
    <div className="event-log">
      <div className="event-log-header">이벤트 로그</div>
      <div className="event-log-body">
        {recent.map((e) => (
          <div key={e.id} className="event-log-row">
            <span className="log-time">{new Date(e.receivedAt).toLocaleTimeString()}</span>
            <span className="log-name">{e.hookEventName}</span>
            <span className="log-agent">{teamNameFor(e.agentType)}</span>
            <span className="log-tool">{e.toolName || "-"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
