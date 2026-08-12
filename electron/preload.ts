import { contextBridge, ipcRenderer } from 'electron';
import type { FrostlineApi } from '../src/shared/ipc';
import type { StudioState, ThemeRecord } from '../src/shared/theme';

// Keep sandboxed preload runtime imports limited to Electron itself.
const IPC_CHANNELS = {
  loadState: 'studio:load-state',
  saveState: 'studio:save-state',
  selectImage: 'studio:select-image',
  exportTheme: 'studio:export-theme',
  importTheme: 'studio:import-theme',
  copyAppearanceGuide: 'studio:copy-appearance-guide',
} as const;

const api: FrostlineApi = Object.freeze({
  loadState: () => ipcRenderer.invoke(IPC_CHANNELS.loadState),
  saveState: (state: StudioState) => ipcRenderer.invoke(IPC_CHANNELS.saveState, state),
  selectImage: () => ipcRenderer.invoke(IPC_CHANNELS.selectImage),
  exportTheme: (theme: ThemeRecord) => ipcRenderer.invoke(IPC_CHANNELS.exportTheme, theme),
  importTheme: () => ipcRenderer.invoke(IPC_CHANNELS.importTheme),
  copyAppearanceGuide: (text: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.copyAppearanceGuide, text),
});

contextBridge.exposeInMainWorld('frostline', api);
