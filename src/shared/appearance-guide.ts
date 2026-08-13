import { assessThemeContrast } from './accessibility';
import type { ThemeRecord } from './theme';

export function buildAppearanceGuide(theme: ThemeRecord): string {
  const values = theme.values;
  const checks = assessThemeContrast(values);

  return [
    'Frostline Studio — Codex Appearance 수동 가이드',
    `테마: ${theme.name}`,
    '',
    '경로: Codex에서 Ctrl+, → Appearance',
    '기본 테마: Dark',
    `강조색: ${values.accentColor.toUpperCase()}`,
    `배경색: ${values.bodyColor.toUpperCase()}`,
    `전경색: ${values.foregroundColor.toUpperCase()}`,
    `보조 전경색: ${values.mutedForegroundColor.toUpperCase()}`,
    `UI 글꼴: ${values.uiFontFamily}`,
    `코드 글꼴: ${values.codeFontFamily}`,
    '',
    'Frostline 참고 표면',
    `사이드바: ${values.sidebarColor.toUpperCase()}`,
    `입력창: ${values.inputColor.toUpperCase()}`,
    `테두리: ${values.borderColor.toUpperCase()}`,
    '',
    'WCAG AA 일반 텍스트 대비 참고',
    ...checks.map(
      (check) =>
        `${check.label}: ${check.ratio.toFixed(2)}:1 (${check.passes ? '통과' : '검토 필요'})`,
    ),
    '',
    '이 가이드는 값을 수동으로 옮기기 위한 참고 자료입니다.',
    '공식 Appearance에는 사진 배경 항목이 없습니다.',
    'Frostline의 사진 적용은 별도 승인이 필요한 실험적 로컬 런타임 기능이며 공식 기능이 아닙니다.',
    'Unofficial project. Not affiliated with or endorsed by OpenAI.',
  ].join('\n');
}
