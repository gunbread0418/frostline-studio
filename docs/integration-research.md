# M2 Codex integration feasibility research

조사 기준일은 2026-08-12입니다. 이 문서는 공식 OpenAI 문서와 현재 Windows 설치 상태를 읽기 전용으로 확인한 결과입니다. 지원되지 않는 내부 구현을 성공 가능한 기능으로 추정하지 않습니다.

## 결론

공식 Codex 데스크톱 앱에는 사용자가 직접 색상과 글꼴을 바꾸는 Appearance 설정이 있습니다. 그러나 사진 배경을 지정하거나 외부 프로그램이 사용자 테마를 적용·복원하는 공개 API는 공식 문서에서 확인되지 않았습니다.

이 결론은 공식 지원 범위에 대해서는 그대로 유효합니다. 이후 사용자가 비공식 방법의 위험을 이해하고 제한된 M3 실험을 별도로 승인해 `OfficialCodexAdapter`를 구현했습니다. 구현 결정과 안전 조건은 [ADR-0002](adr/0002-loopback-cdp-runtime-skin.md)를 따릅니다.

## 공식 문서에서 확인한 내용

### Codex 앱 Appearance

공식 Settings 문서는 `Ctrl+,`로 설정을 열 수 있다고 안내합니다. Appearance에서는 다음 항목을 앱 안에서 직접 설정할 수 있습니다.

- 기본 테마
- 강조색
- 배경색과 전경색
- UI 글꼴과 코드 글꼴
- 사용자 테마 공유

이 문서에는 사진 파일이나 이미지 배경을 선택하는 기능이 설명되어 있지 않습니다. `background`는 배경색을 뜻하며 사진 배경 지원의 근거가 아닙니다.

### Config reference

공식 설정 참조에서 확인되는 `tui.theme`은 터미널 UI의 구문 강조 테마입니다. 데스크톱 앱 Appearance 설정을 외부에서 가져오거나 적용하는 키, 사진 배경 키, 외부 테마 적용 API는 확인되지 않았습니다.

이 조사는 공식 설정 참조를 검색한 결과이며 내부 비공개 기능의 부재까지 증명하지는 않습니다. 공개 문서에 없는 기능은 Frostline Studio의 지원 기능으로 간주하지 않습니다.

### Codex App Server

공식 App Server는 독립 클라이언트가 Codex의 인증, 대화 기록, 승인, 스트리밍 이벤트를 다루도록 하는 JSON-RPC 인터페이스입니다. 기본 전송 방식은 표준 입출력을 사용하는 JSONL입니다.

WebSocket 전송은 실험적이며 운영 환경 지원 대상이 아닙니다. 향후 독립 클라이언트를 검토하더라도 기본 전송을 우선하고, WebSocket이 꼭 필요하면 `127.0.0.1`에만 바인딩합니다.

App Server는 공식 데스크톱 앱의 UI를 꾸미는 API가 아닙니다. `AppServerClientAdapter`는 별도의 Codex 클라이언트를 만드는 경우에만 의미가 있습니다.

## 로컬 읽기 전용 확인

현재 Windows 환경에서 다음 정보만 확인했습니다.

- 실행 중인 `ChatGPT`, `codex`, `codex-code-mode-host` 프로세스 이름과 기본 메타데이터
- 실행 파일 메타데이터에 표시된 제품명 `Codex`와 회사명 `OpenAI OpCo, LLC`
- 설치 경로 식별자에 포함된 앱 패키지 버전 `26.803.10989.0`
- 별도로 설치된 테마 프로그램의 시작 메뉴 항목 존재 여부

프로세스 명령줄은 조회하지 않았습니다. 사용자 이름이 포함된 절대 경로, PID, 로그인 정보, 계정 데이터도 저장소에 기록하지 않았습니다. 다른 테마 프로그램은 실행하거나 호출하거나 수정하지 않았습니다.

## 원래 M3 재검토 조건

M2 시점에는 다음 조건을 모두 충족하기 전에는 M3를 시작하지 않기로 했습니다. 이후 사용자가 공식 API 조건을 완화하고 수동 종료·loopback·무재시도 조건의 비공식 실험을 명시적으로 요청해 ADR-0002가 이 결정을 일부 대체했습니다.

1. OpenAI가 외부 프로그램용 테마 적용 또는 확장 API를 공식 문서로 공개합니다.
2. 실행 중인 Codex를 종료하거나 재시작하지 않고 한 번만 적용할 수 있습니다.
3. 설치 파일, 패키지, `.codex`, 채팅·로그인 데이터, 내부 상태 저장소를 수정하지 않습니다.
4. 원래 상태를 공식 인터페이스로 복원할 수 있습니다.
5. 짧은 타임아웃과 실패 후 무재시도 조건을 자동 테스트로 검증할 수 있습니다.
6. 구현 직전에 사용자가 M3 시작을 명시적으로 승인합니다.

## 공식 자료

- [Codex Settings](https://learn.chatgpt.com/docs/reference/settings)
- [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
