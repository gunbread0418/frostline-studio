import { contextBridge, ipcRenderer } from 'electron';
import type { FrostlineApi } from '../src/shared/ipc';
import type { StudioState, ThemeRecord } from '../src/shared/theme';
import type { ThemeRecommendationMode } from '../src/shared/theme-recommendation';

// Keep sandboxed preload runtime imports limited to Electron itself.
const IPC_CHANNELS = {
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

const api: FrostlineApi = Object.freeze({
  loadState: () => ipcRenderer.invoke(IPC_CHANNELS.loadState),
  saveState: (state: StudioState) => ipcRenderer.invoke(IPC_CHANNELS.saveState, state),
  selectImage: () => ipcRenderer.invoke(IPC_CHANNELS.selectImage),
  exportTheme: (theme: ThemeRecord) => ipcRenderer.invoke(IPC_CHANNELS.exportTheme, theme),
  importTheme: () => ipcRenderer.invoke(IPC_CHANNELS.importTheme),
  copyAppearanceGuide: (text: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.copyAppearanceGuide, text),
  recommendThemePalette: (theme: ThemeRecord, mode: ThemeRecommendationMode) =>
    ipcRenderer.invoke(IPC_CHANNELS.recommendThemePalette, theme, mode),
  getOfficialCodexStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getOfficialCodexStatus),
  applyOfficialCodexTheme: (theme: ThemeRecord) =>
    ipcRenderer.invoke(IPC_CHANNELS.applyOfficialCodexTheme, theme),
  updateOfficialCodexTheme: (theme: ThemeRecord) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateOfficialCodexTheme, theme),
  restoreOfficialCodexTheme: () =>
    ipcRenderer.invoke(IPC_CHANNELS.restoreOfficialCodexTheme),
});

contextBridge.exposeInMainWorld('frostline', api);
