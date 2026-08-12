import { describe, expect, it } from 'vitest';
import { assessThemeContrast, chooseReadableForeground, contrastRatio } from './accessibility';
import { buildAppearanceGuide } from './appearance-guide';
import { createDefaultTheme, DEFAULT_THEME_VALUES } from './theme';

describe('theme accessibility helpers', () => {
  it('calculates WCAG contrast ratios and readable foregrounds', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(chooseReadableForeground('#0d1119')).toBe('#ffffff');
    expect(chooseReadableForeground('#f8fafc')).toBe('#000000');
  });

  it('marks the default accent contrast as passing', () => {
    const checks = assessThemeContrast(DEFAULT_THEME_VALUES);
    expect(checks).toHaveLength(2);
    expect(checks.every((check) => check.passes)).toBe(true);
  });

  it('builds a manual guide without claiming automatic application', () => {
    const theme = createDefaultTheme('00000000-0000-4000-8000-000000000001');
    theme.name = '오픈소스 예시';
    const guide = buildAppearanceGuide(theme);

    expect(guide).toContain('오픈소스 예시');
    expect(guide).toContain(DEFAULT_THEME_VALUES.accentColor.toUpperCase());
    expect(guide).toContain('Ctrl+, → Appearance');
    expect(guide).toContain('외부 자동 적용은 공식 지원이 확인되지 않아 수행하지 않습니다.');
  });
});
