# 픽셀아트 탑다운 오피스 시각화 — 설계 문서

날짜: 2026-08-11

## 배경 및 목적

현재 `ui/`는 react-three-fiber(R3F) 기반 3D 씬으로 구현되어 있다 (`OfficeScene.tsx`,
`CharacterActor.tsx` 등, [[2026-08-07-agent-office-design]] 참고). 캐릭터는 박스
지오메트리를 쌓은 voxel 형태이고, 카메라는 대각선에서 내려다보는 원근(perspective)
투영이다.

참고 영상(Pixel Agents — VS Code 확장, JIK-A-4의 MetroCity 캐릭터팩을 사용하는
정통 2D 픽셀아트 탑다운 게임 스타일)과 같은 룩앤필을 이번 프로젝트에도 적용한다.
목표는 **엔진(react-three-fiber)은 유지**하면서 **렌더링 결과물만 2D 픽셀아트
탑다운 스타일로 교체**하는 것이다.

## 범위

포함:
- 카메라를 직교(orthographic) 탑다운으로 전환
- 캐릭터를 voxel 박스에서 스프라이트 빌보드(항상 카메라를 향하는 2D 이미지)로 교체
- 무료 CC0 픽셀아트 에셋(캐릭터 + 오피스 인테리어)으로 시각 자산 교체
- 이벤트 상태 → 스프라이트 애니메이션 클립 매핑
- 캐릭터 머리 위 이름표/말풍선 오버레이 (신규)
- 완료/실패/퇴근 시 효과음 (신규, 기본 음소거)

범위 밖 (Out of scope):
- 오피스 레이아웃 에디터 (바닥/벽/가구를 사용자가 직접 배치·색칠하는 기능) — 사용자
  확인 결과 이번 스코프에서 제외, 부서별 방 배치는 지금처럼 코드로 고정
- [[2026-08-07-agent-office-design]]에 명시된 기존 범위 밖 항목들(외부 배포, 인증,
  이벤트 디스크 영속화, 다중 세션, 모바일 반응형)은 이번에도 동일하게 범위 밖

## 렌더링 아키텍처

기존 이동/상태 로직(`useWalkerCommands`, `deskLayout.ts`, `officeReducer.ts`,
방문/인사 페이즈 전환)은 전부 재사용한다. 변경되는 것은 렌더링 레이어뿐이다.

- `OfficeScene.tsx`: `PerspectiveCamera`(현재 `position=[14,16,14]`, 대각선 시점)를
  `OrthographicCamera`로 교체한다. 카메라는 오피스 평면 정중앙 위쪽에 위치하고
  똑바로 아래를 본다 (`lookAt(0,0,0)`, 카메라 위치는 y축 위주).
- `CharacterActor.tsx`: 지금의 5개 `boxGeometry` 메시(몸통/팔다리/머리/머리카락)
  조합을 스프라이트 하나로 교체한다. 스프라이트는 카메라를 향해 항상 정면으로
  보이는 billboard 방식(three.js `Sprite` 또는 항상 카메라를 바라보도록 회전시킨
  평면)을 사용한다 — 카메라가 위에서 내려다봐도 스프라이트 자체는 "정면 픽셀아트"로
  렌더링되어, 순수 2D 캔버스로 그린 것과 픽셀 단위로 동일하게 보인다. (브레인스토밍
  중 브라우저 데모로 A안(순수 2D canvas)과 B안(현재 방식)을 나란히 렌더링해 이
동일함을 확인함.)
- 텍스처는 `THREE.NearestFilter`로 설정해 확대 시에도 픽셀이 뭉개지지 않고 또렷하게
  보이도록 한다.

## 에셋

- **캐릭터**: MetroCity Free Top Down Character Pack (제작자 JIK-A-4, 무료/크레딧
  표시 권장 라이선스). 기본 캐릭터 모델과 4방향 걷기 애니메이션 프레임 포함.
- **오피스 인테리어**: 동일 작가가 배포하는 무료 탑다운 인테리어 에셋 팩. 지금의
  단색 박스 바닥/책상(`Desk.tsx`, `Props.tsx`, `OfficeScene.tsx`의 `planeGeometry`
  바닥)을 타일 텍스처로 교체.
