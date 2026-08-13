# Frostline theme format

Frostline Studio의 내보내기 파일은 `.frostline-theme.json` 확장자를 사용하는 JSON 문서입니다. 현재 형식 버전은 `2`입니다.

공개 Schema는 [schemas/frostline-theme.schema.json](../schemas/frostline-theme.schema.json), 사진이 없는 예시는 [examples/frostline-midnight.frostline-theme.json](../examples/frostline-midnight.frostline-theme.json)에 있습니다.

## 호환성 규칙

- 새 내보내기 파일은 `format: frostline-theme`, `version: 2`를 사용합니다.
- 기존 `version: 1` 파일과 로컬 작업 공간은 가져오거나 열 때 v2 기본 글자·글꼴·표면 값을 채운 뒤 원자적으로 변환합니다.
- 이름은 1~80자, 색상은 `#RRGGBB` 형식입니다.
- UI·코드 글꼴은 앱의 허용 목록에 있는 Windows 기본 글꼴만 사용할 수 있습니다.
- 숫자 범위는 Schema와 런타임 검증 코드가 동일하게 제한합니다.
- 가져온 테마는 새 ID와 시각을 받아 기존 테마를 덮어쓰지 않습니다.
- 알 수 없는 형식이나 범위를 벗어난 값은 저장 전에 거부합니다.

## 이미지와 개인정보

이미지는 사용자가 명시적으로 테마를 내보낼 때만 Base64로 포함됩니다. 공개 저장소나 issue에 테마 파일을 올리기 전 `theme.image`가 `null`인지 확인하세요. 개인 사진이 들어간 내보내기 파일은 공개 예시로 사용하지 않습니다.

## 버전 변경

호환되지 않는 변경에는 새 `version`을 사용하고 명시적인 마이그레이션 경로를 함께 제공합니다. v1→v2 변환은 새 글자 역할, 글꼴과 표면 불투명도에 안전한 기본값을 채우며 원래 테마와 사진을 덮어쓰지 않습니다.
