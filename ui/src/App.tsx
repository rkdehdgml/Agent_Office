import { useEffect, useReducer, useRef } from "react";
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
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Schedules exactly one revert timer per agentId the moment it enters "완료 ✅",
  // rather than re-deriving all timers from the whole state on every event — a
  // dependency on the full `state` object would otherwise cancel and re-arm every
  // in-flight timer whenever *any* other agent's event arrives, starving the
  // 1.5s flash under real concurrent multi-agent activity.
  useEffect(() => {
    for (const room of Object.values(state.rooms)) {
      for (const character of Object.values(room.characters)) {
        const key = character.agentId;
        if (character.status === "완료 ✅") {
          if (!timersRef.current.has(key)) {
            const timer = setTimeout(() => {
              timersRef.current.delete(key);
              dispatch(revertStatusEvent(character.agentType, character.agentId));
            }, 1500);
            timersRef.current.set(key, timer);
          }
        } else {
          const existing = timersRef.current.get(key);
          if (existing) {
            clearTimeout(existing);
            timersRef.current.delete(key);
          }
        }
      }
    }
  }, [state]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

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
