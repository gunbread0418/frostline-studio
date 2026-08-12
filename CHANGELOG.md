# Changelog

이 프로젝트의 중요한 변경 사항을 기록합니다. 형식은 Keep a Changelog의 구성을 참고하고 버전은 Semantic Versioning을 따릅니다.

## [Unreleased]

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
