import { useCallback, useEffect, useReducer, useRef } from "react";
import { applyEvent, initialOfficeState, revertStatusEvent } from "./officeReducer";
import { useEventSocket } from "./useEventSocket";
import { useWalkerCommands } from "./scene/useWalkerCommands";
import { OfficeScene } from "./scene/OfficeScene";
import { EventLog } from "./components/EventLog";
import type { RawEvent } from "./types";
import "./App.css";

function reducer(state = initialOfficeState(), event: RawEvent) {
  return applyEvent(state, event);
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialOfficeState);
  const { commandsRef, onRawEvent } = useWalkerCommands(state);

  const handleEvent = useCallback(
    (event: RawEvent) => {
      dispatch(event);
      onRawEvent(event);
    },
    [onRawEvent]
  );
  const { connected } = useEventSocket(handleEvent);

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    for (const room of Object.values(state.rooms)) {
      for (const character of Object.values(room.characters)) {
        const key = `${character.agentType}/${character.agentId}`;
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

  return (
    <div className="office">
      <header className="office-header">
        <h1>🏢 Agent Office</h1>
        <span className={`ws-status ${connected ? "on" : "off"}`}>{connected ? "연결됨" : "연결 끊김"}</span>
      </header>
      <div className="office-body">
        <div className="scene-container">
          <OfficeScene state={state} commandsRef={commandsRef} />
        </div>
        <EventLog entries={state.log} />
      </div>
    </div>
  );
}
