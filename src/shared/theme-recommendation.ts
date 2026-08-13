import type { ThemeValues } from './theme';

export type ThemeRecommendationMode = 'photo' | 'balanced' | 'contrast';

export interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

export interface ThemeRecommendation {
  mode: ThemeRecommendationMode;
  averageColor: string;
  luminance: number;
  values: Partial<ThemeValues>;
}

const MODE_SETTINGS: Record<
  ThemeRecommendationMode,
  Pick<ThemeValues, 'overlayOpacity' | 'sidebarOpacity' | 'bodyOpacity' | 'inputOpacity' | 'cardOpacity'>
> = {
  photo: {
    overlayOpacity: 18,
    sidebarOpacity: 56,
    bodyOpacity: 22,
    inputOpacity: 78,
    cardOpacity: 62,
  },
  balanced: {
    overlayOpacity: 32,
    sidebarOpacity: 72,
    bodyOpacity: 42,
    inputOpacity: 88,
    cardOpacity: 78,
  },
  contrast: {
    overlayOpacity: 50,
    sidebarOpacity: 86,
    bodyOpacity: 64,
    inputOpacity: 95,
    cardOpacity: 90,
  },
};

export function averageBgraPixels(pixels: Uint8Array): RgbColor {
  if (pixels.byteLength < 4 || pixels.byteLength % 4 !== 0) {
    throw new Error('사진 색상 표본의 형식이 올바르지 않습니다.');
  }
  let red = 0;
  let green = 0;
  let blue = 0;
  let totalWeight = 0;
  for (let index = 0; index < pixels.byteLength; index += 4) {
    const alpha = pixels[index + 3] / 255;
    if (alpha < 0.1) continue;
    blue += pixels[index] * alpha;
    green += pixels[index + 1] * alpha;
    red += pixels[index + 2] * alpha;
    totalWeight += alpha;
  }
  if (totalWeight === 0) {
    throw new Error('사진에서 분석할 수 있는 불투명 픽셀을 찾지 못했습니다.');
  }
  return {
    red: Math.round(red / totalWeight),
    green: Math.round(green / totalWeight),
    blue: Math.round(blue / totalWeight),
  };
}

export function recommendThemeFromAverageColor(
  average: RgbColor,
  mode: ThemeRecommendationMode,
): ThemeRecommendation {
  const body = mix(average, { red: 0, green: 0, blue: 0 }, 0.78);
  const sidebar = mix(average, { red: 0, green: 0, blue: 0 }, 0.69);
  const input = mix(average, { red: 0, green: 0, blue: 0 }, 0.6);
  const accent = mix(average, { red: 255, green: 255, blue: 255 }, 0.5);
  const border = mix(average, { red: 255, green: 255, blue: 255 }, 0.26);
  const foreground = { red: 250, green: 252, blue: 252 };
  const muted = mix(foreground, body, 0.42);
  const averageColor = toHex(average);

  return {
    mode,
    averageColor,
    luminance: relativeLuminance(average),
    values: {
      ...MODE_SETTINGS[mode],
      overlayColor: toHex(mix(average, { red: 0, green: 0, blue: 0 }, 0.7)),
      sidebarColor: toHex(sidebar),
      bodyColor: toHex(body),
      inputColor: toHex(input),
      borderColor: toHex(border),
      accentColor: toHex(accent),
      foregroundColor: toHex(foreground),
      mutedForegroundColor: toHex(muted),
      inputForegroundColor: toHex(foreground),
      linkColor: toHex(accent),
      selectionColor: toHex(accent),
      caretColor: toHex(foreground),
    },
  };
}

function mix(first: RgbColor, second: RgbColor, secondWeight: number): RgbColor {
  return {
    red: Math.round(first.red * (1 - secondWeight) + second.red * secondWeight),
    green: Math.round(first.green * (1 - secondWeight) + second.green * secondWeight),
    blue: Math.round(first.blue * (1 - secondWeight) + second.blue * secondWeight),
  };
}

function toHex(color: RgbColor): string {
  return `#${[color.red, color.green, color.blue]
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0'))
    .join('')}`;
}

function relativeLuminance(color: RgbColor): number {
  const [red, green, blue] = [color.red, color.green, color.blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
