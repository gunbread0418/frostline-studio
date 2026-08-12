# Frostline Studio

[![CI](https://github.com/gunbread0418/frostline-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/gunbread0418/frostline-studio/actions/workflows/ci.yml)
[![Package Windows](https://github.com/gunbread0418/frostline-studio/actions/workflows/package-windows.yml/badge.svg)](https://github.com/gunbread0418/frostline-studio/actions/workflows/package-windows.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-9ee7d5.svg)](LICENSE)

Frostline Studio는 사용자가 고른 사진과 색상으로 Codex에서 영감을 받은 데스크톱 테마를 디자인하는 Windows용 Electron 앱입니다. 현재 구현 범위는 안전한 독립 미리보기이며, 설치된 Codex 앱에는 접근하지 않습니다.

> **Unofficial project. Not affiliated with or endorsed by OpenAI.**

## 현재 범위

- M0: 저장소, 아키텍처, 안전 경계, 자동 적용 상태 머신
- M1: 로컬 사진 선택, 테마 편집, 실시간 미리보기, 여러 테마 관리, 안전한 로컬 저장, 가져오기와 내보내기
- M2: 공식 문서와 로컬 설치 상태를 읽기 전용으로 조사하고 연동 경계를 결정
- M5: Windows x64 설치 파일, 설치·재실행·제거 검사, SHA-256 체크섬, 공개 빌드 워크플로
- M3 이후: 공식적으로 지원되는 외부 적용 수단이 확인되고 사용자가 별도로 승인한 경우에만 진행

## Windows 설치

[GitHub Releases](https://github.com/gunbread0418/frostline-studio/releases)에서 최신 `Frostline-Studio-<version>-Setup-x64.exe`를 내려받아 실행합니다. 현재 설치 파일은 코드 서명 인증서로 서명되지 않았으므로 Windows SmartScreen이 게시자를 확인할 수 없다는 경고를 표시할 수 있습니다. 릴리스의 `SHA256SUMS.txt`로 다운로드한 파일의 SHA-256 값을 확인할 수 있습니다.

설치 프로그램은 현재 Windows 사용자에게만 설치되며 관리자 권한을 요구하지 않습니다. 제거할 때는 예상치 못한 사진·테마 손실을 막기 위해 앱 전용 데이터가 자동으로 삭제되지 않습니다.

## 개발 실행

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
npm.cmd run package:win
```

빌드 뒤 실행하려면 다음 명령을 사용합니다.

```powershell
npm.cmd start
```

`test:smoke`는 실제 Electron을 임시 사용자 데이터 폴더에서 두 번 실행해 main–preload–Renderer 연결과 재실행 뒤 설정 복구를 확인합니다. `package:win`은 x64 NSIS 설치 파일을 만든 뒤 내부 허용 목록과 개인정보 패턴, 임시 설치·재실행·제거를 검사하고 마지막에 SHA-256 체크섬을 생성합니다.

## 주요 기능

- 로컬 사진을 앱 전용 데이터 폴더로 복사
- 배경 위치, 배율, `cover`/`contain`, 밝기, 채도, 대비, 블러 조절
- 오버레이, 사이드바, 본문, 입력창, 테두리, 강조색 편집
- 여러 테마 저장, 불러오기, 복제, 삭제
- 사진을 포함한 테마 파일 가져오기와 내보내기
- 앱을 다시 실행해도 선택한 테마와 편집 상태 복구
- 실행 로그와 최근 로컬 작업 결과 표시
- 공개 JSON Schema와 사진 없는 예시 테마
- 공식 Codex `Appearance`에 수동으로 옮길 색상 가이드 복사
- 강조색과 주요 배경 사이의 WCAG AA 대비 참고 검사

## 아키텍처

Renderer는 React로 UI와 미리보기만 담당합니다. 파일 선택과 저장은 `contextIsolation: true`, `nodeIntegration: false`인 Electron 환경에서 preload의 제한된 IPC API를 통해서만 요청합니다.

Codex 연동은 `ThemeAdapter` 경계 뒤로 격리했습니다. 현재는 `PreviewAdapter`만 사용합니다. M2 조사 결과 공식 Codex 앱은 자체 색상 테마를 지원하지만 외부 프로그램이 사진 배경이나 테마를 적용하는 공식 API는 확인되지 않았으므로 `OfficialCodexAdapter`는 비활성 계약으로 유지합니다. `AppServerClientAdapter`는 향후 독립 클라이언트를 검토할 때 사용할 경계입니다. 자세한 내용은 [아키텍처 문서](docs/architecture.md)와 [M2 조사 결과](docs/integration-research.md)를 참고하세요.

## 안전 설계

- Codex 프로세스, 설치 파일, `.codex`, 로그인·채팅 데이터에 접근하지 않음
- 개인 사진을 저장소가 아니라 Electron `userData` 아래의 앱 전용 폴더에 복사
- Renderer에 Node.js나 임의 파일 시스템 권한을 노출하지 않음
- 설정을 임시 파일에 쓴 뒤 교체해 중간 저장 실패로 인한 손상 가능성을 줄임
- 외부 주소에 네트워크 포트를 열지 않으며 개발 서버도 `127.0.0.1`만 사용

자세한 금지 동작과 향후 적용 단계의 조건은 [안전 문서](docs/safety.md)에 정리되어 있습니다.

## 검증 상태

2026-08-12 기준 Windows 환경에서 lint, TypeScript 검사, 단위·UI 테스트 16개, production build, Electron 재시작 smoke test를 통과했습니다. M5에서는 unsigned x64 NSIS 설치 파일 생성과 패키지 내부 검사, SHA-256 생성, 임시 설치·재실행·제거 테스트를 통과했습니다. 사용자가 아래 직접 확인 항목 1~6도 모두 정상 작동한다고 확인했습니다. 선택한 버전과 각 검증의 범위는 [테스트 문서](docs/testing.md)에 기록했습니다.

## 알려진 제한

현재 버전은 미리보기 전용입니다. 공식 Codex 앱의 내장 `Settings → Appearance`에서는 색상과 글꼴을 직접 바꿀 수 있지만, 사진 배경이나 외부 자동 적용은 공식 지원을 확인하지 못했습니다. 실제 Codex 테마 적용, 복원, Windows 자동 시작과 프로세스 시작 이벤트 감지는 구현하지 않았습니다. Windows 설치 파일은 제공하지만 아직 코드 서명이 없어 SmartScreen 평판 경고가 나타날 수 있습니다. 자세한 내용은 [제한 문서](docs/limitations.md)와 [ADR-0001](docs/adr/0001-codex-integration-boundary.md)을 참고하세요.

## 스크린샷

아래 이미지는 빈 임시 사용자 데이터와 프로젝트가 직접 만든 기본 테마로 생성했습니다. 개인 사진과 로컬 설정은 포함하지 않습니다.

![Frostline Studio preview](docs/screenshots/frostline-studio-preview.png)

같은 조건으로 다시 만들려면 다음 명령을 사용합니다.

```powershell
npm.cmd run screenshot
```

## 앱에서 직접 확인할 항목

1. `사진 선택`으로 공개 가능한 테스트 사진을 고른 뒤 원본 파일을 다른 위치로 옮겨도 미리보기가 유지되는지 확인합니다.
2. `Cover`와 `Contain`, 위치, 크기, 밝기, 채도, 대비, 블러가 바로 반영되는지 확인합니다.
3. 색상 탭의 오버레이와 다섯 표면 색상이 미리보기에 반영되는지 확인합니다.
4. 테마 생성, 이름 변경, 복제, 삭제, 가져오기, 내보내기를 확인합니다.
5. 앱을 닫고 다시 실행했을 때 선택한 테마, 사진, 편집값이 복구되는지 확인합니다.
6. `Codex에 적용`, `복원`, `자동 적용 켜기`, `비상 정지`가 M1에서 비활성 상태인지 확인합니다.
7. GitHub Release의 설치 파일로 현재 사용자 범위에 설치되는지 확인합니다.
8. 설치된 바로가기에서 앱이 실행되고 기존 테마 편집 기능이 같은 방식으로 동작하는지 확인합니다.
9. 제거 프로그램이 앱 본체와 바로가기를 제거하는지 확인합니다.
10. 제거 뒤 다시 설치했을 때 기존 테마가 보존되는지 확인합니다. 개인 데이터를 지우려는 경우에는 앱 전용 데이터 폴더를 사용자가 별도로 삭제해야 합니다.

사용자 확인 결과: 2026-08-12에 1~6번 모두 정상 작동했습니다. 7~10번은 자동 설치 테스트를 통과했으며 실제 Windows 바탕 화면과 제거 UI를 사용하는 수동 확인이 남아 있습니다.

## 오픈소스 참여

버그 보고와 기능 제안은 GitHub issue 양식을 사용합니다. 코드 변경 전에는 [기여 지침](CONTRIBUTING.md), 보안 문제는 [보안 정책](SECURITY.md), 참여 규칙은 [행동 규범](CODE_OF_CONDUCT.md)을 확인하세요. 테마 파일 형식은 [공개 Schema](schemas/frostline-theme.schema.json)와 [작성 지침](docs/theme-format.md)에 정리되어 있습니다.

현재 계획과 완료 조건은 [ROADMAP.md](ROADMAP.md), 버전별 변경은 [CHANGELOG.md](CHANGELOG.md)에서 확인할 수 있습니다.

## 라이선스

소스 코드는 [MIT License](LICENSE)로 배포합니다. 외부 라이브러리와 사용자가 선택한 사진은 각각의 권리와 라이선스를 따릅니다. MIT 라이선스는 OpenAI 또는 Codex 상표 사용 권리를 부여하지 않습니다.
