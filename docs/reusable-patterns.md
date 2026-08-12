# Reusable safety patterns

Frostline Studio의 일부 구조는 다른 Electron 프로젝트에서도 참고할 수 있습니다.

## 제한된 preload IPC

Renderer에 Node.js 객체를 직접 노출하지 않고 `window.frostline` 아래의 작은 API만 제공합니다. main 프로세스는 IPC 요청마다 발신 URL과 입력 구조를 다시 검증합니다.

관련 파일:

- `electron/preload.ts`
- `electron/main.ts`
- `src/shared/ipc.ts`
- `src/shared/validation.ts`

## 원자적 JSON 저장

설정을 목적 파일에 바로 쓰지 않습니다. 같은 폴더에 임시 파일을 만들고 내용을 동기화한 뒤 목적 파일로 교체합니다. 원자적 저장은 중간 실패가 발생해도 완성되지 않은 JSON이 기존 파일을 덮어쓸 가능성을 줄이는 방식입니다.

관련 파일:

- `electron/theme-store.ts`
- `electron/theme-store.test.ts`

## 순수 상태 머신

자동 적용 정책은 운영체제 이벤트와 분리된 순수 함수로 정의되어 있습니다. 같은 PID를 한 번만 처리하고 첫 실패 뒤 회로 차단 상태로 이동하는 규칙을 실제 프로세스 없이 테스트할 수 있습니다.

관련 파일:

- `src/shared/auto-apply-machine.ts`
- `src/shared/auto-apply-machine.test.ts`

이 문서는 구조를 설명할 뿐 Codex 자동 적용 기능을 제공하거나 승인하지 않습니다.
