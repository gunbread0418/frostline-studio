import { ensureReadableColor } from './accessibility';
import type { ThemeValues } from './theme';

export interface ResolvedThemeTokens {
  overlay: string;
  sidebarSurface: string;
  bodySurface: string;
  inputSurface: string;
  cardSurface: string;
  border: string;
  accent: string;
  accentForeground: string;
  foreground: string;
  mutedForeground: string;
  inputForeground: string;
  link: string;
  selection: string;
  caret: string;
  uiFontStack: string;
  codeFontStack: string;
  fontScale: number;
}

export function resolveThemeTokens(values: ThemeValues): ResolvedThemeTokens {
  return {
    overlay: colorWithOpacity(values.overlayColor, values.overlayOpacity),
    sidebarSurface: colorWithOpacity(values.sidebarColor, values.sidebarOpacity),
    bodySurface: colorWithOpacity(values.bodyColor, values.bodyOpacity),
    inputSurface: colorWithOpacity(values.inputColor, values.inputOpacity),
    cardSurface: colorWithOpacity(values.bodyColor, values.cardOpacity),
    border: values.borderColor,
    accent: values.accentColor,
    accentForeground: ensureReadableColor('#ffffff', values.accentColor, 4.5),
    foreground: ensureReadableColor(values.foregroundColor, values.bodyColor),
    mutedForeground: ensureReadableColor(values.mutedForegroundColor, values.bodyColor, 3),
    inputForeground: ensureReadableColor(values.inputForegroundColor, values.inputColor),
    link: ensureReadableColor(values.linkColor, values.bodyColor),
    selection: values.selectionColor,
    caret: ensureReadableColor(values.caretColor, values.inputColor, 3),
    uiFontStack: buildFontStack(values.uiFontFamily, ['Segoe UI', 'Arial', 'sans-serif']),
    codeFontStack: buildFontStack(values.codeFontFamily, ['Cascadia Code', 'Consolas', 'monospace']),
    fontScale: values.fontScale / 100,
  };
}

export function colorWithOpacity(color: string, opacityPercent: number): string {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacityPercent / 100})`;
}

function buildFontStack(preferred: string, fallbacks: string[]): string {
  const unique = [preferred, ...fallbacks].filter(
    (value, index, values) => values.indexOf(value) === index,
  );
  return unique
    .map((font) => (font.includes(' ') ? `"${font}"` : font))
    .join(', ');
}
