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
- `test`: 현재 9개 테스트 파일의 단위·UI 테스트 33개를 실행합니다.
- `build`: 기존 산출물을 정리하고 TypeScript 검사, Windows Codex 실행 보조 프로그램 컴파일, Electron 컴파일, Renderer production build를 실행합니다.
- `test:smoke`: 별도 임시 `userData`로 Electron을 두 번 실행합니다. 첫 실행에서 테마 이름과 밝기를 저장하고 두 번째 실행에서 같은 값이 복구되는지 확인합니다.
- `screenshot`: production build 뒤 빈 임시 `userData`로 앱을 숨김 실행하고 공개용 PNG를 생성합니다. 개인 사진과 기존 로컬 설정을 읽지 않습니다.
- `package:win`: `release/`를 안전하게 정리하고 unsigned x64 NSIS 설치 파일을 생성합니다. 이어서 ASAR 허용 목록과 민감정보 패턴을 검사하고 임시 폴더에 설치·실행·재실행·제거한 뒤 최종 파일의 SHA-256 목록을 만듭니다.

## 테스트가 확인하는 안전 조건

- 원본 사진을 삭제해도 앱 전용 복사본을 읽을 수 있음
- 새 `ThemeStore` 인스턴스에서 사진 참조와 테마 설정을 복구함
- 사진을 포함한 테마 내보내기와 가져오기
- 저장 요청이 겹쳐도 마지막 상태가 남음
- 같은 프로세스 ID에 자동 적용을 두 번 시도하지 않는 상태 전이
- 한 번 실패하면 수동 재시도 전까지 회로 차단 상태 유지
- M3 UI에서 수동 적용과 복원만 활성화되고 M4 자동 적용은 비활성 상태
- 실행 중인 Codex를 앱이 닫지 않고 사용자 수동 종료를 요구함
- 수동 종료 뒤 Codex 실행과 CDP 주입이 각각 한 번만 호출됨
- 주입 실패 뒤 자동 재시도하지 않고 사용자의 다음 동작을 기다림
- 주입한 Frostline 스타일만 복원함
- 이미지 디코딩, 자연 크기, DOM 연결과 화면 크기를 확인한 뒤에만 적용 성공으로 판정함
- 채팅 문자열을 읽지 않는 최소 호환성 프로필을 먼저 통과함
- 활성 세션 갱신이 Codex를 추가로 실행하지 않음
- 글자 역할별 WCAG 대비 계산과 읽기 쉬운 전경색·입력 커서 대체색 선택
- BGRA 사진 표본 기반 추천 팔레트와 모드별 표면 불투명도
- v1 로컬 작업 공간을 v2로 원자적으로 변환함
- 수동 Appearance 가이드가 자동 적용을 주장하지 않는지 확인
- 공개 예시 테마를 실제 가져오기 경로로 불러오기
- UI에서 가이드 복사가 검증된 preload IPC만 사용하는지 확인
- 패키지에 `dist`, `dist-electron`, production 의존성, `package.json`, `LICENSE` 외의 루트가 포함되지 않는지 확인
- TypeScript 원본, source map, 개인 데이터 폴더 이름, Windows 사용자 경로, GitHub 토큰과 비밀 키 패턴이 패키지에 없는지 확인
- 설치된 실행 파일에서도 재실행 뒤 설정이 복구되고 자동 제거가 완료되는지 확인

자동 테스트는 화면의 미적인 완성도나 실제 사진별 가독성까지 판단하지 않습니다. 이 부분은 README의 직접 확인 항목에 따라 앱을 실행해 확인해야 합니다.

## 수동 검증

2026-08-12에 사용자가 README의 직접 확인 항목 1~6을 모두 정상 작동한다고 확인했습니다. 여기에는 원본 사진을 옮긴 뒤의 표시 유지, 실시간 편집 반영, 테마 관리와 가져오기·내보내기, 재실행 뒤 복구, M1 적용 버튼 비활성 상태가 포함됩니다.

M2에서는 공식 문서와 로컬 프로세스의 기본 메타데이터만 읽기 전용으로 확인했습니다.

2026-08-13에는 이전 M3 구현을 Windows Store Codex `26.803.10989.0`에 실제 적용하고 복원하는 과정까지 사용자가 확인했습니다. 사진이 표시됐지만 첫 적용 성공 판정이 간헐적으로 실패했고 흰 입력창에서 입력 커서가 보이지 않는 문제를 발견했습니다. 이번 수정은 명시적 이미지 레이어, 입력 역할별 색상, 공통 토큰과 라이브 갱신으로 원인을 보완했으며 새 패키지에서 직접 회귀 검증해야 합니다.

M5 자동 검증은 별도 임시 설치 경로에서 성공했습니다. 실제 바탕 화면 바로가기, Windows의 대화형 설치·제거 화면, SmartScreen 표시 상태는 사용자 환경에서 직접 확인해야 합니다. 코드 서명 인증서가 없으므로 게시자 신뢰 확인은 통과했다고 주장하지 않습니다.

## 2026-08-13 최신 검증 결과

| 명령 | 결과 | 확인 범위 |
| --- | --- | --- |
| `npm.cmd run lint` | 통과 | Electron, Renderer, 공유 타입과 테스트 정적 규칙 |
| `npm.cmd test -- --run` | 9개 파일, 33개 테스트 통과 | 마이그레이션, 추천, UI, M3 적용·갱신·복원 |
| `npm.cmd run build` | 통과 | TypeScript, Windows 보조 프로그램, Electron, Vite production build |
| `npm.cmd run test:smoke` | 통과 | 빈 임시 `userData`의 저장과 Electron 재실행 복구 |
| `npm.cmd run package:win` | 통과 | x64 NSIS, ASAR·비밀정보 검사, 임시 설치·재실행·제거, 체크섬 |
| `npm.cmd run screenshot` | 통과 | 빈 임시 `userData`의 오프스크린 공개 스크린샷 |

설치 파일은 `Frostline-Studio-0.2.0-Setup-x64.exe`이며 최종 패키지 검사 당시 크기는 100,467,342바이트였습니다. 빌드는 코드 서명되지 않았습니다.
