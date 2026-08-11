# Agent Office

Claude Code에서 실행되는 AI 에이전트(메인 스레드 + 서브에이전트)들의 작업 상태를
미니어처 사무실 화면으로 실시간 시각화하는 개인용 로컬 도구입니다. 전부 localhost에서
동작하며 외부 배포는 없습니다.

## 실행 방법

1. 의존성 설치 (최초 1회):
   ```bash
   npm install
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

## 픽셀아트 에셋 교체

현재 UI는 절차적으로 생성된 플레이스홀더 픽셀아트를 사용합니다. 아래는 향후 실제 무료 에셋 팩으로 교체하는
수동 절차입니다. 모든 다운로드는 itch.io 및 kenney.nl에서 이루어지며, 코드 변경이 필요한 부분은 명시되어 있습니다.

### 절차

1. **MetroCity 캐릭터 팩 다운로드**
   - https://jik-a-4.itch.io/metrocity-free-topdown-character-pack 에서 "Download Now" 클릭
   - "No thanks, just take me to the downloads" 선택 (선택사항 결제 건너뛰기)
   - ZIP 파일 저장

2. **같은 작가의 인테리어 팩 다운로드**
   - itch.io에서 "JIK-A-4 top down interior" 검색 (캐릭터 팩 페이지에서도 링크됨)
   - 해당 팩 다운로드 및 저장

3. **스프라이트 시트 추출**
   - `ui/public/` 디렉터리가 아직 없다면 새로 생성
   - 캐릭터 스프라이트 PNG → `ui/public/sprites/characters/` (디렉터리 생성 후 저장)
   - 인테리어 타일 PNG → `ui/public/sprites/interior/` (디렉터리 생성 후 저장)

4. **pixelSprite.ts의 drawCharacterFrame 함수 업데이트**
   - 파일: `ui/src/scene/pixelSprite.ts`
   - 현재: 절차적 `fillRect` 블록 사용
   - 변경: 실제 스프라이트 시트에서 `drawImage` 크롭으로 변경
   - 이미지 뷰어에서 PNG를 열어 프레임 그리드 크기 확인 (MetroCity 시트는 보통 애니메이션 방향별 고정 행 레이아웃)
   - **이미지 로딩은 비동기**: `new Image()`의 `src`가 로드되기 전에 `drawImage`를 호출하면 아무것도 그려지지 않고 이후에도 다시 그려지지 않습니다. 스프라이트 시트 이미지를 모듈 스코프에서 한 번만 로드하고, `img.onload`에서 (이미 그려진 프레임이 있다면) 다시 그린 뒤 텍스처의 `needsUpdate = true`를 설정하세요.
   - **시그니처 변경 필요**: 현재 `(ctx, palette, frame: 0 | 1) => void`에는 애니메이션 종류(clip) 구분이 없어 읽기/쓰기/경고 등 서로 다른 모션을 표현할 수 없습니다. 디자인 문서의 애니메이션 표를 실제로 구현하려면 `clip: AnimationClip` 매개변수를 추가하고, 유일한 호출부인 `ui/src/scene/useCharacterSpriteTexture.ts`도 함께 수정해야 합니다.

5. **부서별 색상 틴트 처리**
   - 현재: 절차적 팔레트 생성 (단일 템플릿만 존재)
   - 변경: 스프라이트 그린 후 `ctx.globalCompositeOperation = "multiply"` 설정
   - 부서 색상으로 오버레이 채우기
   - 합성 모드 초기화
   - 결과: 단일 실제 스프라이트 시트로 네 부서 모두 지원

6. **사운드 효과 추가**
   - Kenney의 무료 CC0 UI 오디오 팩 다운로드: https://kenney.nl/assets/ui-audio
   - 3개 짧은 클립 선택 및 저장:
     - `ui/public/sfx/complete.mp3`
     - `ui/public/sfx/failure.mp3`
     - `ui/public/sfx/leave.mp3`
   - 코드 변경 불필요: `ui/src/audio/playSound.ts`는 이미 이 경로들을 가리킴

7. **크레딧 추가**
   - README 또는 적절한 크레딧 파일에 다음 줄 추가:
     > Character/interior art by JIK-A-4 (MetroCity, free). UI sound effects by Kenney (kenney.nl, CC0).
