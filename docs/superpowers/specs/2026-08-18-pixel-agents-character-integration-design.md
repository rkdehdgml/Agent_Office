# pixel-agents 캐릭터 애셋 통합 (Phase 1: 캐릭터만) — 설계 문서

날짜: 2026-08-18

## 배경 및 목적

[[2026-08-13-office-ranks-teams-departments-design]]에서 직급/팀 표시와 부서
확장을 마친 뒤, 사용자가 [pixel-agents](https://github.com/pixel-agents-hq/pixel-agents)
프로젝트가 쓰는 캐릭터/배경 디자인을 참고해 AgentOffice의 시각적 완성도를
높이고 싶다고 요청했다. 조사 결과 pixel-agents는 GitHub 저장소에 자체
번들 PNG 애셋(캐릭터 6종, 벽 4종, 바닥 다수)을 갖고 있어, 이를 직접
가져와 쓰기로 했다(옵션 A — 자체 애셋 재사용).

지금 AgentOffice의 캐릭터는 `pixelSprite.ts`가 매 프레임 `fillRect`로
직접 그리는 16×22px 손그림 스프라이트이고, 부서 구분은 `CharacterActor.tsx`의
`PALETTE` record로 몸통/머리/피부/바지 색을 부서별로 다르게 칠하는 방식이다.
완성된 pixel-agents PNG 아트는 이런 팔레트 재염색이 불가능하므로, 부서 구분
방식 자체를 바꿔야 한다.

브레인스토밍 중 사용자가 두 가지를 확정했다:
- 부서 구분은 캐릭터 색이 아니라 **이름표(명찰)에 팀명·직급을 표시**하는
  방식으로 한다.
- 애니메이션은 지금(정지 포즈 1개 + 걷기 대체 프레임 1개) 수준보다
  **더 풍부한 걷기 애니메이션**으로 확장한다.

pixel-agents 자체 소스(`core/src/assets/{constants.ts,pngDecoder.ts}`,
`webview-ui/src/office/sprites/spriteData.ts`)를 읽어 스프라이트 시트의
정확한 프레임 격자와 프레임별 역할(걷기/타이핑/읽기)을 확인했다 — 이 문서의
치수와 프레임 인덱스는 전부 이 소스에서 확인한 값이다.

작업량이 커서 **캐릭터**와 **배경(바닥/벽)**을 두 단계로 분리하기로 했다
(사용자 확인, 2026-08-18 대화). 이 문서는 1단계(캐릭터)만 다룬다.

## 범위

포함:
- `char_0.png`~`char_5.png`(각 112×96px)를
  `ui/public/pixel-agents-assets/characters/`에서 로드해 캐릭터 스프라이트로
  사용
- 팀(부서) → 캐릭터 파일 고정 매칭으로 `PALETTE` 재염색 방식 대체
- `walk`/`idle`/`type`/`read`/`alert` 다섯 애니메이션 클립 전부에 pixel-agents
  프레임을 매핑 (지금은 `walk`만 2프레임 alternate, 나머지는 정지)
- (확인만) 팀·직급 명찰 표시는 기존 `labelFor`/`StatusLabel`이 이미 처리 —
  캐릭터 아트 교체 후에도 그대로 동작하는지 수동 확인만 한다

범위 밖:
- 바닥(`floor_N.png`)/벽(`wall_N.png`) 애셋 교체 — 2단계로 분리, 별도
  브레인스토밍/스펙에서 다룬다 (벽은 인접 감지 기반 비트마스크 오토타일링이
  필요해 설계가 따로 필요함)
- 이동 방향(상/하/좌/우)에 따른 스프라이트 방향 전환 — 지금 AgentOffice는
  애초에 방향 개념이 없고(항상 정면 고정), 이번 스코프에서는 pixel-agents의
  "right" 방향 행 하나만 고정으로 사용한다. 방향 전환은 이동 벡터 계산이
  추가로 필요한 후속 작업으로 분리
- 캐릭터 파일 수(6종) 대비 팀 수(4팀)를 넘어서는 배정 로직(랜덤/순환 배정
  등) — 지금은 팀 4개, 여유 파일 2개(`char_4`, `char_5`)로 고정 매칭이면
  충분

## A. 애셋 파이프라인

`char_N.png`(112×96)는 3방향(down y=0, up y=32, right y=64) × 7프레임
(16×32px씩, 가로로 나열) 구조다. 좌측 방향은 저장돼 있지 않고 right 행을
좌우 반전해서 쓰는 구조이지만, 이번 스코프에서는 반전을 쓰지 않고 right
행만 사용한다.

`pixelSprite.ts`의 `drawCharacterFrame(ctx, palette, frame: 0|1)`을
`drawCharacterFrame(ctx, img: HTMLImageElement, frameIndex: number)`로
바꾼다. 내부는 `fillRect` 다중 호출 대신 아래 한 줄로 대체된다.

```ts
const FRAME_W = 16, FRAME_H = 32, RIGHT_ROW_Y = 64;
ctx.drawImage(
  img,
  frameIndex * FRAME_W, RIGHT_ROW_Y, FRAME_W, FRAME_H,
  0, 0, FRAME_W, FRAME_H,
);
```

`useCharacterSpriteTexture.ts`는 지금처럼 매 인터벌마다 캔버스를 다시
그려 `CanvasTexture`를 갱신하는 구조를 그대로 유지한다 — 갱신 대상이
`fillRect` 좌표에서 `drawImage` 크롭 좌표로 바뀔 뿐, 텍스처 갱신
메커니즘 자체는 바뀌지 않는다.

이미지 로드는 모듈 로드 시 팀별 `char_N.png` 6개를 `new Image()`로
한 번만 프리로드해 모듈 스코프에 캐시한다(팀 수만큼이 아니라 파일
6개 전부를 한 번씩만).

## B. 팀 → 캐릭터 파일 고정 매칭

`CharacterActor.tsx`의 `PALETTE` record를 아래 매핑으로 대체한다.

```ts
// ui/src/scene/characterSprites.ts
export const CHARACTER_FILE: Record<string, string> = {
  "research-dept": "char_0.png",
  "planning-dept": "char_1.png",
  "dev-dept": "char_2.png",
  "design-publishing-dept": "char_3.png",
};
const DEFAULT_CHARACTER_FILE = "char_4.png";
export function characterFileFor(agentType: string): string {
  return CHARACTER_FILE[agentType] ?? DEFAULT_CHARACTER_FILE;
}
```

`char_5.png`는 향후 팀 추가 시 다음 여유분으로 남겨둔다. 고정
팀장/부장 캐릭터(`fixedCharacters.ts`)도 동일한 `agentType` 키를 쓰므로
별도 매핑 없이 같은 함수를 재사용한다.

## C. 애니메이션 클립 → 프레임 매핑

pixel-agents의 프레임 역할(걷기 0-2, 타이핑 3-4, 읽기 5-6)을 기존
`AnimationClip` 타입에 그대로 매핑한다.

| 클립 | 프레임 인덱스 | 순환 방식 |
|---|---|---|
| `walk` | 0, 1, 2 | `[0,1,2,1]` 4스텝 핑퐁, 220ms 간격 |
| `idle` | 1 | 고정 (걷기 중간 프레임 재사용) |
| `type` | 3, 4 | 2프레임 alternate, 220ms 간격 |
| `read` | 5, 6 | 2프레임 alternate, 220ms 간격 |
| `alert` | 5, 6 | `read`와 동일 프레임 + 스프라이트 테두리 강조색으로 구분 (pixel-agents에 대응 프레임 없음) |

`useCharacterSpriteTexture.ts`는 지금 `clip === "walk"`일 때만 인터벌을
돌리던 조건을 `clip !== "idle"`(즉 walk/type/read/alert 전부)로 넓히고,
클립별로 순환할 프레임 배열을 상수 테이블로 갖는다.

```ts
// ui/src/scene/animationClip.ts에 추가
const CLIP_FRAMES: Record<AnimationClip, readonly number[]> = {
  idle: [1],
  walk: [0, 1, 2, 1],
  type: [3, 4],
  read: [5, 6],
  alert: [5, 6],
};
```

## D. 팀·직급 명찰 — 이미 구현되어 있음 (변경 없음)

계획 작성 단계에서 코드를 다시 확인한 결과, `officeLabel.ts`의
`labelFor(agentType, completedCount, isFixed)`가 이미
`"{팀명} · {직급}"` 문자열을 만들어 `CharacterActor.tsx`에서
`StatusLabel`의 `name` prop으로 넘기고 있다([[2026-08-13-office-ranks-teams-departments-design]]에서
구현됨). 즉 "캐릭터 색으로 구분이 안 되니 명찰로 팀/직급을 표시해달라"는
요구사항은 **이미 충족되어 있다** — pixel-agents 아트로 캐릭터를 바꿔도
이 라벨 표시 자체는 그대로 유지되므로 Phase 1에서 `StatusLabel`/`App.css`를
건드릴 필요가 없다.

캐릭터 색상으로 팀을 구분하던 것(`PALETTE.body` 등)을 제거해도, 라벨에
이미 팀명이 텍스트로 노출되므로 별도의 배지 강조색을 새로 만들 필요는
없다(YAGNI) — `PALETTE`는 대체 없이 제거한다.

## 변경/신규 파일 요약

수정:
- `ui/src/scene/pixelSprite.ts` — `drawCharacterFrame`을 팔레트 기반
  그리기에서 PNG 크롭 기반으로 교체
- `ui/src/scene/useCharacterSpriteTexture.ts` — 프레임 갱신 조건/인덱스를
  클립별 프레임 배열 기반으로 확장
- `ui/src/scene/animationClip.ts` — `CLIP_FRAMES` 테이블 추가
- `ui/src/scene/CharacterActor.tsx` — `PALETTE` 제거, `characterFileFor`
  사용 (`StatusLabel` 호출부는 변경 없음 — 기존 `labelFor` 그대로 사용)

신규:
- `ui/src/scene/characterSprites.ts` — `characterFileFor`, 이미지 프리로드
  캐시, `BADGE_ACCENT_COLOR` + 유닛 테스트

애셋(이미 다운로드 완료, 커밋 필요):
- `ui/public/pixel-agents-assets/characters/char_0.png`~`char_5.png`

## 테스트 전략

- `characterSprites.ts`의 `characterFileFor`에 vitest 유닛 테스트: 4개
  부서 + 미지 슬러그 폴백 케이스
- `animationClip.ts`의 `CLIP_FRAMES` 테이블에 대해 다섯 클립 모두 정의돼
  있는지, 인덱스가 0~6 범위인지 검증하는 유닛 테스트
- 기존 vitest 스위트 전체 통과 확인 (`npm --prefix ui run test`)
- 수동 확인 (`npm run dev`):
  1. 4개 팀 캐릭터가 서로 다른 pixel-agents 캐릭터 아트로 보이는지
  2. 명찰에 `"팀명 · 직급"`이 정상 표시되는지, 팀별 강조색이 유지되는지
  3. walk/idle/type/read/alert 다섯 상태 전환 시 각각 다른 프레임(또는
     프레임 조합)으로 애니메이션되는지, 특히 걷기가 이전보다 프레임이
     늘어 더 자연스러워 보이는지
  4. 고정 팀장/부장 캐릭터도 동일한 아트/명찰 방식으로 보이는지

## 범위 밖 (Out of scope)

- 바닥/벽 pixel-agents 애셋 교체 (2단계, 별도 스펙)
- 이동 방향 기반 스프라이트 좌우/상하 반전
- 6종 캐릭터 파일을 넘어서는 배정 로직
