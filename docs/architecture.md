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
  └─ 검증된 수동 Appearance 가이드만 클립보드에 복사
```

Renderer에는 Node 전역 객체와 파일 경로가 노출되지 않습니다. 사진은 임의 파일 경로 대신 앱이 관리하는 읽기 전용 `frostline-asset://` URL로 표시합니다.

수동 Appearance 가이드는 Renderer에서 현재 테마의 공개 색상값으로 생성합니다. main 프로세스는 문자열 길이와 제어 문자를 검증한 뒤 클립보드에 쓰며 Codex 앱에는 접근하지 않습니다.

## Adapter 경계

- `PreviewAdapter`: React 안에서 CSS로만 렌더링합니다. 외부 프로세스 접근 권한이 없습니다.
- `OfficialCodexAdapter`: M2 조사 결과 외부 프로그램용 공식 테마 적용 API가 확인되지 않아 기능을 모두 비활성화한 타입 계약으로 유지합니다.
- `AppServerClientAdapter`: 공식 Codex App Server를 활용하는 독립 클라이언트가 필요할 때 검토할 미래 경계입니다. 공식 데스크톱 앱의 UI를 수정하는 Adapter가 아닙니다.

Adapter가 분리되어 있어도 안전 승인이 생기는 것은 아닙니다. M3를 시작하려면 공식적으로 지원되는 적용 수단이 새로 확인되어야 하며, 그 뒤에도 사용자 승인이 별도로 필요합니다. 현재 결정의 근거는 [ADR-0001](adr/0001-codex-integration-boundary.md)에 기록했습니다.

## 데이터 구조

```text
Electron userData/Frostline Studio/
  ├─ themes.json
  └─ images/
       └─ <random-uuid>.<approved-extension>
```

원본 경로는 저장하지 않습니다. 앱 전용 사진은 무작위 파일명으로 복사하며 Renderer에는 관리 URL만 전달합니다. `themes.json`은 버전이 있는 JSON 문서입니다.

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

`handledProcessIds`로 같은 Codex 프로세스 ID에 두 번 적용하지 않습니다. 실패하면 회로 차단 상태가 되어 자동 재시도를 막습니다. M0/M1에서는 상태 머신만 정의하고 운영체제 이벤트나 Codex 프로세스와 연결하지 않습니다.
