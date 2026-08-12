# Frostline Studio

Frostline Studio는 사용자가 고른 사진과 색상으로 Codex에서 영감을 받은 데스크톱 테마를 디자인하는 Windows용 Electron 앱입니다. 현재 구현 범위는 안전한 독립 미리보기이며, 설치된 Codex 앱에는 접근하지 않습니다.

> **Unofficial project. Not affiliated with or endorsed by OpenAI.**

## 현재 범위

- M0: 저장소, 아키텍처, 안전 경계, 자동 적용 상태 머신
- M1: 로컬 사진 선택, 테마 편집, 실시간 미리보기, 여러 테마 관리, 안전한 로컬 저장, 가져오기와 내보내기
- M2 이후: 공식 지원 여부를 조사한 뒤 별도 승인과 안전성 검증을 거쳐 결정

## 실행 방법

요구 환경은 Windows 10 이상과 Node.js 24 LTS 24.15 이상입니다.

```powershell
npm.cmd install
npm.cmd run dev
```

PowerShell 실행 정책이 `npm.ps1`을 막는 환경에서도 `npm.cmd`는 시스템 정책을 바꾸지 않고 실행할 수 있습니다.

검증 명령은 다음과 같습니다.

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:smoke
```

빌드 뒤 실행하려면 다음 명령을 사용합니다.

```powershell
npm.cmd start
```

`test:smoke`는 실제 Electron을 임시 사용자 데이터 폴더에서 두 번 실행해 main–preload–Renderer 연결과 재실행 뒤 설정 복구를 확인합니다.

## 주요 기능

- 로컬 사진을 앱 전용 데이터 폴더로 복사
- 배경 위치, 배율, `cover`/`contain`, 밝기, 채도, 대비, 블러 조절
- 오버레이, 사이드바, 본문, 입력창, 테두리, 강조색 편집
- 여러 테마 저장, 불러오기, 복제, 삭제
- 사진을 포함한 테마 파일 가져오기와 내보내기
- 앱을 다시 실행해도 선택한 테마와 편집 상태 복구
- 실행 로그와 최근 로컬 작업 결과 표시

## 아키텍처

Renderer는 React로 UI와 미리보기만 담당합니다. 파일 선택과 저장은 `contextIsolation: true`, `nodeIntegration: false`인 Electron 환경에서 preload의 제한된 IPC API를 통해서만 요청합니다.

Codex 연동은 `ThemeAdapter` 경계 뒤로 격리했습니다. M1에서는 `PreviewAdapter`만 사용하며, `OfficialCodexAdapter`와 `AppServerClientAdapter`는 구현하지 않은 계약으로만 존재합니다. 자세한 내용은 [아키텍처 문서](docs/architecture.md)를 참고하세요.

## 안전 설계

- Codex 프로세스, 설치 파일, `.codex`, 로그인·채팅 데이터에 접근하지 않음
- 개인 사진을 저장소가 아니라 Electron `userData` 아래의 앱 전용 폴더에 복사
- Renderer에 Node.js나 임의 파일 시스템 권한을 노출하지 않음
- 설정을 임시 파일에 쓴 뒤 교체해 중간 저장 실패로 인한 손상 가능성을 줄임
- 외부 주소에 네트워크 포트를 열지 않으며 개발 서버도 `127.0.0.1`만 사용

자세한 금지 동작과 향후 적용 단계의 조건은 [안전 문서](docs/safety.md)에 정리되어 있습니다.

## 검증 상태

2026-08-12 기준 Windows 환경에서 lint, TypeScript 검사, 단위·UI 테스트 11개, production build, Electron 재시작 smoke test를 통과했습니다. 선택한 버전과 각 검증의 범위는 [테스트 문서](docs/testing.md)에 기록했습니다.

## 알려진 제한

현재 버전은 미리보기 전용입니다. 실제 Codex 테마 적용, 복원, Windows 자동 시작, 프로세스 시작 이벤트 감지, 설치 파일 생성은 아직 구현하지 않았습니다. 자세한 내용은 [제한 문서](docs/limitations.md)를 참고하세요.

## 스크린샷

M1 화면을 직접 확인한 뒤 공개 가능한 이미지를 `docs/screenshots/`에 추가할 예정입니다. 개인 사진이 들어간 파일은 사용하지 않습니다.

<!-- Screenshot placeholder: docs/screenshots/frostline-studio-m1.png -->

## 앱에서 직접 확인할 항목

1. `사진 선택`으로 공개 가능한 테스트 사진을 고른 뒤 원본 파일을 다른 위치로 옮겨도 미리보기가 유지되는지 확인합니다.
2. `Cover`와 `Contain`, 위치, 크기, 밝기, 채도, 대비, 블러가 바로 반영되는지 확인합니다.
3. 색상 탭의 오버레이와 다섯 표면 색상이 미리보기에 반영되는지 확인합니다.
4. 테마 생성, 이름 변경, 복제, 삭제, 가져오기, 내보내기를 확인합니다.
5. 앱을 닫고 다시 실행했을 때 선택한 테마, 사진, 편집값이 복구되는지 확인합니다.
6. `Codex에 적용`, `복원`, `자동 적용 켜기`, `비상 정지`가 M1에서 비활성 상태인지 확인합니다.

## 라이선스

라이선스는 아직 정하지 않았습니다. 공개 저장소를 만들기 전에 MIT 적용 여부를 사용자에게 확인합니다.
