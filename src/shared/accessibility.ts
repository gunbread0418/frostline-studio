import type { ThemeValues } from './theme';

export interface ContrastCheck {
  id:
    | 'foreground-on-body'
    | 'muted-on-body'
    | 'input-foreground-on-input'
    | 'link-on-body'
    | 'caret-on-input';
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

export function ensureReadableColor(
  preferred: string,
  background: string,
  minimum = 4.5,
): string {
  if (contrastRatio(preferred, background) >= minimum) return preferred;
  return chooseReadableForeground(background);
}

export function assessThemeContrast(values: ThemeValues): ContrastCheck[] {
  return [
    createCheck('foreground-on-body', '본문 글자 / 본문', values.foregroundColor, values.bodyColor),
    createCheck('muted-on-body', '보조 글자 / 본문', values.mutedForegroundColor, values.bodyColor, 3),
    createCheck(
      'input-foreground-on-input',
      '입력 글자 / 입력창',
      values.inputForegroundColor,
      values.inputColor,
    ),
    createCheck('link-on-body', '링크 / 본문', values.linkColor, values.bodyColor),
    createCheck('caret-on-input', '입력 커서 / 입력창', values.caretColor, values.inputColor, 3),
  ];
}

function createCheck(
  id: ContrastCheck['id'],
  label: string,
  foreground: string,
  background: string,
  minimum = 4.5,
): ContrastCheck {
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
