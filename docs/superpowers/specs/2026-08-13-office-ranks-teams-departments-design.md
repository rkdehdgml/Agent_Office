# 직급/팀 표시 + 오프라인 숨김 + 부서 확장 — 설계 문서

날짜: 2026-08-13

## 배경 및 목적

[[2026-08-12-isometric-office-camera-design]]로 카메라/벽/방문 애니메이션/그림자
작업을 마친 뒤, 사용자가 오피스 화면을 직접 확인하고 다음 세 가지를 요청했다.

1. 작업이 끝난(퇴근) 에이전트를 반투명으로 남겨두는 지금 방식이 UI적으로 지저분해
   보인다 — 아예 안 보이게 해달라.
2. 캐릭터 라벨이 `planning-dept/abc123`처럼 부서 슬러그를 그대로 노출한다 — 기획팀/
   개발팀/리서치팀처럼 한글 팀명으로 보이게 해달라.
3. 팀마다 사원/대리/과장/팀장, 본부는 부장이라는 직급 체계를 붙여달라. 부장=본부,
   팀장=그 팀의 대표. 나머지 직급은 업무 처리 능력(완료한 작업 수)에 따라 매긴다.

브레인스토밍 중 두 가지가 추가로 확장됐다:
- 기존 부서(리서치/기획/개발)에 **디자인 및 퍼블리싱팀**을 새로 추가하고 싶다는 요청
  — 이 팀은 시각적 매핑만이 아니라 실제로 호출 가능한 서브에이전트여야 한다.
- 부서가 4개(+본부)로 늘면서 기존 2×2 방 레이아웃이 깨지므로, 3열×2행 레이아웃으로
  개편하고 남는 한 칸은 **휴게실**로 써서 유휴 에이전트가 가끔 들렀다 오게 한다.

## 범위

포함:
- `Character`에 `completedCount` 추가, 완료 개수 기준 직급(사원/대리/과장) 산정
- 부서 슬러그 → 한글 팀명 매핑, 라벨을 `"{팀명} · {직급}"` 형태로 표시
- 팀마다 항상 존재하는 고정 대표 캐릭터(팀장/본부는 부장) — 이벤트와 무관하게 항상
  표시, 랭크 산정 대상 아님
- 새 부서 "디자인 및 퍼블리싱팀"을 실제 서브에이전트(`design-publishing-dept`)로 추가
- 오피스 레이아웃을 3열×2행(6칸)으로 개편: 리서치/기획/디자인퍼블리싱(윗줄),
  개발/본부/휴게실(아랫줄)
- 휴게실: 유휴(`active && status === "출근"`) 에이전트 중 무작위 소수(최대 2명)가
  주기적으로 방문했다가 일정 시간 후 복귀
- 오프라인(퇴근) 상태가 된 일반 캐릭터는 즉시 사라지지 않고 짧게 페이드아웃된 뒤
  화면에서 사라짐 (고정 대표 캐릭터는 대상 아님)

범위 밖:
- pixel-agents 저장소의 실제 캐릭터/배경 PNG 애셋 연동 — 별도 요청으로 조사만 했고
  적용은 이번 스펙과 무관한 후속 작업으로 분리 (사용자 확인, 2026-08-13 대화)
- 직급 체계에 대한 영구 저장/세션 간 유지 — `completedCount`는 세션 단위로만 의미가
  있으며, 새 `SubagentStart`마다 0으로 리셋된다 (신입 취급)
- 휴게실 체류 중 다른 캐릭터와의 상호작용(인사 애니메이션 등) — 단순 이동/대기/복귀만
- 벽 충돌/경로탐색, 카메라 사용자 조작, 실시간 조명 그림자 — 기존 스펙에서 이미
  범위 밖으로 정한 것을 유지

## A. 데이터 모델 — 완료 개수 → 직급

`officeReducer.ts`의 `Character`에 `completedCount: number` 추가.
- `SubagentStart`: `completedCount: 0`으로 리셋
- `PostToolUse`: `completedCount + 1`

신규 순수 함수 모듈 `ui/src/scene/rank.ts`:
```ts
export type Rank = "사원" | "대리" | "과장";
export function rankFor(completedCount: number): Rank {
  if (completedCount >= 6) return "과장";
  if (completedCount >= 3) return "대리";
  return "사원";
}
```
팀장/부장은 이 함수와 무관하게 고정 캐릭터로 별도 처리한다 (섹션 E).

## B. 팀 표시명 매핑

신규 순수 함수 모듈 `ui/src/scene/teamLabels.ts`:
```ts
const TEAM_NAMES: Record<string, string> = {
  "research-dept": "리서치팀",
  "planning-dept": "기획팀",
  "dev-dept": "개발팀",
  "design-publishing-dept": "디자인퍼블리싱팀",
};

export function teamNameFor(agentType: string): string {
  if (agentType === HQ_ROOM) return "본부";
  return TEAM_NAMES[agentType] ?? agentType;
}
```
알 수 없는 슬러그는 원래 값을 그대로 반환해 매핑 누락을 눈에 띄게 한다.

