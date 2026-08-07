# Agent Office Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only tool that visualizes Claude Code agent activity (main thread + subagents) as a live miniature office, driven by HTTP hooks → an Express/WS event server → a React UI.

**Architecture:** Claude Code HTTP hooks POST every lifecycle event to an Express server on port 4000. The server timestamps and stores the last 200 events in memory, then broadcasts them over a WebSocket server on port 4001. The React UI (Vite) connects to the WebSocket, replays history on connect, and reduces the event stream into an "office state" (rooms keyed by `agent_type`, characters keyed by `agent_id`) that drives the visuals.

**Tech Stack:** TypeScript throughout. `server/`: Express + `ws`, run via `tsx` (no build step). `ui/`: Vite + React + TypeScript. Root: `concurrently` to run both with one command. No test framework for the server or UI rendering — verification is via `curl` and manual browser checks, per the spec's explicit choice — except `ui/src/officeReducer.ts`, which gets a small `vitest` unit suite.

## Global Constraints

- HTTP event endpoint: `POST http://localhost:4000/events`, must respond `200` **before** doing any broadcast/logging work.
- WebSocket server: `ws://localhost:4001`.
- In-memory history: last **200** events only, no disk persistence.
- New WS clients receive the full history immediately on connect.
- Hook `timeout`: `5` (seconds), `matcher` omitted (matches everything), for these events: `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `Stop`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `SubagentStart`, `SubagentStop`.
- Character identity = `agent_id`. Room grouping = `agent_type` (missing → room `"본부"`).
- UI must never crash on unknown `hook_event_name` or missing fields — ignore/default defensively.
- No automated test suite for the server or the UI's rendered output — verify those with `curl` and/or a browser check as specified in that task's steps (per spec, this is an intentional scope choice for a personal local tool).
- Exception: `ui/src/officeReducer.ts` (the core event→state mapping logic) gets a small `vitest` unit test suite (`ui/src/officeReducer.test.ts`), since it's pure, high-value-to-verify logic. This is the only automated test file in the project — do not add tests elsewhere.
- A local git repository was initialized specifically to support this plan's subagent-driven execution (task-scoped commits, diffs, and rollback). Commit at the end of each task as usual. There is no remote — never push.
- Ports are fixed: server HTTP `4000`, server WS `4001`, UI dev server `5173` (Vite default).

---

### Task 1: Event Server (POST /events + WS broadcast + history)

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/types.ts`
- Create: `server/src/eventStore.ts`
- Create: `server/src/index.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: running server exposing `POST http://localhost:4000/events` and `ws://localhost:4001`. `server/package.json` has a `dev` script (`tsx watch src/index.ts`) that Task 6 wires into the root `npm run dev`.

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "agent-office-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "express": "^4.19.2",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0",
    "@types/ws": "^8.5.10",
    "tsx": "^4.16.2",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install --prefix server`
Expected: exits 0, `server/node_modules` and `server/package-lock.json` created.

- [ ] **Step 4: Create `server/src/types.ts`**

```ts
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
```

- [ ] **Step 5: Create `server/src/eventStore.ts`**

```ts
import type { HookEvent, ReceivedEvent } from "./types.js";

const MAX_HISTORY = 200;

export class EventStore {
  private history: ReceivedEvent[] = [];

  add(event: HookEvent): ReceivedEvent {
    const received: ReceivedEvent = { ...event, receivedAt: Date.now() };
    this.history.push(received);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
    return received;
  }

  getHistory(): ReceivedEvent[] {
    return this.history;
  }
}
```

- [ ] **Step 6: Create `server/src/index.ts`**

```ts
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
  socket.on("error", (err) => {
    console.error("WS client socket error:", err);
  });
  for (const event of store.getHistory()) {
    socket.send(JSON.stringify(event));
  }
});

wss.on("error", (err) => {
  console.error("WebSocketServer error:", err);
});

wss.on("listening", () => {
  console.log(`WebSocket server listening on ws://localhost:${WS_PORT}`);
});
```

- [ ] **Step 7: Start the server in the background**

Run: `npm --prefix server run dev > /tmp/agent-office-server.log 2>&1 &` (or use the Bash tool's `run_in_background: true` on `npm --prefix server run dev`)
Expected: after ~2s, the log contains `Event server listening on http://localhost:4000` and `WebSocket server listening on ws://localhost:4001`.

