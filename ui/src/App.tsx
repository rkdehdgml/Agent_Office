import { useReducer } from "react";
import { applyEvent, initialOfficeState } from "./officeReducer";
import { useEventSocket } from "./useEventSocket";
import type { RawEvent } from "./types";

function reducer(state = initialOfficeState(), event: RawEvent) {
  return applyEvent(state, event);
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialOfficeState);
  const { connected } = useEventSocket(dispatch);

  return (
    <div style={{ fontFamily: "monospace", padding: 16, color: "#eee", background: "#111", minHeight: "100vh" }}>
      <p>WS connected: {String(connected)}</p>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  );
}