## C. 휴게실(빈 칸) — 유휴 에이전트 랜덤 방문

**유휴 판정**: `active: true && status === "출근"`. 도구를 아직 하나도 쓰지 않은
상태가 이 이벤트 기반 시스템에서 "일을 안 하는 중"을 나타내는 유일한 신호다.

**선정 로직**: 약 15초 주기로 유휴 후보 중 무작위 최대 2명을 선택해 휴게실로
보낸다. 이미 휴게실에 있는 인원은 다시 뽑지 않고, 후보가 없으면 아무 일도 하지
않는다.

**이동**: 기존 `useWalkerCommands.ts` / `CharacterActor.tsx`의
"walking-to-visit → greeting → walking-back" 상태 머신을 재사용하되, 목적지를
상대방 책상이 아니라 휴게실 빈 슬롯 좌표로 지정한다(`greeting` 단계는 건너뛰고
"머무름" 단계로 대체 — 인사 상대가 없으므로). 도착 후 1~3분 사이 무작위 시간
머문 뒤 자동으로 원래 책상으로 복귀한다.

**표시**: 휴게실 칸은 벽 없이 개방하고, 기존 `Props.tsx`의 `WaterCooler`/`Plant`를
배치한다.

## D. 새 부서 서브에이전트 + 5방 레이아웃 개편 (3열×2행)

신규 `.claude/agents/design-publishing-dept.md` (기존 3개와 동일한 포맷):
```
---
name: design-publishing-dept
description: 디자인 및 퍼블리싱 담당 서브에이전트. UI/화면 디자인과 퍼블리싱(마크업/스타일) 작업에 사용한다.
---

당신은 디자인 및 퍼블리싱 부서 담당자입니다. 화면/컴포넌트의 시각 디자인을 제안하고,
필요하면 HTML/CSS 마크업(퍼블리싱)까지 구현합니다. 기존 디자인 톤과 일관성을 유지합니다.
```

`teamLabels.ts`, `CharacterActor.tsx`의 `PALETTE`, `Desk.tsx`의
`DEPARTMENT_COLOR`에 `"design-publishing-dept"` 항목과 고유 색상 1세트씩 추가한다.

**레이아웃**: 기존 2×2(4칸)를 3열×2행(6칸)으로 확장.
- 윗줄: 리서치팀 / 기획팀 / 디자인퍼블리싱팀
- 아랫줄: 개발팀 / 본부 / 휴게실(빈 칸, 벽 없음)
- 기존 "중앙 4×4 개방 구역"을 **가로 폭 전체를 가로지르는 개방 통로 밴드**로
  일반화한다 — 각 방은 이 통로 쪽으로만 열려 있고 나머지 3면은 벽으로 막는다.
  휴게실 칸은 사면 모두 개방.
- `DESK_SLOTS`에 `"design-publishing-dept"` 항목(3슬롯 + 팀장용 1슬롯) 추가,
  나머지 4개 방 좌표는 새 그리드에 맞춰 재계산한다.
- 정확한 벽(`Walls.tsx`)/책상 좌표는 구현 계획(plan) 단계에서 확정한다. 바닥이
  넓어지는 만큼 `OfficeScene.tsx`의 `CAMERA_RADIUS`/`zoom`도 재조정이 필요하다
  (틸트 50°/방위각 45° 자체는 [[2026-08-12-isometric-office-camera-design]]에서
  검증된 값을 유지).

## E. 팀장/부장 고정 대표 캐릭터

실제 이벤트로 생성되지 않고, 방마다 **항상 존재하는 고정 캐릭터 목록**을
코드에 정의한다.

```ts
// ui/src/scene/fixedCharacters.ts
export interface FixedCharacter { agentType: string; label: string; }
export const FIXED_CHARACTERS: FixedCharacter[] = [
  { agentType: "research-dept", label: "팀장" },
  { agentType: "planning-dept", label: "팀장" },
  { agentType: "dev-dept", label: "팀장" },
  { agentType: "design-publishing-dept", label: "팀장" },
  { agentType: HQ_ROOM, label: "부장" },
];
```
- 각 방의 4번째 책상 슬롯을 팀장/부장 전용으로 예약한다. 실제 이벤트로 생기는
  캐릭터는 0~2번 슬롯(사원/대리/과장)만 순환 사용한다.
- `OfficeScene.tsx`에서 `FIXED_CHARACTERS`를 `state.rooms`와 무관하게 항상
  렌더링한다 — hook 이벤트, `completedCount`, `active` 상태와 완전히 분리된 별도
  경로이며, 섹션 G(오프라인 숨김/페이드아웃)의 대상이 아니다.

## F. 라벨 조합

