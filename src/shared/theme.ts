export const THEME_FILE_VERSION = 2 as const;
export const LEGACY_THEME_FILE_VERSION = 1 as const;

export type BackgroundFit = 'cover' | 'contain';

export const UI_FONT_FAMILIES = ['Segoe UI', 'Arial', 'Georgia'] as const;
export const CODE_FONT_FAMILIES = ['Cascadia Code', 'Consolas', 'Courier New'] as const;

export type UiFontFamily = (typeof UI_FONT_FAMILIES)[number];
export type CodeFontFamily = (typeof CODE_FONT_FAMILIES)[number];

export interface ImageAsset {
  assetId: string;
  originalName: string;
  url: string;
}

export interface ThemeValues {
  backgroundFit: BackgroundFit;
  backgroundX: number;
  backgroundY: number;
  backgroundScale: number;
  brightness: number;
  saturation: number;
  contrast: number;
  blur: number;
  overlayColor: string;
  overlayOpacity: number;
  sidebarColor: string;
  bodyColor: string;
  inputColor: string;
  borderColor: string;
  accentColor: string;
  foregroundColor: string;
  mutedForegroundColor: string;
  inputForegroundColor: string;
  linkColor: string;
  selectionColor: string;
  caretColor: string;
  uiFontFamily: UiFontFamily;
  codeFontFamily: CodeFontFamily;
  fontScale: number;
  sidebarOpacity: number;
  bodyOpacity: number;
  inputOpacity: number;
  cardOpacity: number;
}

export type LegacyThemeValues = Omit<
  ThemeValues,
  | 'foregroundColor'
  | 'mutedForegroundColor'
  | 'inputForegroundColor'
  | 'linkColor'
  | 'selectionColor'
  | 'caretColor'
  | 'uiFontFamily'
  | 'codeFontFamily'
  | 'fontScale'
  | 'sidebarOpacity'
  | 'bodyOpacity'
  | 'inputOpacity'
  | 'cardOpacity'
>;

export interface ThemeRecord {
  id: string;
  name: string;
  image: ImageAsset | null;
  values: ThemeValues;
  createdAt: string;
  updatedAt: string;
}

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface ActivityLog {
  id: string;
  level: LogLevel;
  message: string;
  createdAt: string;
}

export interface StudioState {
  version: typeof THEME_FILE_VERSION;
  selectedThemeId: string;
  themes: ThemeRecord[];
  autoApplyEnabled: false;
  logs: ActivityLog[];
}

export interface ThemeExportDocument {
  format: 'frostline-theme';
  version: typeof THEME_FILE_VERSION;
  exportedAt: string;
  theme: Omit<ThemeRecord, 'image'> & {
    image: null | {
      originalName: string;
      mimeType: string;
      dataBase64: string;
    };
  };
}

export const DEFAULT_THEME_VALUES: ThemeValues = {
  backgroundFit: 'cover',
  backgroundX: 50,
  backgroundY: 50,
  backgroundScale: 100,
  brightness: 72,
  saturation: 78,
  contrast: 108,
  blur: 0,
  overlayColor: '#080b12',
  overlayOpacity: 54,
  sidebarColor: '#111722',
  bodyColor: '#0d1119',
  inputColor: '#171e2a',
  borderColor: '#2b3545',
  accentColor: '#9ee7d5',
  foregroundColor: '#f3f7f6',
  mutedForegroundColor: '#aebbb8',
  inputForegroundColor: '#f3f7f6',
  linkColor: '#9ee7d5',
  selectionColor: '#315e58',
  caretColor: '#9ee7d5',
  uiFontFamily: 'Segoe UI',
  codeFontFamily: 'Cascadia Code',
  fontScale: 100,
  sidebarOpacity: 78,
  bodyOpacity: 38,
  inputOpacity: 88,
  cardOpacity: 76,
};

export function upgradeLegacyThemeValues(values: LegacyThemeValues): ThemeValues {
  const foregroundColor = chooseForeground(values.bodyColor);
  const inputForegroundColor = chooseForeground(values.inputColor);
  return {
    ...values,
    foregroundColor,
    mutedForegroundColor: mixHex(foregroundColor, values.bodyColor, 0.34),
    inputForegroundColor,
    linkColor: hasReadableContrast(values.accentColor, values.bodyColor)
      ? values.accentColor
      : foregroundColor,
    selectionColor: values.accentColor,
    caretColor: inputForegroundColor,
    uiFontFamily: DEFAULT_THEME_VALUES.uiFontFamily,
    codeFontFamily: DEFAULT_THEME_VALUES.codeFontFamily,
    fontScale: DEFAULT_THEME_VALUES.fontScale,
    sidebarOpacity: DEFAULT_THEME_VALUES.sidebarOpacity,
    bodyOpacity: DEFAULT_THEME_VALUES.bodyOpacity,
    inputOpacity: DEFAULT_THEME_VALUES.inputOpacity,
    cardOpacity: DEFAULT_THEME_VALUES.cardOpacity,
  };
}

export function createDefaultTheme(id = crypto.randomUUID()): ThemeRecord {
  const now = new Date().toISOString();
  return {
    id,
    name: '새 테마',
    image: null,
    values: { ...DEFAULT_THEME_VALUES },
    createdAt: now,
    updatedAt: now,
  };
}

function chooseForeground(background: string): '#000000' | '#ffffff' {
  return contrastRatio('#000000', background) >= contrastRatio('#ffffff', background)
    ? '#000000'
    : '#ffffff';
}

function hasReadableContrast(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) >= 4.5;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16));
  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function mixHex(foreground: string, background: string, backgroundWeight: number): string {
  const channels = [1, 3, 5].map((start) => {
    const foregroundChannel = Number.parseInt(foreground.slice(start, start + 2), 16);
    const backgroundChannel = Number.parseInt(background.slice(start, start + 2), 16);
    return Math.round(
      foregroundChannel * (1 - backgroundWeight) + backgroundChannel * backgroundWeight,
    )
      .toString(16)
      .padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

export function createInitialState(): StudioState {
  const theme = createDefaultTheme();
  return {
    version: THEME_FILE_VERSION,
    selectedThemeId: theme.id,
    themes: [theme],
    autoApplyEnabled: false,
    logs: [],
  };
}
