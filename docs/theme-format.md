# Frostline theme format

Frostline Studio의 내보내기 파일은 `.frostline-theme.json` 확장자를 사용하는 JSON 문서입니다. 현재 형식 버전은 `1`입니다.

공개 Schema는 [schemas/frostline-theme.schema.json](../schemas/frostline-theme.schema.json), 사진이 없는 예시는 [examples/frostline-midnight.frostline-theme.json](../examples/frostline-midnight.frostline-theme.json)에 있습니다.

## 호환성 규칙

- `format`은 `frostline-theme`, `version`은 `1`이어야 합니다.
- 이름은 1~80자, 색상은 `#RRGGBB` 형식입니다.
- 숫자 범위는 Schema와 런타임 검증 코드가 동일하게 제한합니다.
- 가져온 테마는 새 ID와 시각을 받아 기존 테마를 덮어쓰지 않습니다.
- 알 수 없는 형식이나 범위를 벗어난 값은 저장 전에 거부합니다.

## 이미지와 개인정보

이미지는 사용자가 명시적으로 테마를 내보낼 때만 Base64로 포함됩니다. 공개 저장소나 issue에 테마 파일을 올리기 전 `theme.image`가 `null`인지 확인하세요. 개인 사진이 들어간 내보내기 파일은 공개 예시로 사용하지 않습니다.

## 버전 변경

호환되지 않는 변경에는 새 `version`을 사용하고 ADR과 마이그레이션 경로를 먼저 작성합니다. 기존 버전의 파일을 묵시적으로 다른 구조로 해석하지 않습니다.
