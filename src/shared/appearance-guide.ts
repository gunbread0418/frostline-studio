import { assessThemeContrast, chooseReadableForeground } from './accessibility';
import type { ThemeRecord } from './theme';

export function buildAppearanceGuide(theme: ThemeRecord): string {
  const values = theme.values;
  const foreground = chooseReadableForeground(values.bodyColor);
  const checks = assessThemeContrast(values);

  return [
    'Frostline Studio — Codex Appearance 수동 가이드',
    `테마: ${theme.name}`,
    '',
    '경로: Codex에서 Ctrl+, → Appearance',
    '기본 테마: Dark',
    `강조색: ${values.accentColor.toUpperCase()}`,
    `배경색: ${values.bodyColor.toUpperCase()}`,
    `권장 전경색: ${foreground.toUpperCase()}`,
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
    '사진 배경과 외부 자동 적용은 공식 지원이 확인되지 않아 수행하지 않습니다.',
    'Unofficial project. Not affiliated with or endorsed by OpenAI.',
  ].join('\n');
}