`CharacterActor.tsx`가 `StatusLabel`에 넘기는 `name`을
`"{팀명} · {직급}"` 형태로 구성한다.
- 고정 캐릭터: `"개발팀 · 팀장"`, `"본부 · 부장"`
- 일반 캐릭터: `teamNameFor(agentType)` + `rankFor(completedCount)` →
  `"개발팀 · 대리"`

## G. 오프라인(퇴근) 일반 캐릭터 — 페이드아웃 후 사라짐

일반 캐릭터(고정 대표 캐릭터 제외)만 대상.

`CharacterActor.tsx`에서 `character.active`가 `true → false`로 바뀌는 순간
("퇴근") 페이드 타이머를 시작한다.
- 기존 `useFrame` 루프(위치/걷기 애니메이션을 갱신하는 곳)에 스프라이트
  `opacity`를 1.0 → 0으로 약 1.5초에 걸쳐 선형 감소시키는 로직을 추가한다.
- 페이드 중에는 정지 시점의 색상 그대로 흐려진다 — 즉시 회색+반투명으로 바뀌는
  기존 `INACTIVE_PALETTE`/`opacity: 0.5` 로직은 제거한다.
- opacity가 0에 도달하면 `groupRef.current.visible = false`로 완전히 숨긴다
  (컴포넌트는 마운트 상태 유지, `officeReducer` 상태에서 캐릭터를 제거하지는
  않는다).
- 상태 라벨(`StatusLabel`)은 기존처럼 `active`가 꺼지는 즉시 사라진다 (변경 없음).

## 변경/신규 파일 요약

수정:
- `ui/src/officeReducer.ts` — `completedCount` 필드/증감 로직 추가
- `ui/src/scene/CharacterActor.tsx` — 라벨 조합, 페이드아웃, 팔레트/직급 표시 로직
- `ui/src/scene/Desk.tsx` — `DEPARTMENT_COLOR`에 신규 부서 추가
- `ui/src/scene/deskLayout.ts` — `DESK_SLOTS`에 신규 부서 + 팀장 슬롯 추가, 5방
  좌표 재계산
- `ui/src/scene/Walls.tsx` — 3열×2행 + 통로 밴드 구조로 재작성
- `ui/src/scene/OfficeScene.tsx` — `DEPARTMENTS` 목록에 신규 부서 추가,
  `FIXED_CHARACTERS` 렌더링, 카메라 반경/줌 재조정, 휴게실 방문 스케줄러 연결
- `ui/src/scene/useWalkerCommands.ts` — 휴게실 방문 커맨드 생성 로직 추가

신규:
- `.claude/agents/design-publishing-dept.md` — 새 서브에이전트 정의
- `ui/src/scene/rank.ts` — 완료 개수 → 직급 순수 함수 + 유닛 테스트
- `ui/src/scene/teamLabels.ts` — 부서 슬러그 → 한글 팀명 순수 함수 + 유닛 테스트
- `ui/src/scene/fixedCharacters.ts` — 고정 팀장/부장 캐릭터 목록

## 테스트 전략

- `rank.ts`의 `rankFor`에 vitest 유닛 테스트: 경계값 0, 2, 3, 5, 6에서 기대한
  직급을 반환하는지 검증
- `teamLabels.ts`의 `teamNameFor`에 vitest 유닛 테스트: 4개 부서 + 본부 + 미지
  슬러그 폴백 케이스
- `deskLayout.test.ts`에 5방 + 팀장 슬롯 추가에 따른 구조적 회귀 테스트 (기존
  테스트는 상대적 관계만 검증하므로 슬롯 수 확장에 안전 — 신규 부서/슬롯에 대한
  케이스만 추가)
- 기존 vitest 스위트 전체 통과 확인 (`npm --prefix ui run test`)
- 수동 확인 (`npm run dev`):
  1. 5개 팀 + 본부 + 휴게실 6칸이 3열×2행으로 벽 구분되어 보이는지
  2. 각 방에 팀장/부장 고정 캐릭터가 항상 보이는지, 실제 서브에이전트 이벤트
     없이도 사라지지 않는지
  3. 실제 이벤트로 생성된 캐릭터의 라벨이 `"팀명 · 직급"` 형태로 보이는지, 완료
     개수가 늘면서 사원→대리→과장으로 바뀌는지
  4. 에이전트가 퇴근하면 즉시 사라지지 않고 짧게 페이드아웃된 뒤 사라지는지
  5. 유휴 상태인 에이전트 중 일부가 가끔 휴게실로 갔다가 잠시 후 복귀하는지
  6. `design-publishing-dept` 서브에이전트를 실제로 호출했을 때 디자인퍼블리싱팀
     방에 캐릭터가 나타나는지

## 범위 밖 (Out of scope)

- pixel-agents 저장소의 실제 캐릭터/배경 PNG 애셋 연동
- 직급 체계의 세션 간 영구 저장
- 휴게실 체류 중 캐릭터 간 상호작용
- 벽 충돌/경로탐색, 카메라 사용자 조작, 실시간 조명 그림자
