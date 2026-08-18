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
- `"design-publishing-dept 에이전트로 디자인 시안 초안을 정리해줘"`

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

**캐릭터 스프라이트는 완료됨.** 캐릭터는 더 이상 절차적 플레이스홀더가 아니라
[pixel-agents](https://github.com/pixel-agents-hq/pixel-agents) 프로젝트가 번들로
제공하는 실제 PNG 스프라이트(`ui/public/pixel-agents-assets/characters/char_0.png`~`char_5.png`)를
사용합니다. 팀/부서 구분은 캐릭터 색이 아니라 이름표(명찰)의 팀명·직급 텍스트로
표시하며, 부서별 캐릭터 재염색은 하지 않습니다. 자세한 배경, 프레임 격자, 팀→파일
매칭, 애니메이션 클립 매핑은
[`docs/superpowers/specs/2026-08-18-pixel-agents-character-integration-design.md`](docs/superpowers/specs/2026-08-18-pixel-agents-character-integration-design.md)를
참고하세요.

아래 절차는 이 브랜치와 무관하게 아직 남아 있는 항목입니다.

### 절차

1. **사운드 효과 추가**
   - Kenney의 무료 CC0 UI 오디오 팩 다운로드: https://kenney.nl/assets/ui-audio
   - 3개 짧은 클립 선택 및 저장:
     - `ui/public/sfx/complete.mp3`
     - `ui/public/sfx/failure.mp3`
     - `ui/public/sfx/leave.mp3`
   - 코드 변경 불필요: `ui/src/audio/playSound.ts`는 이미 이 경로들을 가리킴

2. **크레딧**
   - 캐릭터 아트: pixel-agents (MIT) — 자세한 라이선스 전문은
     [`ui/public/pixel-agents-assets/ATTRIBUTION.md`](ui/public/pixel-agents-assets/ATTRIBUTION.md) 참고.
   - UI 사운드 효과: Kenney (kenney.nl, CC0) — 위 1번 절차를 완료하면 아래 줄을 추가:
     > UI sound effects by Kenney (kenney.nl, CC0).

### 남은 작업 (별도 단계)

바닥/벽(배경) 아트 교체는 아직 진행되지 않았고 별도의 향후 단계(Phase 2)로 남아
있습니다. 설계 문서의 방향에 따르면 이 작업 역시 MetroCity 인테리어 팩이 아니라
pixel-agents 자체 번들의 바닥/벽 애셋(`floor_N.png`/`wall_N.png`)을 사용할
예정이며, 벽은 인접 감지 기반 비트마스크 오토타일링이 필요해 별도 설계가 필요합니다.
구체적인 절차는 이 README가 아니라 Phase 2 전용 설계 문서에서 다룹니다.
