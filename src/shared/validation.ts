import {
  CODE_FONT_FAMILIES,
  LEGACY_THEME_FILE_VERSION,
  THEME_FILE_VERSION,
  UI_FONT_FAMILIES,
  upgradeLegacyThemeValues,
  type ActivityLog,
  type ImageAsset,
  type LegacyThemeValues,
  type StudioState,
  type ThemeRecord,
  type ThemeValues,
} from './theme';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const ASSET_ID = /^[0-9a-f-]{36}\.(?:png|jpe?g|webp|bmp)$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isShortString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

export function isManagedAssetId(value: unknown): value is string {
  return typeof value === 'string' && ASSET_ID.test(value);
}

function isImageAsset(value: unknown): value is ImageAsset {
  if (!isRecord(value)) return false;
  return (
    isManagedAssetId(value.assetId) &&
    isShortString(value.originalName, 255) &&
    value.url === `frostline-asset://image/${value.assetId}`
  );
}

export function isThemeValues(value: unknown): value is ThemeValues {
  if (!isRecord(value)) return false;
  return (
    (value.backgroundFit === 'cover' || value.backgroundFit === 'contain') &&
    isFiniteNumberInRange(value.backgroundX, 0, 100) &&
    isFiniteNumberInRange(value.backgroundY, 0, 100) &&
    isFiniteNumberInRange(value.backgroundScale, 50, 200) &&
    isFiniteNumberInRange(value.brightness, 20, 160) &&
    isFiniteNumberInRange(value.saturation, 0, 200) &&
    isFiniteNumberInRange(value.contrast, 50, 180) &&
    isFiniteNumberInRange(value.blur, 0, 24) &&
    HEX_COLOR.test(String(value.overlayColor)) &&
    isFiniteNumberInRange(value.overlayOpacity, 0, 100) &&
    HEX_COLOR.test(String(value.sidebarColor)) &&
    HEX_COLOR.test(String(value.bodyColor)) &&
    HEX_COLOR.test(String(value.inputColor)) &&
    HEX_COLOR.test(String(value.borderColor)) &&
    HEX_COLOR.test(String(value.accentColor)) &&
    HEX_COLOR.test(String(value.foregroundColor)) &&
    HEX_COLOR.test(String(value.mutedForegroundColor)) &&
    HEX_COLOR.test(String(value.inputForegroundColor)) &&
    HEX_COLOR.test(String(value.linkColor)) &&
    HEX_COLOR.test(String(value.selectionColor)) &&
    HEX_COLOR.test(String(value.caretColor)) &&
    (UI_FONT_FAMILIES as readonly string[]).includes(String(value.uiFontFamily)) &&
    (CODE_FONT_FAMILIES as readonly string[]).includes(String(value.codeFontFamily)) &&
    isFiniteNumberInRange(value.fontScale, 80, 125) &&
    isFiniteNumberInRange(value.sidebarOpacity, 0, 100) &&
    isFiniteNumberInRange(value.bodyOpacity, 0, 100) &&
    isFiniteNumberInRange(value.inputOpacity, 0, 100) &&
    isFiniteNumberInRange(value.cardOpacity, 0, 100)
  );
}

function isLegacyThemeValues(value: unknown): value is LegacyThemeValues {
  if (!isRecord(value)) return false;
  return (
    (value.backgroundFit === 'cover' || value.backgroundFit === 'contain') &&
    isFiniteNumberInRange(value.backgroundX, 0, 100) &&
    isFiniteNumberInRange(value.backgroundY, 0, 100) &&
    isFiniteNumberInRange(value.backgroundScale, 50, 200) &&
    isFiniteNumberInRange(value.brightness, 20, 160) &&
    isFiniteNumberInRange(value.saturation, 0, 200) &&
    isFiniteNumberInRange(value.contrast, 50, 180) &&
    isFiniteNumberInRange(value.blur, 0, 24) &&
    HEX_COLOR.test(String(value.overlayColor)) &&
    isFiniteNumberInRange(value.overlayOpacity, 0, 100) &&
    HEX_COLOR.test(String(value.sidebarColor)) &&
    HEX_COLOR.test(String(value.bodyColor)) &&
    HEX_COLOR.test(String(value.inputColor)) &&
    HEX_COLOR.test(String(value.borderColor)) &&
    HEX_COLOR.test(String(value.accentColor))
  );
}