- [ ] **Step 8: Verify a valid POST returns 200 and logs**

Run:
```bash
curl -s -o /tmp/agent-office-resp.json -w "%{http_code}" -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{"hook_event_name":"SessionStart","session_id":"test-1"}'
```
Expected: prints `200`. The server log (from Step 7) gains a line: `[event] SessionStart agent_type=- tool=-`.

- [ ] **Step 9: Verify malformed JSON returns 400 without crashing the server**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{not valid json'
```
Expected: prints `400`. Immediately after, re-run Step 8's curl — it must still return `200` (proves the server didn't crash).

- [ ] **Step 10: Stop the background server**

Run: kill the background process started in Step 7 (e.g. `kill %1` or stop the backgrounded Bash tool call).
Expected: process exits; no further log lines.

---

### Task 2: Hooks Config + Department Subagents

**Files:**
- Create: `.claude/settings.json`
- Create: `.claude/agents/research-dept.md`
- Create: `.claude/agents/planning-dept.md`
- Create: `.claude/agents/dev-dept.md`

**Interfaces:**
- Consumes: Task 1's running server at `http://localhost:4000/events` (for verification only — no code dependency).
- Produces: hook wiring and 3 subagent definitions that later manual testing (README, Task 5) will invoke by name (`research-dept`, `planning-dept`, `dev-dept`).

- [ ] **Step 1: Create `.claude/settings.json`**

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "http", "url": "http://localhost:4000/events", "timeout": 5 } ] }
    ],
    "SessionEnd": [
      { "hooks": [ { "type": "http", "url": "http://localhost:4000/events", "timeout": 5 } ] }
    ],
    "UserPromptSubmit": [
      { "hooks": [ { "type": "http", "url": "http://localhost:4000/events", "timeout": 5 } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "http", "url": "http://localhost:4000/events", "timeout": 5 } ] }
    ],
    "PreToolUse": [
      { "hooks": [ { "type": "http", "url": "http://localhost:4000/events", "timeout": 5 } ] }
    ],
    "PostToolUse": [
      { "hooks": [ { "type": "http", "url": "http://localhost:4000/events", "timeout": 5 } ] }
    ],
    "PostToolUseFailure": [
      { "hooks": [ { "type": "http", "url": "http://localhost:4000/events", "timeout": 5 } ] }
    ],
    "SubagentStart": [
      { "hooks": [ { "type": "http", "url": "http://localhost:4000/events", "timeout": 5 } ] }
    ],
    "SubagentStop": [
      { "hooks": [ { "type": "http", "url": "http://localhost:4000/events", "timeout": 5 } ] }
    ]
  }
}
```

- [ ] **Step 2: Validate the JSON is well-formed**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')); console.log('valid')"`
Expected: prints `valid`.

- [ ] **Step 3: Create `.claude/agents/research-dept.md`**

```markdown
---
name: research-dept
description: 리서치 담당 서브에이전트. 웹 검색과 자료 조사가 필요한 작업에 사용한다.
---

당신은 리서치 부서 담당자입니다. 주어진 주제에 대해 웹 검색과 자료 조사를 수행하고,
찾은 내용을 근거와 함께 간결하게 정리해서 보고합니다. 확인되지 않은 내용은 추측하지 않고
불확실하다고 명시합니다.
```

- [ ] **Step 4: Create `.claude/agents/planning-dept.md`**

```markdown
---
name: planning-dept
description: 기획 담당 서브에이전트. 문서 작성과 구조 설계가 필요한 작업에 사용한다.
---

당신은 기획 부서 담당자입니다. 요구사항을 정리하고 문서를 작성하며, 작업이나 시스템의
구조를 설계합니다. 결과물은 목차와 섹션이 명확한 구조화된 문서 형태로 제공합니다.
```

- [ ] **Step 5: Create `.claude/agents/dev-dept.md`**

```markdown
---
name: dev-dept
description: 개발 담당 서브에이전트. 코드 작성과 테스트가 필요한 작업에 사용한다.
---

당신은 개발 부서 담당자입니다. 요청받은 기능을 코드로 구현하고, 가능하면 테스트로
동작을 검증합니다. 변경 사항은 최소한으로, 기존 코드 스타일을 따릅니다.
```

