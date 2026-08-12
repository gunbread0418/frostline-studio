import type { FrostlineApi } from '../shared/ipc';

declare global {
  interface Window {
    frostline: FrostlineApi;
  }
}

export {};

