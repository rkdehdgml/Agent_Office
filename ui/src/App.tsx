import { useEffect, useReducer } from "react";
import { applyEvent, initialOfficeState, revertStatusEvent } from "./officeReducer";
import { useEventSocket } from "./useEventSocket";
import { RoomView } from "./components/Room";
import { EventLog } from "./components/EventLog";
import type { RawEvent } from "./types";
import "./App.css";

function reducer(state = initialOfficeState(), event: RawEvent) {
  return applyEvent(state, event);
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialOfficeState);
  const { connected } = useEventSocket(dispatch);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const room of Object.values(state.rooms)) {
      for (const character of Object.values(room.characters)) {
        if (character.status === "완료 ✅") {
          timers.push(
            setTimeout(() => {
              dispatch(revertStatusEvent(character.agentType, character.agentId));
            }, 1500)
          );
        }
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [state]);

  const rooms = Object.values(state.rooms);

  return (
    <div className="office">
      <header className="office-header">
        <h1>🏢 Agent Office</h1>
        <span className={`ws-status ${connected ? "on" : "off"}`}>{connected ? "연결됨" : "연결 끊김"}</span>
      </header>
      <div className="room-grid">
        {rooms.length === 0 ? (
          <p className="empty-hint">아직 활동이 없습니다. Claude Code 세션을 시작해보세요.</p>
        ) : (
          rooms.map((room) => <RoomView key={room.agentType} room={room} />)
        )}
      </div>
      <EventLog entries={state.log} />
    </div>
  );
}