- [ ] **Step 6: Start the Task 1 server in the background**

Run: `npm --prefix server run dev > /tmp/agent-office-server.log 2>&1 &`
Expected: log shows both "listening" lines within ~2s (same as Task 1 Step 7).

- [ ] **Step 7: Trigger a real Claude Code session non-interactively and verify hooks fire**

Run (from the project root, `C:\Users\CEO\Desktop\AgentOffice`): `claude -p "안녕, 테스트입니다" --dangerously-skip-permissions`
Expected: command completes with some model output. Then check the server log:
Run: `grep -c "\[event\]" /tmp/agent-office-server.log`
Expected: count is `>= 1`, and the log contains at least one line with `SessionStart` and one with `Stop` (`grep "SessionStart" /tmp/agent-office-server.log` and `grep "Stop" /tmp/agent-office-server.log` each return a match).

- [ ] **Step 8: Stop the background server**

Kill the process started in Step 6.

---

### Task 3: UI State Layer (WebSocket client + event reducer)

**Files:**
- Create: `ui/package.json`
- Create: `ui/tsconfig.json`
- Create: `ui/vite.config.ts`
- Create: `ui/index.html`
- Create: `ui/src/types.ts`
- Create: `ui/src/officeReducer.ts`
- Create: `ui/src/officeReducer.test.ts`
- Create: `ui/src/useEventSocket.ts`
- Create: `ui/src/main.tsx`
- Create: `ui/src/App.tsx`

**Interfaces:**
- Consumes: Task 1's `ws://localhost:4001` (for verification).
- Produces (for Task 4 to consume):
  - `ui/src/types.ts`: `export interface RawEvent { hook_event_name?: string; session_id?: string; agent_id?: string; agent_type?: string; tool_name?: string; tool_input?: unknown; cwd?: string; receivedAt?: number; [key: string]: unknown; }`
  - `ui/src/officeReducer.ts`: `export type CharacterStatus`, `export interface Character { agentId: string; agentType: string; status: CharacterStatus; previousStatus: CharacterStatus; active: boolean; }`, `export interface Room { agentType: string; characters: Record<string, Character>; }`, `export interface LogEntry { id: string; receivedAt: number; hookEventName: string; agentType: string; toolName: string; }`, `export interface OfficeState { rooms: Record<string, Room>; log: LogEntry[]; }`, `export const HQ_ROOM = "본부"`, `export function applyEvent(state: OfficeState, event: RawEvent): OfficeState`, `export function initialOfficeState(): OfficeState`.
  - `ui/src/useEventSocket.ts`: `export function useEventSocket(onEvent: (event: RawEvent) => void): { connected: boolean }`.

- [ ] **Step 1: Create `ui/package.json`**

```json
{
  "name": "agent-office-ui",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `ui/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `ui/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

- [ ] **Step 4: Create `ui/index.html`**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <title>Agent Office</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Install dependencies**

Run: `npm install --prefix ui`
Expected: exits 0, `ui/node_modules` and `ui/package-lock.json` created.

- [ ] **Step 6: Create `ui/src/types.ts`**

```ts
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
```

- [ ] **Step 7: Create `ui/src/officeReducer.ts`**

```ts
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
  Task: "업무 지시 중 📋",
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
  if (name) {
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
    default:
      return next;
  }
}

export function initialOfficeState(): OfficeState {
  return { rooms: {}, log: [] };
}
```

- [ ] **Step 8: Create `ui/src/useEventSocket.ts`**

```ts
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
```

- [ ] **Step 9: Create `ui/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 10: Create `ui/src/App.tsx` (placeholder JSON dump — Task 4 replaces the render)**

```tsx
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
```

- [ ] **Step 11: Type-check the UI**

Run: `npx --prefix ui tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 12: Start server (Task 1) and UI dev server in the background**

Run:
```bash
npm --prefix server run dev > /tmp/agent-office-server.log 2>&1 &
npm --prefix ui run dev > /tmp/agent-office-ui.log 2>&1 &
```
Expected: `/tmp/agent-office-ui.log` shows `Local: http://localhost:5173/` within ~3s.

