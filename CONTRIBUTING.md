# Contributing to Frostline Studio

Frostline Studio는 안전한 Electron 테마 편집기와 공개적으로 검토할 수 있는 설계 사례를 함께 만드는 프로젝트입니다. 버그 보고, 문서 개선, 접근성 제안, 테스트와 코드 기여를 환영합니다.

## 시작하기

Windows 10 이상과 Node.js 24.15 이상이 필요합니다.

```powershell
git clone https://github.com/gunbread0418/frostline-studio.git
cd frostline-studio
npm.cmd ci
npm.cmd run dev
```

변경 전후에 다음 검증을 실행합니다.

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:smoke
```

`test:smoke`는 실제 Electron을 실행하므로 Windows 데스크톱 세션이 필요합니다. 일반 pull request의 CI에서는 lint, test, build를 실행합니다.

## 기여 흐름

1. 기존 issue를 검색하고 큰 변경은 먼저 제안합니다.
2. 하나의 pull request에는 하나의 목적만 담습니다.
3. 사용자 사진, 토큰, 쿠키, 계정 정보, 로컬 경로를 커밋하지 않습니다.
4. 동작을 바꿨다면 테스트와 관련 문서를 함께 갱신합니다.
5. 커밋은 `feat:`, `fix:`, `docs:`, `test:`, `chore:` 같은 Conventional Commit 형식을 사용합니다.

## 안전 경계

다음 변경은 받지 않습니다.

- Codex 프로세스를 종료하거나 반복 실행하는 코드
- Microsoft Store 패키지나 Codex 설치 파일을 수정하는 코드
- `.codex`, 채팅, 로그인 데이터, 계정 정보를 읽거나 수정하는 코드
- DOM/CSS 주입이나 원격 디버깅으로 공식 Codex 앱을 변경하는 코드
- 실패 뒤 주기적으로 재시도하거나 새 창을 반복 생성하는 코드
- 외부 네트워크 인터페이스에 포트를 여는 코드

Codex 연동 제안은 공식 문서에 공개된 지원 인터페이스와 복원 방법을 함께 제시해야 합니다. 자세한 기준은 [Adapter 개발 지침](docs/adapter-development.md)을 참고하세요.

## UI와 테마 기여

- 한국어 UI를 기본으로 유지합니다.
- 키보드 탐색과 명확한 focus 표시를 유지합니다.
- 색상 변경에는 대비 검사 결과를 포함합니다.
- 예시 사진은 직접 제작했거나 재배포 권한이 명확한 자료만 사용합니다.
- 개인 사진은 `docs/screenshots/private-*` 또는 `.gitignore`에 지정된 로컬 폴더에만 둡니다.

## 도움 요청

사용 방법은 [SUPPORT.md](SUPPORT.md), 보안 문제는 [SECURITY.md](SECURITY.md), 참여 규칙은 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)를 확인하세요.
