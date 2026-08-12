# Testing and compatibility

## 선택한 버전

2026-08-12에 npm 레지스트리의 안정 배포 버전과 각 패키지의 호환 범위를 확인했습니다.

| 영역 | 버전 | 선택 근거 |
| --- | --- | --- |
| Electron | 43.4.0 | 당시 `latest` 안정 배포 |
| React / React DOM | 19.2.8 | 당시 `latest` 안정 배포 |
| Vite | 8.2.1 | Node.js 20.19 이상 또는 22.12 이상 지원 |
| TypeScript | 6.0.3 | `typescript-eslint`의 지원 범위인 6.1 미만에서 가장 최신인 6.x |
| Vitest | 4.1.10 | Vite 6, 7, 8을 지원하므로 Vite 8과 호환 |
| Testing Library | React 16.3.2 / user-event 14.6.4 | React 19를 지원하는 안정 버전 |
| ESLint / typescript-eslint | 10.8.1 / 8.67.0 | ESLint 10과 TypeScript 6.0 조합 지원 |
| jsdom | 30.0.1 | UI 테스트 환경. Node.js 24.15 이상 요구 |
| electron-builder | 26.15.3 | Windows x64 NSIS 설치 파일 생성에 사용한 `latest` 안정 배포 |

프로젝트의 Node.js 범위는 현재 개발·검증에 사용한 24 LTS 계열로 제한했습니다. 실제 확인 환경은 Node.js 24.19.0, npm 11.17.0, Git 2.55.0.windows.3입니다.

## 자동 검증

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:smoke
npm.cmd run screenshot
npm.cmd run package:win
```

- `lint`: Electron, React, 공유 타입, 테스트, 스크립트의 정적 규칙을 검사합니다.
- `test`: 5개 테스트 파일의 16개 테스트를 실행합니다.
- `build`: 기존 산출물을 정리하고 TypeScript 검사, Electron 컴파일, Renderer production build를 실행합니다.
- `test:smoke`: 별도 임시 `userData`로 Electron을 두 번 실행합니다. 첫 실행에서 테마 이름과 밝기를 저장하고 두 번째 실행에서 같은 값이 복구되는지 확인합니다.
- `screenshot`: production build 뒤 빈 임시 `userData`로 앱을 숨김 실행하고 공개용 PNG를 생성합니다. 개인 사진과 기존 로컬 설정을 읽지 않습니다.
- `package:win`: `release/`를 안전하게 정리하고 unsigned x64 NSIS 설치 파일을 생성합니다. 이어서 ASAR 허용 목록과 민감정보 패턴을 검사하고 SHA-256 목록을 만든 뒤 임시 폴더에 설치·실행·재실행·제거합니다.

## 테스트가 확인하는 안전 조건

- 원본 사진을 삭제해도 앱 전용 복사본을 읽을 수 있음
- 새 `ThemeStore` 인스턴스에서 사진 참조와 테마 설정을 복구함
- 사진을 포함한 테마 내보내기와 가져오기
- 저장 요청이 겹쳐도 마지막 상태가 남음
- 같은 프로세스 ID에 자동 적용을 두 번 시도하지 않는 상태 전이
- 한 번 실패하면 수동 재시도 전까지 회로 차단 상태 유지
- M1 UI에서 실제 Codex 적용과 자동 적용 버튼이 비활성 상태
- WCAG 대비 계산과 읽기 쉬운 전경색 선택
- 수동 Appearance 가이드가 자동 적용을 주장하지 않는지 확인
- 공개 예시 테마를 실제 가져오기 경로로 불러오기
- UI에서 가이드 복사가 검증된 preload IPC만 사용하는지 확인
- 패키지에 `dist`, `dist-electron`, production 의존성, `package.json`, `LICENSE` 외의 루트가 포함되지 않는지 확인
- TypeScript 원본, source map, 개인 데이터 폴더 이름, Windows 사용자 경로, GitHub 토큰과 비밀 키 패턴이 패키지에 없는지 확인
- 설치된 실행 파일에서도 재실행 뒤 설정이 복구되고 자동 제거가 완료되는지 확인

자동 테스트는 화면의 미적인 완성도나 실제 사진별 가독성까지 판단하지 않습니다. 이 부분은 README의 직접 확인 항목에 따라 앱을 실행해 확인해야 합니다.

## 수동 검증

2026-08-12에 사용자가 README의 직접 확인 항목 1~6을 모두 정상 작동한다고 확인했습니다. 여기에는 원본 사진을 옮긴 뒤의 표시 유지, 실시간 편집 반영, 테마 관리와 가져오기·내보내기, 재실행 뒤 복구, M1 적용 버튼 비활성 상태가 포함됩니다.

M2에서는 공식 문서와 로컬 프로세스의 기본 메타데이터만 읽기 전용으로 확인했습니다. 실제 Codex 테마 적용이나 복원은 테스트하지 않았으며 구현도 추가하지 않았습니다.

M5 자동 검증은 별도 임시 설치 경로에서 성공했습니다. 실제 바탕 화면 바로가기, Windows의 대화형 설치·제거 화면, SmartScreen 표시 상태는 사용자 환경에서 직접 확인해야 합니다. 코드 서명 인증서가 없으므로 게시자 신뢰 확인은 통과했다고 주장하지 않습니다.
