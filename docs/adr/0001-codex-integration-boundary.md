# ADR-0001: Keep official Codex theme application disabled

- Status: Accepted
- Date: 2026-08-12
- Scope: M2 read-only feasibility research

## Context

Frostline Studio는 사용자가 만든 사진·색상 테마를 미리 보여 줍니다. 제품 요구에는 공식 Codex 데스크톱 앱에 안전하게 적용하는 기능이 포함되어 있지만, 안전 규칙은 공식 지원이 확인되지 않은 방법을 성공 가능한 기능으로 가정하지 못하게 합니다.

공식 Codex 앱은 Appearance에서 색상과 글꼴을 직접 바꾸는 기능을 제공합니다. 하지만 사진 배경과 외부 테마 적용·복원 API는 공식 문서에서 확인되지 않았습니다. App Server는 독립 Codex 클라이언트를 만드는 인터페이스이며 공식 앱의 화면 스타일을 바꾸는 인터페이스가 아닙니다.

## Decision

1. `OfficialCodexAdapter`의 `apply`, `restore`, `autoApply` 기능은 계속 `false`로 둡니다.
2. 공식 적용 수단이 확인되기 전에는 M3와 M4를 구현하지 않습니다.
3. DOM 또는 CSS 런타임 주입, Electron 원격 디버깅 연결, 패키지 파일 수정, 내부 상태 파일 수정은 사용하지 않습니다.
4. 사용자는 공식 앱의 `Settings → Appearance`에서 Frostline Studio의 색상 값을 참고해 수동으로 설정할 수 있습니다. 이를 자동 적용으로 표현하지 않습니다.
5. 사진 배경이 필요한 경험은 Frostline Studio의 독립 미리보기 안에서만 제공합니다.
6. Codex 기능을 포함한 독립 클라이언트가 필요하면 `AppServerClientAdapter`를 별도 제품 방향으로 재검토합니다.

## Rejected runtime styling approach

런타임 주입은 공식 지원 수단이 아니므로 채택하지 않습니다. 예상되는 실패 조건과 위험은 다음과 같습니다.

- 앱 업데이트로 DOM 구조, CSS 선택자, 번들 해시가 바뀌면 즉시 깨질 수 있습니다.
- Content Security Policy나 디버깅 인터페이스 정책에 따라 연결 자체가 차단될 수 있습니다.
- 적용 도중 일부 스타일만 바뀌어 복원 기준을 잃을 수 있습니다.
- 프로세스 연결과 내부 구현 탐색이 사용자 데이터 보호 경계를 침범할 수 있습니다.
- Microsoft Store 패키지 무결성과 업데이트 호환성을 보장할 수 없습니다.

## Consequences

- M1의 미리보기와 테마 관리 기능은 공식 앱과 독립적으로 안전하게 유지됩니다.
- 현재 UI의 적용, 복원, 자동 적용 버튼은 계속 비활성 상태입니다.
- 공식 앱의 색상 테마와 Frostline Studio 간 자동 동기화는 제공하지 않습니다.
- M3 일정은 공식 외부 적용 기능이 공개될 때까지 정할 수 없습니다.
- 제품을 확장하려면 공식 Appearance 설정을 위한 수동 색상 안내 또는 독립 App Server 클라이언트 가운데 하나를 별도 범위로 선택해야 합니다.
