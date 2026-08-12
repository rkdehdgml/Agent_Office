# 쿼터뷰(아이소메트릭) 카메라 전환 + 방 구분 — 설계 문서

날짜: 2026-08-12

## 배경 및 목적

[[2026-08-11-pixel-office-visual-redesign-design]]에서 카메라를 완전 수직 탑다운
`OrthographicCamera`(`position=[0,20,0.01]`, `lookAt(0,0,0)`)로 정한 것은, 참고
프로젝트([pixel-agents](https://github.com/pixel-agents-hq/pixel-agents))가 순수
2D Canvas로 그리는 정통 탑다운 룩을 재현하기 위한 의도적 선택이었다. 캐릭터를
카메라 항상-정면 스프라이트(billboard)로 만들면 수직 탑다운에서도 순수 2D 캔버스와
픽셀 단위로 동일하게 보인다는 점까지 그 시점에 브라우저 데모로 확인했다.

이번 라운드에서 실제로 pixel-agents 저장소의 스크린샷(`banner.png`, `office.png`,
`characters.png`)을 받아 확인한 결과, 해당 프로젝트는 애초에 **three.js를 쓰지 않는
순수 2D Canvas 탑다운**이며 아이소메트릭이 아니다. 반면 사용자가 원한 것은 pixel-agents
그 자체의 재현이 아니라 "더 입체감 있는 3D처럼 보이는 화면"이었다 — 즉 목표가
[[2026-08-11-pixel-office-visual-redesign-design]]이 만든 결과물과는 다른 방향이다.

카메라 각도는 감으로 정하지 않고, `OfficeScene.tsx`에 화살표 키로 기울기를 조절할
수 있는 임시 미리보기(스파이크, 커밋 대상 아님)를 추가해 `npm run dev`로 직접 실행하며
사용자가 눈으로 비교해 결정했다. 최종값: **기울기 50°(수직 기준), 방위각 45°**.

이 문서는 그 확정값을 정식 구현하고, 지금은 아예 없는 벽/방 구분을 추가하는 범위를
다룬다.

## 범위

포함:
- 카메라를 고정 쿼터뷰 각도(기울기 50°, 방위각 45°)로 전환
- 부서별 방을 시각적으로 구분하는 벽(외곽 + 칸막이) 추가, 단 부서 간 방문 애니메이션이
  지나갈 수 있도록 중앙에 넓은 개방 구역을 둠
- 캐릭터/가구 밑에 반투명 타원형 blob 그림자 추가
- 미리보기 스파이크(`TiltPreviewCamera`, `PreviewWalls`, 화살표 키 조작)를 정식 상수
  기반 구현으로 교체하고 스파이크 코드 제거

범위 밖 (Out of scope, 2단계로 이연):
- 실제 MetroCity 캐릭터/인테리어 스프라이트 팩 연동 — itch.io 다운로드가 사용자의
  수동 브라우저 조작을 필요로 해 이번 스펙 검증 시점에 코드를 확정할 수 없다. 사용자가
  팩을 받아 `ui/public/sprites/`에 넣은 뒤 별도 브레인스토밍/스펙으로 진행한다
  (`README.md`의 "픽셀아트 에셋 교체" 절차가 그 밑그림).
- 카메라 사용자 조작(회전/줌/드래그) — [[2026-08-10-3d-office-design]]에서 이미
  범위 밖으로 정한 것을 유지
- 벽에 대한 실제 충돌/경로탐색 — 캐릭터는 지금처럼 두 좌표 사이를 직선 보간으로
  이동한다. 벽은 순수 시각 요소이며 충돌 로직은 추가하지 않는다
- 실시간 조명 그림자(`shadows={true}`) — blob 그림자로 대체, 성능 비용을 피한다

## 카메라

`OfficeScene.tsx`의 `OrthographicCamera`를 고정 구면좌표 계산으로 교체한다.

```ts
const TILT_DEG = 50;      // 수직 기준 기울기 (0 = 완전 수직 탑다운, 90 = 수평)
const AZIMUTH_DEG = 45;   // 남동쪽 방향에서 바라봄
const RADIUS = 24;

function cameraPositionForTilt(tiltDeg: number, azimuthDeg: number, radius: number): [number, number, number] {
  const tilt = (tiltDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;
  return [
    radius * Math.sin(tilt) * Math.cos(az),
    radius * Math.cos(tilt),
    radius * Math.sin(tilt) * Math.sin(az),
  ];
}
```

`cameraPositionForTilt`는 순수 함수로 별도 모듈(`ui/src/scene/cameraGeometry.ts`)에
분리해 유닛 테스트를 붙인다 (예: `tilt=0`이면 `[0, radius, 0]`, `tilt=90`이면
`y≈0`). `zoom={38}`과 `lookAt(0,0,0)`은 [[2026-08-11-pixel-office-visual-redesign-design]]
에서 검증된 값을 그대로 유지한다.

캐릭터 스프라이트(`<sprite>`)는 카메라를 항상 향하는 billboard라 각도 변경과 무관하게
코드 수정이 필요 없다.

## 벽 / 방 구분

`OfficeScene.tsx`에 신규 `Walls` 컴포넌트를 추가한다 (미리보기 스파이크의
`PreviewWalls`를 정식화).

- **외곽**: 바닥 전체(18×16, 중심 원점) 둘레를 감싸는 벽 4면, 높이 1.6, 두께 0.25,
  짙은 네이비(`#1b2130`)
- **칸막이**: x=0 축과 z=0 축을 기준으로 4사분면(research/planning/dev/본부)을
  나누되, 각 축마다 중앙 좌우 2유닛씩(합 4×4 구역)은 벽을 두지 않는다 — 부서 간
  방문 애니메이션(`useWalkerCommands.ts`)이 임의의 두 책상 좌표를 직선으로 잇기
  때문에, 중앙을 넓게 열어 대부분의 경로가 벽 없이 지나가도록 한다. 책상 슬롯
  (`deskLayout.ts`의 `DESK_SLOTS`, x/z가 항상 |값|≥2)과 겹치지 않으므로 안전하다
- **색상**: 칸막이는 `Desk.tsx`의 `DEPARTMENT_COLOR`를 참고해 인접 부서 색을 톤다운한
  값을 사용, 외곽보다 살짝 밝게 해 구분되게 한다

## 그림자 (Blob Shadow)

`officeTextures.ts`에 반투명 방사형 그라디언트 원 텍스처 생성 함수를 추가한다
(기존 `getFloorTexture`/`getDeskTopTexture`와 동일한 캔버스 생성 패턴).

- `CharacterActor.tsx`: 스프라이트 발밑(y≈0.02)에 작은 수평 평면 하나 추가, 이
  텍스처를 매핑, 불투명도 약 0.35
- `Desk.tsx`, `Props.tsx`: 각 오브젝트 밑동에 동일한 방식으로 하나씩 추가, 크기만
  오브젝트 폭에 맞게 조정
- 실시간 조명 그림자는 쓰지 않는다 (`Canvas shadows={false}` 유지)

## 데스크 / 소품 / 캐릭터

`Desk.tsx`, `Props.tsx`는 이미 실제 3D 메쉬(box/cylinder/sphere)라 기울어진
카메라에서 별도 수정 없이 입체감이 생긴다. 캐릭터 스프라이트도 위에서 설명한 대로
변경 없음. 이 문서에서 두 파일에 가해지는 유일한 변경은 blob 그림자 추가뿐이다.

## 변경/신규 파일 요약

수정:
- `ui/src/scene/OfficeScene.tsx` — 카메라 상수화, `Walls` 컴포넌트 추가, 미리보기
  스파이크 제거
- `ui/src/scene/CharacterActor.tsx` — blob 그림자 평면 추가
- `ui/src/scene/Desk.tsx`, `ui/src/scene/Props.tsx` — blob 그림자 평면 추가
- `ui/src/scene/officeTextures.ts` — blob 그림자 텍스처 생성 함수 추가

신규:
- `ui/src/scene/cameraGeometry.ts` — 구면좌표 → xyz 순수 함수 + 유닛 테스트
- `ui/src/scene/Walls.tsx` — 외곽 + 칸막이(중앙 개방) 벽 컴포넌트

## 테스트 전략

- `cameraGeometry.ts`의 `cameraPositionForTilt`에 vitest 유닛 테스트 추가 (기존
  `deskLayout.test.ts` 등과 동일한 패턴): 경계값(0°, 90°) 및 확정값(50°, 45°)에서
  좌표가 기대한 부호/범위인지 검증
- 벽 배치는 고정 상수 JSX라 별도 유닛 테스트 없이 육안 확인
- 기존 vitest 스위트 전체 통과 확인 (`npm --prefix ui run test`) — 이동/상태 로직은
  건드리지 않으므로 회귀가 없어야 한다
- 수동 확인 (`npm run dev`):
  1. 4개 부서 방이 벽으로 시각적으로 구분되는지
  2. README의 `"dev-dept 에이전트로 ..."` 같은 명령으로 실제 방문 애니메이션을
     트리거해, 캐릭터가 중앙 개방 구역을 통해 벽에 걸리지 않고 다른 방으로 걸어가는지
  3. 캐릭터/책상/소품 밑에 그림자가 자연스럽게 보이는지, 공중에 붕 떠 보이지 않는지

## 범위 밖 (Out of scope)

- 실제 MetroCity 에셋 연동 (2단계, 사용자의 itch.io 다운로드 선행 필요)
- 카메라 사용자 조작(회전/줌/드래그)
- 벽 충돌/경로탐색
- 실시간 조명 그림자