- [ ] **Step 13: Inject a fake event sequence and verify the state renders correctly**

Run:
```bash
curl -s -X POST http://localhost:4000/events -H "Content-Type: application/json" \
  -d '{"hook_event_name":"SubagentStart","agent_id":"a1","agent_type":"research-dept"}'
curl -s -X POST http://localhost:4000/events -H "Content-Type: application/json" \
  -d '{"hook_event_name":"PreToolUse","agent_id":"a1","agent_type":"research-dept","tool_name":"Read"}'
```
Then open `http://localhost:5173` in a browser.
Expected: the `<pre>` JSON dump shows `rooms["research-dept"].characters["a1"].status` equal to `"자료 찾는 중 🔍"` and `active: true`. `WS connected: true` is shown at the top.

- [ ] **Step 14: Stop the background processes**

Kill both background processes started in Step 12.

- [ ] **Step 15: Create `ui/src/officeReducer.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { applyEvent, initialOfficeState, HQ_ROOM } from "./officeReducer";
import type { RawEvent } from "./types";

describe("applyEvent", () => {
  it("creates a room and character on SubagentStart", () => {
    const event: RawEvent = { hook_event_name: "SubagentStart", agent_id: "a1", agent_type: "research-dept" };
    const state = applyEvent(initialOfficeState(), event);
    const character = state.rooms["research-dept"].characters["a1"];
    expect(character.status).toBe("출근");
    expect(character.active).toBe(true);
  });

  it("maps PreToolUse tool_name to the correct status", () => {
    let state = applyEvent(initialOfficeState(), {
      hook_event_name: "SubagentStart",
      agent_id: "a1",
      agent_type: "research-dept",
    });
    state = applyEvent(state, {
      hook_event_name: "PreToolUse",
      agent_id: "a1",
      agent_type: "research-dept",
      tool_name: "Read",
    });
    expect(state.rooms["research-dept"].characters["a1"].status).toBe("자료 찾는 중 🔍");
  });

  it("falls back to '작업 중' for an unmapped tool_name", () => {
    const state = applyEvent(initialOfficeState(), {
      hook_event_name: "PreToolUse",
      agent_id: "a1",
      agent_type: "research-dept",
      tool_name: "SomeOtherTool",
    });
    expect(state.rooms["research-dept"].characters["a1"].status).toBe("작업 중");
  });

  it("routes events without agent_type to the HQ room", () => {
    const state = applyEvent(initialOfficeState(), { hook_event_name: "UserPromptSubmit" });
    expect(state.rooms[HQ_ROOM].characters[HQ_ROOM].status).toBe("지시 접수 📨");
  });

  it("marks the character inactive on SubagentStop", () => {
    let state = applyEvent(initialOfficeState(), {
      hook_event_name: "SubagentStart",
      agent_id: "a1",
      agent_type: "dev-dept",
    });
    state = applyEvent(state, { hook_event_name: "SubagentStop", agent_id: "a1", agent_type: "dev-dept" });
    const character = state.rooms["dev-dept"].characters["a1"];
    expect(character.status).toBe("퇴근");
    expect(character.active).toBe(false);
  });

  it("ignores an unknown hook_event_name for state but still logs it", () => {
    const state = applyEvent(initialOfficeState(), { hook_event_name: "SomeFutureEvent", agent_type: "dev-dept" });
    expect(state.rooms["dev-dept"]).toBeUndefined();
    expect(state.log).toHaveLength(1);
    expect(state.log[0].hookEventName).toBe("SomeFutureEvent");
  });

  it("does not throw when agent_id, agent_type, and hook_event_name are all missing", () => {
    expect(() => applyEvent(initialOfficeState(), {})).not.toThrow();
  });
});
```

- [ ] **Step 16: Run the reducer test suite**

Run: `npm --prefix ui run test`
Expected: all 7 tests pass, exit code 0.

---

### Task 4: Office Visuals (rooms, pixel characters, event log panel)

