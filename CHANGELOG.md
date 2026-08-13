# Changelog

이 프로젝트의 중요한 변경 사항을 기록합니다. 형식은 Keep a Changelog의 구성을 참고하고 버전은 Semantic Versioning을 따릅니다.

## [Unreleased]

### Added

- 사용자가 Codex를 직접 정상 종료한 뒤 사진 스킨을 한 번 적용하는 실험적 `OfficialCodexAdapter`
- loopback CDP 대상, 포트 소유자와 Codex 패키지 ID 검증
- Frostline 스타일만 제거하는 수동 복원
- 수동 종료, 단일 시도, 실패 후 무재시도, 복원을 확인하는 테스트
- 테마 파일 v2: 글자 역할별 색상, UI·코드 글꼴, 글자 크기, 표면 불투명도
- 이전 v1 로컬 설정과 내보낸 테마를 v2로 원자적으로 변환하는 마이그레이션
- 사진 평균색을 이용한 세 가지 추천 팔레트와 전체 글자 역할 대비 검사
- 활성 Codex 세션에서 편집값을 바로 반영하고 첫 실패에 잠그는 라이브 갱신
- 적용 실패 단계와 안전한 진단 코드를 실행 로그에 표시하는 진단 결과

### Security

- Windows 실행 보조 프로그램에서 모든 프로세스 종료 기능을 제외
- CDP 주소를 `127.0.0.1`로 제한하고 자동 적용 capability는 비활성 상태로 유지
- Codex 화면의 텍스트를 읽지 않고 루트·윈도 타입·선택자 개수만 확인하는 호환성 프로필 검사

### Fixed

- 첫 주입 직후 스타일 계산이 끝나기 전에 실패로 판정하던 방식을 실제 이미지 디코딩·크기·연결 상태 확인으로 교체
- 어두운 오버레이가 사진뿐 아니라 전체 Codex UI까지 덮던 레이어 순서를 수정하고 주요 표면의 투명도를 조정
- 입력창과 강조색이 같을 때 글자와 글자 커서가 사라지지 않도록 입력창 배경 대비가 높은 흑백 전경색을 자동 선택
- 미리보기와 실제 Codex가 같은 색상·불투명도·글꼴 토큰을 사용하도록 통합

## [0.2.0] - 2026-08-12

### Added

- 현재 사용자 범위에 설치되는 Windows x64 NSIS 설치 파일
- 원본 Frostline Studio 앱 아이콘과 Windows 실행 파일 메타데이터
- 패키지 ASAR 허용 목록, 민감정보 패턴과 개인정보 경로 검사
- SHA-256 체크섬 생성
- 임시 폴더 설치, 설치된 앱 재실행 복구, 제거 자동 테스트
- 수동 실행과 버전 태그에서 unsigned 설치 파일을 만드는 GitHub Actions 워크플로

### Changed

- M5 설치·배포 상태와 코드 서명 제한을 README와 설계 문서에 반영
- 제거 시 사용자 테마와 사진 데이터를 보존하도록 명시

## [0.1.0] - 2026-08-12

### Added

- 로컬 사진 복사와 실시간 테마 미리보기
- 위치, 배율, `cover`/`contain`, 밝기, 채도, 대비, 블러 조절
- 오버레이와 주요 표면·강조색 편집
- 여러 테마의 저장, 복제, 삭제, 가져오기와 내보내기
- 임시 파일과 교체 방식을 사용하는 원자적 설정 저장
- 안전한 preload IPC와 격리된 Adapter 계약
- 자동 적용 안전 상태 머신과 단위 테스트
- 공식 Codex 연동 가능성에 대한 M2 읽기 전용 조사와 ADR
- MIT 라이선스와 오픈소스 기여·보안·거버넌스 문서
- GitHub issue/PR 템플릿과 Windows CI
- 공개 테마 Schema, 사진 없는 예시 테마, 커뮤니티 테마 작성 지침
- 공식 Appearance용 수동 색상 가이드와 접근성 대비 검사
- 재현 가능한 포트폴리오 스크린샷 생성 명령

[Unreleased]: https://github.com/gunbread0418/frostline-studio/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/gunbread0418/frostline-studio/releases/tag/v0.2.0
[0.1.0]: https://github.com/gunbread0418/frostline-studio/releases/tag/v0.1.0
