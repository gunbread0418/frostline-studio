import type { ImageAsset, StudioState, ThemeRecord } from './theme';
import type { ApplyResult } from './adapters';
import type { ThemeRecommendation, ThemeRecommendationMode } from './theme-recommendation';

export const IPC_CHANNELS = {
  loadState: 'studio:load-state',
  saveState: 'studio:save-state',
  selectImage: 'studio:select-image',
  exportTheme: 'studio:export-theme',
  importTheme: 'studio:import-theme',
  copyAppearanceGuide: 'studio:copy-appearance-guide',
  recommendThemePalette: 'studio:recommend-theme-palette',
  getOfficialCodexStatus: 'studio:get-official-codex-status',
  applyOfficialCodexTheme: 'studio:apply-official-codex-theme',
  updateOfficialCodexTheme: 'studio:update-official-codex-theme',
  restoreOfficialCodexTheme: 'studio:restore-official-codex-theme',
} as const;

export interface SelectImageResult {
  canceled: boolean;
  asset?: ImageAsset;
}

export interface FileOperationResult {
  canceled: boolean;
  fileName?: string;
}

export interface OfficialCodexStatus {
  available: boolean;
  canRestore: boolean;
  requiresCodexExit: boolean;
  phase: 'ready' | 'waiting-for-exit' | 'armed' | 'active' | 'unavailable';
  experimental: true;
  message: string;
}

export interface FrostlineApi {
  loadState(): Promise<StudioState>;
  saveState(state: StudioState): Promise<{ savedAt: string }>;
  selectImage(): Promise<SelectImageResult>;
  exportTheme(theme: ThemeRecord): Promise<FileOperationResult>;
  importTheme(): Promise<{ canceled: boolean; theme?: ThemeRecord; fileName?: string }>;
  copyAppearanceGuide(text: string): Promise<{ copiedAt: string }>;
  recommendThemePalette(
    theme: ThemeRecord,
    mode: ThemeRecommendationMode,
  ): Promise<ThemeRecommendation>;
  getOfficialCodexStatus(): Promise<OfficialCodexStatus>;
  applyOfficialCodexTheme(theme: ThemeRecord): Promise<ApplyResult>;
  updateOfficialCodexTheme(theme: ThemeRecord): Promise<ApplyResult>;
  restoreOfficialCodexTheme(): Promise<ApplyResult>;
}