**Files:**
- Modify: `ui/src/officeReducer.ts` (add internal revert-status support)
- Modify: `ui/src/officeReducer.test.ts` (cover the new revert behavior)
- Create: `ui/src/App.css`
- Create: `ui/src/components/Character.tsx`
- Create: `ui/src/components/Room.tsx`
- Create: `ui/src/components/EventLog.tsx`
- Modify: `ui/src/App.tsx` (replace JSON dump with the real office view)

**Interfaces:**
- Consumes from Task 3: `applyEvent`, `initialOfficeState`, `HQ_ROOM`, types `OfficeState`/`Room`/`Character`/`CharacterStatus`/`LogEntry` from `ui/src/officeReducer.ts`; `useEventSocket` from `ui/src/useEventSocket.ts`; `RawEvent` from `ui/src/types.ts`.
- Produces: `ui/src/officeReducer.ts` gains `export function revertStatusEvent(agentType: string, agentId: string): RawEvent`, used by `App.tsx`'s auto-revert timer.

- [ ] **Step 1: Modify `ui/src/officeReducer.ts` — skip logging internal events, add revert support**

Replace the log-building block at the top of `applyEvent` (currently `if (name) { ... }`) with:

```ts
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
```

Add a new case inside the `switch (name)` block, alongside the existing cases:

```ts
    case "__revertStatus":
      return updateCharacter(next, agentType, agentId, (c) =>
        c.status === "완료 ✅" ? { ...c, status: c.previousStatus } : c
      );
```

Add this exported helper at the end of the file:

```ts
export function revertStatusEvent(agentType: string, agentId: string): RawEvent {
  return { hook_event_name: "__revertStatus", agent_type: agentType, agent_id: agentId };
}
```

- [ ] **Step 2: Create `ui/src/components/Character.tsx`**

```tsx
import type { Character as CharacterModel } from "../officeReducer";

const PALETTES: Record<string, { body: string; hair: string; skin: string; pants: string }> = {
  "본부": { body: "#b08d57", hair: "#3a2a20", skin: "#e8b98a", pants: "#4a3a28" },
  "research-dept": { body: "#3d7ea6", hair: "#3a2a20", skin: "#e8b98a", pants: "#26333d" },
  "planning-dept": { body: "#8a5cc2", hair: "#241a2e", skin: "#f0c9a0", pants: "#2e2438" },
  "dev-dept": { body: "#3fae6a", hair: "#1c1c1c", skin: "#e0ab7c", pants: "#22331f" },
};

const DEFAULT_PALETTE = { body: "#8a8a8a", hair: "#2b2b2b", skin: "#d8b48a", pants: "#3a3a3a" };

function paletteFor(agentType: string) {
  return PALETTES[agentType] ?? DEFAULT_PALETTE;
}

export function CharacterView({ character }: { character: CharacterModel }) {
  const palette = paletteFor(character.agentType);
  return (
    <div className={`character ${character.active ? "active" : "inactive"}`}>
      <div className="sprite idle-bob">
        <div className="px hair" style={{ background: palette.hair }} />
        <div className="px head" style={{ background: palette.skin }} />
        <div className="px eye l" />
        <div className="px eye r" />
        <div className="px body" style={{ background: palette.body }} />
        <div className="px arm l" style={{ background: palette.body }} />
        <div className="px arm r" style={{ background: palette.body }} />
        <div className="px legs" style={{ background: palette.pants }} />
        <div className="px foot l" />
        <div className="px foot r" />
      </div>
      <div className="character-status">{character.status}</div>
    </div>
  );
}
```

- [ ] **Step 3: Create `ui/src/components/Room.tsx`**

