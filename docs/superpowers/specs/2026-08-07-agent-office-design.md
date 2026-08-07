# 에이전트 오피스 (Agent Office) — 설계 문서

날짜: 2026-08-07

## 목적

Claude Code에서 실행되는 AI 에이전트(메인 스레드 + 서브에이전트)들의 작업 상태를
미니어처 사무실 화면으로 실시간 시각화하는 개인용 로컬 도구. 외부 배포 없음, 전부
localhost에서 동작.

## 전체 아키텍처

```
Claude Code Hooks (HTTP)
      │  POST JSON
      ▼
Event Server (Express, :4000)  ── 즉시 200 응답, 이후 비동기로 처리
      │  receivedAt 타임스탬프 추가
      ▼
In-memory ring buffer (최근 200개)
      │
      ▼
WebSocket Server (ws, :4001) ── 브로드캐스트 + 신규 접속자에게 히스토리 전송
      │
      ▼
React UI (Vite + TS) ── 상태 반영, 사무실 화면 렌더링
```

## 기술 스택 및 프로젝트 구조

- `server/`: TypeScript + Express + `ws`. 빌드 단계 없이 `tsx`로 직접 실행.
- `ui/`: Vite + React + TypeScript.
- `.claude/settings.json`: 훅 설정 (HTTP 훅 → `http://localhost:4000/events`).
- `.claude/agents/`: 테스트용 부서 서브에이전트 3개 (`research-dept.md`,
  `planning-dept.md`, `dev-dept.md`).
- 루트 `package.json`: `concurrently`로 서버+UI를 동시 기동하는 `npm run dev`.
- git 저장소는 생성하지 않음 (사용자 선택 — 파일만 관리, 버전 이력 없음).

## 이벤트 서버 (server/)

### POST /events (:4000)

- Claude Code 훅이 보내는 이벤트 JSON을 그대로 받는다.
- **반드시 즉시 200을 반환**한다. 브로드캐스트/로깅 등 처리는 응답을 보낸 *이후*에
  수행한다. 응답이 늦으면 훅을 건 Claude Code 에이전트가 블로킹되므로, 응답 전에는
  무거운 작업을 절대 하지 않는다.
- 받은 JSON에 `receivedAt` (서버 수신 시각, ms epoch) 필드만 추가하고 그 외 필드는
  가공 없이 그대로 보관/브로드캐스트한다.
- 요청 바디가 비어있거나 JSON 파싱에 실패해도 서버가 죽지 않고 400을 반환한다
  (그래도 항상 응답은 즉시 나가야 한다).

### WebSocket 서버 (:4001)

- 이벤트 수신 시 연결된 모든 클라이언트에 `receivedAt`이 붙은 이벤트를 그대로
  브로드캐스트한다.
- 최근 이벤트 200개를 메모리 ring buffer로 보관한다 (그 이상은 오래된 것부터 폐기,
  디스크 영속화 없음).
- 새 클라이언트가 접속하면 먼저 보관 중인 히스토리(최대 200개)를 순서대로 전송해서,
  UI를 새로고침해도 현재 사무실 상태가 복원되게 한다.

### 검증 방법 (1단계)

`curl -X POST localhost:4000/events -H "Content-Type: application/json" -d '{...}'`
로 200 응답과 서버 콘솔 로그(수신한 이벤트 요약)를 확인한다.

## 훅 설정 (.claude/settings.json)

다음 이벤트에 대해 `type: "http"` 훅을 등록, 모두 `http://localhost:4000/events`로
전송, `timeout: 5`, `matcher` 생략(전체 매칭):

- SessionStart, SessionEnd
- UserPromptSubmit, Stop
- PreToolUse, PostToolUse, PostToolUseFailure
- SubagentStart, SubagentStop

## 부서 서브에이전트 (.claude/agents/)

테스트용 3개, 각각 `name` + `description` 프론트매터와 간단한 시스템 프롬프트:

- `research-dept`: 리서치 담당 (웹 검색, 자료 조사)
- `planning-dept`: 기획 담당 (문서 작성, 구조 설계)
- `dev-dept`: 개발 담당 (코드 작성, 테스트)

### 검증 방법 (2단계)

훅이 등록된 상태에서 실제 Claude Code 세션을 시작해 SessionStart 이벤트가
서버 콘솔에 찍히는지 확인.

## React UI (ui/)

### 데이터 흐름

- `ws://localhost:4001` 구독. 연결이 끊기면 자동 재연결을 시도한다.
- 접속 시 서버가 보내주는 히스토리를 받아 상태를 초기화한 뒤, 이후 실시간 이벤트를
  이어서 반영한다.
- 이벤트 파싱은 방어적으로 처리한다: 모르는 `hook_event_name`이나 누락된 필드가
  와도 무시하거나 기본값으로 처리하고, UI가 죽지 않는다 (optional chaining +
  기본값, 알 수 없는 이벤트는 로그 패널에만 표시하고 상태 매핑은 skip).

### 캐릭터 ↔ 방 식별 규칙