export function isThemeRecord(value: unknown): value is ThemeRecord {
  if (!isRecord(value)) return false;
  return (
    isShortString(value.id, 100) &&
    isShortString(value.name, 80) &&
    (value.image === null || isImageAsset(value.image)) &&
    isThemeValues(value.values) &&
    typeof value.createdAt === 'string' &&
    ISO_DATE.test(value.createdAt) &&
    typeof value.updatedAt === 'string' &&
    ISO_DATE.test(value.updatedAt)
  );
}

function isActivityLog(value: unknown): value is ActivityLog {
  if (!isRecord(value)) return false;
  return (
    isShortString(value.id, 100) &&
    ['info', 'success', 'warning', 'error'].includes(String(value.level)) &&
    isShortString(value.message, 300) &&
    typeof value.createdAt === 'string' &&
    ISO_DATE.test(value.createdAt)
  );
}

export function isStudioState(value: unknown): value is StudioState {
  if (!isRecord(value) || !Array.isArray(value.themes) || !Array.isArray(value.logs)) {
    return false;
  }

  return (
    value.version === THEME_FILE_VERSION &&
    value.themes.length >= 1 &&
    value.themes.length <= 100 &&
    value.themes.every(isThemeRecord) &&
    typeof value.selectedThemeId === 'string' &&
    value.themes.some((theme) => theme.id === value.selectedThemeId) &&
    value.autoApplyEnabled === false &&
    value.logs.length <= 100 &&
    value.logs.every(isActivityLog)
  );
}

export function assertStudioState(value: unknown): asserts value is StudioState {
  if (!isStudioState(value)) {
    throw new Error('저장할 테마 데이터의 형식이 올바르지 않습니다.');
  }
}

export function parseStudioState(value: unknown): StudioState {
  if (isStudioState(value)) return value;
  if (
    !isRecord(value) ||
    value.version !== LEGACY_THEME_FILE_VERSION ||
    !Array.isArray(value.themes) ||
    !Array.isArray(value.logs) ||
    value.themes.length < 1 ||
    value.themes.length > 100 ||
    value.logs.length > 100 ||
    !value.logs.every(isActivityLog) ||
    typeof value.selectedThemeId !== 'string' ||
    value.autoApplyEnabled !== false
  ) {
    throw new Error('저장된 테마 데이터의 형식이 올바르지 않습니다.');
  }

  const themes = value.themes.map(upgradeLegacyThemeRecord);
  if (
    themes.some((theme) => theme === null) ||
    !themes.some((theme) => theme?.id === value.selectedThemeId)
  ) {
    throw new Error('이전 버전 테마 데이터를 안전하게 변환하지 못했습니다.');
  }

  const migrated: StudioState = {
    version: THEME_FILE_VERSION,
    selectedThemeId: value.selectedThemeId,
    themes: themes as ThemeRecord[],
    autoApplyEnabled: false,
    logs: value.logs,
  };
  assertStudioState(migrated);
  return migrated;
}

export function assertThemeRecord(value: unknown): asserts value is ThemeRecord {
  if (!isThemeRecord(value)) {
    throw new Error('테마 데이터의 형식이 올바르지 않습니다.');
  }
}

export function parseThemeRecord(value: unknown): ThemeRecord {
  if (isThemeRecord(value)) return value;
  const migrated = upgradeLegacyThemeRecord(value);
  if (migrated) return migrated;
  throw new Error('테마 데이터의 형식이 올바르지 않습니다.');
}

export function assertAppearanceGuide(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 4096 ||
    value.includes('\0')
  ) {
    throw new Error('복사할 Appearance 가이드의 형식이 올바르지 않습니다.');
  }
}

function upgradeLegacyThemeRecord(value: unknown): ThemeRecord | null {
  if (!isRecord(value) || !isLegacyThemeValues(value.values)) return null;
  const provisional = {
    ...value,
    values: upgradeLegacyThemeValues(value.values),
  };
  return isThemeRecord(provisional) ? provisional : null;
}
