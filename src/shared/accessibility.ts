import type { ThemeValues } from './theme';

export interface ContrastCheck {
  id: 'accent-on-body' | 'accent-on-sidebar';
  label: string;
  foreground: string;
  background: string;
  ratio: number;
  minimum: number;
  passes: boolean;
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function chooseReadableForeground(background: string): '#000000' | '#ffffff' {
  return contrastRatio('#000000', background) >= contrastRatio('#ffffff', background)
    ? '#000000'
    : '#ffffff';
}

export function assessThemeContrast(values: ThemeValues): ContrastCheck[] {
  return [
    createCheck('accent-on-body', '강조색 / 본문', values.accentColor, values.bodyColor),
    createCheck(
      'accent-on-sidebar',
      '강조색 / 사이드바',
      values.accentColor,
      values.sidebarColor,
    ),
  ];
}

function createCheck(
  id: ContrastCheck['id'],
  label: string,
  foreground: string,
  background: string,
): ContrastCheck {
  const minimum = 4.5;
  const ratio = contrastRatio(foreground, background);
  return {
    id,
    label,
    foreground,
    background,
    ratio,
    minimum,
    passes: ratio >= minimum,
  };
}

function relativeLuminance(color: string): number {
  const [red, green, blue] = parseHexColor(color).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function parseHexColor(value: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`지원하지 않는 색상 형식입니다: ${value}`);
  }
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}
