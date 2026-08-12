export const THEME_FILE_VERSION = 1 as const;

export type BackgroundFit = 'cover' | 'contain';

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
}

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
};

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

