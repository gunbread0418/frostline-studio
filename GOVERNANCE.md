# Governance

Frostline Studio는 현재 `gunbread0418`이 primary maintainer로 운영합니다.

## 의사결정

- 작은 수정은 pull request의 코드 검토와 자동 검증으로 결정합니다.
- 파일 형식, 보안 경계, Adapter 구조처럼 호환성에 영향을 주는 변경은 ADR을 먼저 작성합니다.
- 의견이 갈리면 사용자 안전, 공식 지원 여부, 복구 가능성, 유지보수 비용 순서로 판단합니다.
- 최종 결정과 이유는 issue, pull request 또는 ADR에 공개적으로 남깁니다.

## 역할 확장

지속적으로 issue 분류, review, release 관리에 참여한 기여자는 maintainer 역할을 제안받을 수 있습니다. 권한은 필요한 범위부터 단계적으로 부여합니다.

## 릴리스

릴리스는 Semantic Versioning을 따릅니다. 현재 `0.x`에서는 기능과 파일 형식이 바뀔 수 있으며, 호환성 변경은 CHANGELOG와 마이그레이션 문서에 기록합니다.
