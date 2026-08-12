import type { ImageAsset, StudioState, ThemeRecord } from './theme';

export const IPC_CHANNELS = {
  loadState: 'studio:load-state',
  saveState: 'studio:save-state',
  selectImage: 'studio:select-image',
  exportTheme: 'studio:export-theme',
  importTheme: 'studio:import-theme',
  copyAppearanceGuide: 'studio:copy-appearance-guide',
} as const;

export interface SelectImageResult {
  canceled: boolean;
  asset?: ImageAsset;
}

export interface FileOperationResult {
  canceled: boolean;
  fileName?: string;
}

export interface FrostlineApi {
  loadState(): Promise<StudioState>;
  saveState(state: StudioState): Promise<{ savedAt: string }>;
  selectImage(): Promise<SelectImageResult>;
  exportTheme(theme: ThemeRecord): Promise<FileOperationResult>;
  importTheme(): Promise<{ canceled: boolean; theme?: ThemeRecord; fileName?: string }>;
  copyAppearanceGuide(text: string): Promise<{ copiedAt: string }>;
}
