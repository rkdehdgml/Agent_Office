import { useEffect, useRef, useState } from "react";
import type { RawEvent } from "./types";

const WS_URL = "ws://localhost:4001";
const RECONNECT_DELAY_MS = 1500;

export function useEventSocket(onEvent: (event: RawEvent) => void) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function connect() {
      socket = new WebSocket(WS_URL);
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
      socket.onerror = () => socket?.close();
      socket.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data) as RawEvent;
          onEventRef.current(parsed);
        } catch {
          // 잘못된 메시지는 무시하고 계속 진행
        }
      };
    }

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return { connected };
}
