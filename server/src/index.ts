import express from "express";
import type { NextFunction, Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { EventStore } from "./eventStore.js";
import type { HookEvent } from "./types.js";

const HTTP_PORT = 4000;
const WS_PORT = 4001;

const store = new EventStore();
const app = express();
app.use(express.json());

app.post("/events", (req, res) => {
  const body = req.body as HookEvent;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "invalid body" });
    return;
  }
  res.status(200).json({ ok: true });

  const received = store.add(body);
  console.log(
    `[event] ${received.hook_event_name ?? "unknown"} agent_type=${received.agent_type ?? "-"} tool=${received.tool_name ?? "-"}`
  );
  broadcast(received);
});

app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  res.status(400).json({ error: "invalid json" });
});

app.listen(HTTP_PORT, () => {
  console.log(`Event server listening on http://localhost:${HTTP_PORT}`);
});

const wss = new WebSocketServer({ port: WS_PORT });

function broadcast(event: unknown) {
  const payload = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

wss.on("connection", (socket) => {
  console.log("WS client connected, sending history");
  for (const event of store.getHistory()) {
    socket.send(JSON.stringify(event));
  }

  socket.on("error", (err) => {
    console.error("[ws socket error]", err);
  });
});

wss.on("error", (err) => {
  console.error("[ws server error]", err);
});

wss.on("listening", () => {
  console.log(`WebSocket server listening on ws://localhost:${WS_PORT}`);
});
