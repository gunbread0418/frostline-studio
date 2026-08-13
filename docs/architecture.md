# Architecture

## 목적

Frostline Studio는 테마 편집 기능과 외부 애플리케이션 연동을 분리합니다. 미리보기 기능이 실제 Codex 앱에 접근할 이유가 없도록 만드는 것이 가장 중요한 경계입니다.

## 프로세스 구조

```text
React Renderer
  ├─ 테마 편집과 실시간 PreviewAdapter
  └─ window.frostline (제한된 API)
           │
           ▼
Electron preload
  └─ 명시적으로 허용한 IPC 채널만 노출
           │
           ▼
Electron main
  ├─ 네이티브 파일 선택 창
  ├─ userData/images로 사진 복사
  ├─ 임시 파일 + 교체 방식의 설정 저장
  ├─ 테마 가져오기/내보내기
  ├─ 관리 사진의 축소 BGRA 표본으로 로컬 추천 팔레트 계산
  ├─ 검증된 수동 Appearance 가이드를 클립보드에 복사
  └─ OfficialCodexAdapter
       ├─ Windows 보조 프로그램: 패키지 ID 확인과 1회 실행
       ├─ 127.0.0.1 CDP 대상 및 포트 소유자 검증
       └─ 선택한 Renderer 하나에 사진 레이어와 테마 토큰 주입·갱신·제거
```

Renderer에는 Node 전역 객체와 파일 경로가 노출되지 않습니다. 사진은 임의 파일 경로 대신 앱이 관리하는 읽기 전용 `frostline-asset://` URL로 표시합니다.

수동 Appearance 가이드는 Renderer에서 현재 테마의 공개 색상값으로 생성합니다. main 프로세스는 문자열 길이와 제어 문자를 검증한 뒤 클립보드에 쓰며 Codex 앱에는 접근하지 않습니다.

## Adapter 경계

- `PreviewAdapter`: React 안에서 공통 테마 토큰으로만 렌더링합니다. 외부 프로세스 접근 권한이 없습니다.
- `OfficialCodexAdapter`: 사용자 승인을 받은 실험적 M3 경계입니다. 실행 중인 Codex가 있으면 적용하지 않고 사용자의 정상 종료를 기다립니다. 이후 확인한 패키지 ID를 사용해 Codex를 한 번 실행하고, loopback CDP의 정확한 메인 Renderer 한 곳에만 사진 스킨을 주입합니다. 활성 세션에서는 새 프로세스 없이 같은 표식의 레이어만 갱신하며 첫 실패에 라이브 연결을 잠급니다.
- `AppServerClientAdapter`: 공식 Codex App Server를 활용하는 독립 클라이언트가 필요할 때 검토할 미래 경계입니다. 공식 데스크톱 앱의 UI를 수정하는 Adapter가 아닙니다.

Adapter가 분리되어 있어도 공식 지원이나 안전 승인이 생기는 것은 아닙니다. M2의 공식 API 부재 결정은 [ADR-0001](adr/0001-codex-integration-boundary.md), 사용자가 승인한 M3의 제한된 CDP 결정은 [ADR-0002](adr/0002-loopback-cdp-runtime-skin.md)에 기록했습니다.

## 데이터 구조

```text
Electron userData/Frostline Studio/
  ├─ themes.json
  ├─ codex-cdp-session.json
  └─ images/
       └─ <random-uuid>.<approved-extension>
```

원본 경로는 저장하지 않습니다. 앱 전용 사진은 무작위 파일명으로 복사하며 Renderer에는 관리 URL만 전달합니다. `themes.json`은 버전이 있는 JSON 문서이며 v1 데이터는 v2로 명시적으로 변환합니다. `codex-cdp-session.json`에는 사진이나 계정 데이터가 아니라 단계, 무작위 포트, 확인된 앱 ID, 주입 표식만 원자적으로 저장합니다.

미리보기와 실제 Codex 컴파일러는 `resolveThemeTokens`를 함께 사용합니다. 이 공통 계층에서 표면 불투명도, 읽기 쉬운 글자·입력 커서 대체색, UI·코드 글꼴 스택을 계산하므로 두 화면의 색상 해석이 달라지는 범위를 줄입니다. 실제 Codex의 레이아웃과 자체 컴포넌트는 Frostline이 복제하지 않으므로 픽셀 단위로 완전히 같아지는 것은 보장하지 않습니다.

## Windows 배포 구조

```text
TypeScript + React source
  └─ npm run build
       ├─ dist/                 Renderer production bundle
       └─ dist-electron/        Electron main/preload bundle
             └─ electron-builder
                  ├─ release/win-unpacked/
                  ├─ Frostline-Studio-<version>-Setup-x64.exe
                  └─ SHA256SUMS.txt
```

`electron-builder`는 허용 목록에 있는 파일만 `app.asar`로 묶습니다. 패키지 검사는 archive 내부 경로와 앱 소유 텍스트 파일의 민감정보 패턴을 확인합니다. 설치 스모크 테스트는 운영 사용자 데이터와 분리된 임시 경로에 설치해 저장·재실행·제거를 검증합니다.

GitHub의 Package Windows 워크플로는 수동 실행과 버전 태그에서 unsigned 설치 파일을 만듭니다. 코드 서명 인증서나 인증서 비밀번호는 저장소에 두지 않습니다.

## 자동 적용 상태 머신

자동 적용 상태 머신은 `src/shared/auto-apply-machine.ts`에 순수 함수로 정의되어 있습니다.

```text
disabled
  └─ ENABLE → waiting-for-codex
                  └─ 새 PID → applying
                                 ├─ 성공 → applied
                                 └─ 한 번 실패 → circuit-open
                                                     └─ MANUAL_RETRY → waiting-for-codex

모든 활성 상태 ── EMERGENCY_STOP → emergency-stopped
```

`handledProcessIds`로 같은 Codex 프로세스 ID에 두 번 자동 적용하지 않습니다. 실패하면 회로 차단 상태가 되어 자동 재시도를 막습니다. 이 상태 머신은 아직 M4 운영체제 이벤트나 자동 시작에 연결하지 않았습니다. 현재 M3는 별도의 수동 `waiting-for-exit → armed → active` 세션만 사용하며, `active` 안의 라이브 갱신은 새 Codex 실행이나 새 CDP 세션을 만들지 않습니다.