- **캐릭터 인스턴스 식별**: `agent_id` 기준. 같은 `agent_type`의 서브에이전트가
  동시에 여러 개 떠도 각각 별도 캐릭터로 렌더링한다.
- **방 배치**: `agent_type` 기준으로 그룹핑. `agent_type`이 없는 이벤트(메인
  스레드)는 "본부" 방으로 귀속한다.
- 방은 이벤트에 등장하는 `agent_type`으로 동적 생성된다 (사전 정의된 부서 목록을
  하드코딩하지 않음). 즉 세션 시작 직후에는 "본부"만 보이고, 서브에이전트가 뜨면
  그 부서 방이 새로 생긴다.

### 화면 구성

- **사무실 평면도**: 부서별 방(room)이 격자로 배치된 그리드 레이아웃.
- **방 카드 스타일**: 따뜻한 나무톤 — 어두운 우드 배경(`#2b2420` 계열) + 밝은
  텍스트, 방 제목에 부서 이모지.
- **캐릭터**: CSS로 구성한 픽셀풍 스프라이트(머리/몸통/팔다리 블록). 부서별
  팔레트 — 리서치=블루, 기획=퍼플, 개발=그린, 본부=웜 그레이/앰버. 작업 중에는
  `idle-bob` 류의 은은한 애니메이션(흔들림)으로 살아있는 느낌을 준다.
- **상태 라벨**: 캐릭터 아래 현재 상태를 이모지 포함 텍스트로 표시.
- **하단 이벤트 로그 패널**: 실시간 이벤트를 시간순으로 표시 (시간, 이벤트명,
  에이전트, 툴 이름).

### 이벤트 → 상태 매핑

| 이벤트 | UI 반응 |
|---|---|
| `SubagentStart` | 해당 부서에 캐릭터 등장 + "출근" 상태 |
| `PreToolUse` (Read/Glob/Grep) | "자료 찾는 중 🔍" |
| `PreToolUse` (Write/Edit) | "작성 중 ✍️" |
| `PreToolUse` (Bash) | "명령 실행 중 ⚙️" |
| `PreToolUse` (WebSearch/WebFetch) | "검색 중 🌐" |
| `PreToolUse` (Task) | "업무 지시 중 📋" |
| `PreToolUse` (그 외 tool_name) | "작업 중" |
| `PostToolUse` | 약 1.5초간 "완료 ✅" 표시 후 직전 대기 상태로 복귀 |
| `PostToolUseFailure` | "문제 발생 ⚠️" |
| `SubagentStop` | "퇴근" 표시 후 캐릭터 비활성화(회색 처리) |
| `UserPromptSubmit` | 본부 캐릭터에 "지시 접수 📨" |
| `Stop` | 전체 "업무 종료" |

캐릭터가 아직 등장하지 않은 상태(`SubagentStart` 이전)에서 해당 `agent_id`로
`PreToolUse` 등이 먼저 도착하는 방어적 상황도 무시하지 않고 그 시점에 캐릭터를
생성해 처리한다 (이벤트 도착 순서를 신뢰하지 않음).

### 검증 방법 (3단계)

서버가 떠 있는 상태에서 curl로 `SubagentStart`, `PreToolUse`(Read),
`PostToolUse`, `SubagentStop` 등 가짜 이벤트를 순서대로 주입하고, 브라우저 화면에서
해당 부서 방에 캐릭터가 나타나고/상태가 바뀌고/퇴근 처리되는지 확인한다.

## README.md (4단계)

포함 내용:
- 실행 방법: 서버 실행 → UI 실행 → 새 터미널에서 `claude` 실행 (또는 `npm run dev`
  한 번에 실행하는 방법)
- 테스트 방법: 예시 프롬프트 (`"research-dept 에이전트로 ○○ 조사해줘"`)
- 포트 정보: 4000(HTTP 이벤트 수집), 4001(WebSocket), UI 개발 서버 포트(Vite 기본)
- 문제 해결 팁: 훅이 안 찍힐 때, WS 연결 안 될 때, 포트 충돌 시 확인 사항

## 루트 package.json (5단계)

`concurrently`를 사용해 `npm run dev` 한 번으로 서버(:4000/:4001)와 UI 개발
서버를 동시에 기동.

## 테스트 전략

- 자동화된 유닛 테스트는 이 프로젝트 규모에서 과함 — 각 단계별로 curl 기반 수동
  검증(위 명시된 방법)으로 충분하다.
- 서버: curl로 단일 이벤트 POST → 200 + 콘솔 로그 확인.
- UI: curl로 이벤트 시퀀스 주입 → 브라우저에서 시각적 반응 확인 (SubagentStart→
  PreToolUse→PostToolUse→SubagentStop 흐름).
- 통합: 실제 Claude Code 세션에서 서브에이전트 호출 → 전체 파이프라인 동작 확인.

## 범위 밖 (Out of scope)

- 외부 배포, 인증, HTTPS
- 이벤트 디스크 영속화 (재시작 시 히스토리 소실은 허용)
- 다중 세션/다중 사용자 지원
- 모바일 반응형 레이아웃