- **부서 색상 구분**: 스프라이트를 부서별로 4벌 구하는 대신, 기존 캐릭터 모델에
  머티리얼 틴트(색상 곱연산)를 적용해 지금의 `PALETTE`
  (research=블루, planning=퍼플, dev=그린, HQ=웜그레이/앰버)를 유지한다.
  비활성(퇴근) 상태의 회색조 처리도 동일한 방식으로 유지.
- **저장 위치**: `ui/public/sprites/characters/`, `ui/public/sprites/interior/`.
- **라이선스 표기**: README에 사용한 에셋 팩과 제작자 크레딧을 명시한다. 실제
  구현 시점에 각 팩의 정확한 라이선스 파일을 다시 한번 확인한다.

## 상태 → 애니메이션 매핑

[[2026-08-07-agent-office-design]]에 정의된 이벤트→상태 텍스트 매핑 테이블은
그대로 유지한다. 여기에 스프라이트 애니메이션 클립을 추가로 매핑한다:

| 상태 | 애니메이션 클립 |
|---|---|
| idle (대기, 출근 직후) | idle 프레임 (약한 bob 유지) |
| walking-to-visit / walking-back (인사하러 이동) | walk 사이클 |
| Read/Glob/Grep/WebSearch/WebFetch 중 | read 프레임 |
| Write/Edit 중 | type 프레임 |
| Bash/그 외 tool_name | idle 프레임 유지 (전용 애니메이션 없음) |
| PostToolUseFailure (⚠️) | alert 프레임 |
| SubagentStop (퇴근) | idle + 회색조 + opacity 0.5 (기존 로직 유지) |

## 이름표 / 말풍선 (신규)

- `@react-three/drei`의 `<Html>`을 사용해 캐릭터 머리 위에 3D 좌표 기준으로
  DOM 오버레이를 띄운다 (three.js 카메라 투영을 자동으로 따라가므로 수동 좌표
  계산 불필요).
- 평상시: `부서/agent_id` + 현재 상태 텍스트(예: "자료 찾는 중 🔍")를 작은
  라벨로 표시.
- 대기/실패 상태일 때: 말풍선 스타일로 강조 표시.
- 신규 컴포넌트: `ui/src/scene/StatusLabel.tsx`.

## 사운드 (신규)

- 완료(✅), 실패(⚠️), 퇴근 시 짧은 효과음 재생. Kenney의 무료 CC0 UI 사운드팩
  사용.
- **기본값은 음소거(OFF)**. 화면 한쪽에 음소거 토글 버튼을 두어 사용자가 원할
  때만 켤 수 있게 한다. 설정은 세션 내에서만 유지(새로고침 시 다시 기본 음소거로
  초기화되어도 무방 — 개인용 로컬 도구 스코프에서 영속화는 범위 밖).
- 신규 모듈: `ui/src/audio/sfx.ts` — 음소거 상태를 확인한 뒤에만 재생하는 얇은
  wrapper.

## 변경/신규 파일 요약

수정:
- `ui/src/scene/OfficeScene.tsx` — 카메라를 orthographic으로 교체
- `ui/src/scene/CharacterActor.tsx` — 박스 메시 → 스프라이트 빌보드 + 애니메이션
  상태머신으로 교체
- `ui/src/scene/Desk.tsx`, `ui/src/scene/Props.tsx` — 단색 지오메트리 → 타일
  텍스처

신규:
- `ui/src/scene/spriteSheets.ts` — 스프라이트 시트 프레임 좌표 및 애니메이션 클립
  정의
- `ui/src/scene/StatusLabel.tsx` — 이름표/말풍선 오버레이
- `ui/src/audio/sfx.ts` — 효과음 트리거 + 음소거 상태 관리
- `ui/public/sprites/characters/*`, `ui/public/sprites/interior/*` — 에셋 파일

## 테스트 전략

[[2026-08-07-agent-office-design]]와 동일하게 자동화 유닛 테스트는 이 규모에서
과함. curl로 가짜 이벤트를 순서대로 주입(`SubagentStart` → `PreToolUse`(Read) →
`PostToolUse` → `PostToolUseFailure` → `SubagentStop`)하며 브라우저에서 다음을
육안으로 확인한다:
- 애니메이션 클립이 상태에 맞게 전환되는지 (idle/walk/read/type/alert)
- 이름표/말풍선 텍스트가 실시간으로 갱신되는지
- 음소거 기본값이 OFF이고, 토글 시 효과음이 재생/정지되는지
- 카메라가 정직교 탑다운으로 렌더링되고 스프라이트가 항상 정면으로 보이는지