```tsx
import type { Room as RoomModel } from "../officeReducer";
import { CharacterView } from "./Character";

const ROOM_ICONS: Record<string, string> = {
  "본부": "🏢",
  "research-dept": "🔬",
  "planning-dept": "📐",
  "dev-dept": "💻",
};

export function RoomView({ room }: { room: RoomModel }) {
  const icon = ROOM_ICONS[room.agentType] ?? "🏠";
  const characters = Object.values(room.characters);
  return (
    <div className="room-card">
      <div className="room-title">{icon} {room.agentType.toUpperCase()}</div>
      <div className="room-floor">
        {characters.length === 0 ? (
          <div className="room-empty">비어 있음</div>
        ) : (
          characters.map((c) => <CharacterView key={c.agentId} character={c} />)
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `ui/src/components/EventLog.tsx`**

```tsx
import type { LogEntry } from "../officeReducer";

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
            <span className="log-agent">{e.agentType}</span>
            <span className="log-tool">{e.toolName || "-"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `ui/src/App.css`**

```css
:root { color-scheme: dark; }

body {
  margin: 0;
  background: #0e0e12;
  color: #eee;
  font-family: "Segoe UI", sans-serif;
}

.office { padding: 24px; max-width: 1100px; margin: 0 auto; }

.office-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.office-header h1 { font-size: 20px; margin: 0; }
.ws-status { font-size: 12px; padding: 4px 10px; border-radius: 999px; }
.ws-status.on { background: #1f4d2f; color: #8fe3a6; }
.ws-status.off { background: #4d1f1f; color: #e38f8f; }

.room-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.empty-hint { color: #8891a8; grid-column: 1 / -1; }

.room-card {
  background: #2b2420;
  border: 2px solid #6b4f3a;
  border-radius: 10px;
  padding: 16px;
}
.room-title { font-weight: 700; margin-bottom: 10px; font-size: 13px; color: #f2d9b3; }
.room-floor {
  min-height: 100px;
  background: #3a2f28;
  border-radius: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  padding: 10px;
}
.room-empty { color: #7a6a5a; font-size: 12px; }

.character { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 64px; }
.character.inactive { opacity: 0.35; filter: grayscale(1); }
.character-status { font-size: 10px; color: #f2d9b3; text-align: center; }

.sprite { width: 48px; height: 60px; position: relative; }
.px { position: absolute; }
.sprite .head { width: 20px; height: 18px; left: 14px; top: 0; }
.sprite .hair { width: 24px; height: 8px; left: 12px; top: -3px; }
.sprite .eye { width: 3px; height: 3px; background: #1a1a1a; top: 9px; }
.sprite .eye.l { left: 18px; }
.sprite .eye.r { left: 27px; }
.sprite .body { width: 26px; height: 18px; left: 11px; top: 18px; }
.sprite .arm { width: 6px; height: 15px; top: 19px; }
.sprite .arm.l { left: 5px; }
.sprite .arm.r { left: 37px; }
.sprite .legs { width: 26px; height: 13px; left: 11px; top: 36px; }
.sprite .foot { width: 10px; height: 6px; top: 49px; background: #2b2b2b; }
.sprite .foot.l { left: 11px; }
.sprite .foot.r { left: 27px; }

.idle-bob { animation: bob 1.4s ease-in-out infinite; }
@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

.event-log {
  margin-top: 24px;
  background: #161822;
  border: 1px solid #2a2f42;
  border-radius: 10px;
  overflow: hidden;
}
.event-log-header { padding: 10px 14px; font-weight: 700; font-size: 12px; color: #7dd3fc; border-bottom: 1px solid #2a2f42; }
.event-log-body { max-height: 220px; overflow-y: auto; }
.event-log-row {
  display: grid;
  grid-template-columns: 90px 140px 140px 1fr;
  gap: 8px;
  padding: 6px 14px;
  font-size: 12px;
  border-bottom: 1px solid #1c2030;
}
.log-time { color: #8891a8; }
.log-name { color: #f2d9b3; }
.log-agent { color: #7dd3fc; }
.log-tool { color: #cbd5e1; }
```

- [ ] **Step 6: Modify `ui/src/App.tsx` to render the real office view**

Replace the full file contents with:

```tsx
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
```

- [ ] **Step 7: Type-check the UI**

Run: `npx --prefix ui tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 8: Start server + UI in the background**

Run:
```bash
npm --prefix server run dev > /tmp/agent-office-server.log 2>&1 &
npm --prefix ui run dev > /tmp/agent-office-ui.log 2>&1 &
```
Expected: same as Task 3 Step 12.

- [ ] **Step 9: Inject a full lifecycle sequence and visually verify in the browser**

Open `http://localhost:5173` first, then run each curl in order, pausing briefly between them to observe the change:

```bash
curl -s -X POST http://localhost:4000/events -H "Content-Type: application/json" \
  -d '{"hook_event_name":"SubagentStart","agent_id":"a1","agent_type":"research-dept"}'
```
Expected: a `🔬 RESEARCH-DEPT` room card appears with one blue-palette pixel character showing status `출근`.

```bash
curl -s -X POST http://localhost:4000/events -H "Content-Type: application/json" \
  -d '{"hook_event_name":"PreToolUse","agent_id":"a1","agent_type":"research-dept","tool_name":"Read"}'
```
Expected: status changes to `자료 찾는 중 🔍`.

```bash
curl -s -X POST http://localhost:4000/events -H "Content-Type: application/json" \
  -d '{"hook_event_name":"PostToolUse","agent_id":"a1","agent_type":"research-dept","tool_name":"Read"}'
```
Expected: status changes to `완료 ✅` immediately, then reverts to `자료 찾는 중 🔍` after ~1.5s.

```bash
curl -s -X POST http://localhost:4000/events -H "Content-Type: application/json" \
  -d '{"hook_event_name":"SubagentStop","agent_id":"a1","agent_type":"research-dept"}'
```
Expected: status changes to `퇴근` and the character turns grayscale/dimmed (the `.inactive` style).

Expected throughout: the event log panel at the bottom lists all four events in order with correct time/event-name/agent/tool columns, and no console errors appear in the browser dev tools.

- [ ] **Step 10: Stop the background processes**

Kill both background processes started in Step 8.

- [ ] **Step 11: Extend `ui/src/officeReducer.test.ts` to cover the revert behavior added in Step 1**

Add these two test cases inside the existing `describe("applyEvent", ...)` block (append after the last `it(...)`):

```ts
  it("reverts '완료 ✅' back to the previous status via the internal revert event", () => {
    let state = applyEvent(initialOfficeState(), {
      hook_event_name: "SubagentStart",
      agent_id: "a1",
      agent_type: "research-dept",
    });
    state = applyEvent(state, {
      hook_event_name: "PreToolUse",
      agent_id: "a1",
      agent_type: "research-dept",
      tool_name: "Read",
    });
    state = applyEvent(state, {
      hook_event_name: "PostToolUse",
      agent_id: "a1",
      agent_type: "research-dept",
      tool_name: "Read",
    });
    expect(state.rooms["research-dept"].characters["a1"].status).toBe("완료 ✅");

    state = applyEvent(state, revertStatusEvent("research-dept", "a1"));
    expect(state.rooms["research-dept"].characters["a1"].status).toBe("자료 찾는 중 🔍");
  });

  it("does not add a log entry for the internal revert event", () => {
    let state = applyEvent(initialOfficeState(), {
      hook_event_name: "SubagentStart",
      agent_id: "a1",
      agent_type: "research-dept",
    });
    const logCountBefore = state.log.length;
    state = applyEvent(state, revertStatusEvent("research-dept", "a1"));
    expect(state.log).toHaveLength(logCountBefore);
  });
```

Add the import at the top of the file, alongside the existing imports:

```ts
import { applyEvent, initialOfficeState, HQ_ROOM, revertStatusEvent } from "./officeReducer";
```

(This replaces the existing import line from Task 3, which did not import `revertStatusEvent`.)

- [ ] **Step 12: Run the full test suite and type-check again**

Run: `npm --prefix ui run test`
Expected: all 9 tests pass, exit code 0.

Run: `npx --prefix ui tsc --noEmit`
Expected: no output, exit code 0.

---

### Task 5: README.md

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: final script names from Task 1 (`server` dev script), Task 3 (`ui` dev script), Task 6 (root `npm run dev`), and the agent names from Task 2.
- Produces: nothing consumed by other tasks — this is documentation only.

- [ ] **Step 1: Create `README.md`**

```markdown
# Agent Office

Claude Code에서 실행되는 AI 에이전트(메인 스레드 + 서브에이전트)들의 작업 상태를
미니어처 사무실 화면으로 실시간 시각화하는 개인용 로컬 도구입니다. 전부 localhost에서
동작하며 외부 배포는 없습니다.

## 실행 방법

1. 의존성 설치 (최초 1회):
   ```bash
   npm install --prefix server
   npm install --prefix ui
   ```
2. 서버 + UI 동시 실행:
   ```bash
   npm run dev
   ```
   또는 각각 따로:
   ```bash
   npm --prefix server run dev   # http://localhost:4000, ws://localhost:4001
   npm --prefix ui run dev       # http://localhost:5173
   ```
3. 브라우저에서 `http://localhost:5173` 접속.
4. 새 터미널을 열고 이 프로젝트 루트에서 `claude`를 실행해 평소처럼 작업하면,
   실시간으로 사무실 화면에 상태가 반영됩니다.

## 테스트 방법

`claude` 세션에서 아래처럼 부서 서브에이전트를 명시적으로 호출해보세요:

- `"research-dept 에이전트로 최신 프론트엔드 프레임워크 동향을 조사해줘"`
- `"planning-dept 에이전트로 이 기능의 요구사항 문서를 작성해줘"`
- `"dev-dept 에이전트로 간단한 유틸 함수를 구현하고 테스트해줘"`

해당 부서 방에 캐릭터가 나타나 상태가 바뀌는지 확인하세요.

## 포트

| 용도 | 포트 |
|---|---|
| 이벤트 수집 (HTTP, 훅이 전송) | 4000 |
| 이벤트 브로드캐스트 (WebSocket) | 4001 |
| UI 개발 서버 (Vite) | 5173 |

## 문제 해결

- **화면에 아무것도 안 뜬다**: 서버(4000/4001)가 떠 있는지 확인하세요. UI 상단의
  "연결됨/연결 끊김" 배지가 "연결 끊김"이면 서버를 먼저 켜세요.
- **훅 이벤트가 안 찍힌다**: `.claude/settings.json`이 프로젝트 루트에 있는지,
  그리고 `claude`를 이 프로젝트 루트에서 실행했는지 확인하세요. 서버 콘솔에
  `[event] ...` 로그가 찍히는지로 훅 도달 여부를 확인할 수 있습니다.
- **포트 충돌**: 4000/4001/5173 중 이미 사용 중인 포트가 있으면 해당 프로세스를
  종료하거나, `server/src/index.ts`의 `HTTP_PORT`/`WS_PORT`, `ui/vite.config.ts`의
  `server.port`를 변경하세요 (변경 시 훅 URL과 WS_URL도 함께 맞춰야 합니다).
- **새로고침하면 상태가 사라진다**: 서버가 최근 200개 이벤트만 메모리에 보관하므로,
  서버 자체를 재시작하면 히스토리가 사라집니다 (정상 동작). UI만 새로고침하는 경우는
  서버가 히스토리를 다시 보내주므로 복원됩니다.
```

- [ ] **Step 2: Verify the file renders correctly**

Run: `node -e "console.log(require('fs').readFileSync('README.md','utf8').length)"`
Expected: prints a number greater than `0`.

---

### Task 6: Root package.json (`npm run dev` via concurrently)

**Files:**
- Create: `package.json` (project root)

**Interfaces:**
- Consumes: `server/package.json`'s `dev` script (Task 1) and `ui/package.json`'s `dev` script (Task 3).
- Produces: root-level `npm run dev` — the entry point described in the README (Task 5).

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "agent-office",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "dev": "concurrently -n server,ui -c blue,green \"npm --prefix server run dev\" \"npm --prefix ui run dev\""
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 2: Install root dependencies**

Run: `npm install`
Expected: exits 0, root `node_modules` and `package-lock.json` created.

- [ ] **Step 3: Run `npm run dev` and verify both processes start**

Run: `npm run dev > /tmp/agent-office-dev.log 2>&1 &` (background)
Wait ~3s, then run: `cat /tmp/agent-office-dev.log`
Expected: log contains lines prefixed `server` showing `Event server listening on http://localhost:4000` and `WebSocket server listening on ws://localhost:4001`, and lines prefixed `ui` showing Vite's `Local: http://localhost:5173/`.

- [ ] **Step 4: Stop the background process**

Kill the process started in Step 3 (this should terminate both the server and UI child processes since `concurrently` propagates termination).

---

## Post-plan check (manual, not a task)

After all 6 tasks are done, run `npm run dev` once from the project root, open `http://localhost:5173`, then in a **separate terminal** run `claude` from the project root and give it a prompt like the ones in the README's "테스트 방법" section. Confirm the office UI reflects the live session end-to-end.
