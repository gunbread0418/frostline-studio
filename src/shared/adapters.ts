import type { ThemeRecord } from './theme';

export type AdapterKind = 'preview' | 'official-codex' | 'app-server-client';

export interface AdapterCapabilities {
  preview: boolean;
  apply: boolean;
  restore: boolean;
  autoApply: boolean;
}

export interface ApplyResult {
  ok: boolean;
  message: string;
  attemptedAt: string;
}

export interface ThemeAdapter {
  readonly kind: AdapterKind;
  readonly capabilities: AdapterCapabilities;
  apply(theme: ThemeRecord, options?: { timeoutMs: number }): Promise<ApplyResult>;
  restore(options?: { timeoutMs: number }): Promise<ApplyResult>;
}

export const OFFICIAL_CODEX_CAPABILITIES: AdapterCapabilities = {
  preview: false,
  apply: false,
  restore: false,
  autoApply: false,
};

/**
 * M0/M1 safety boundary. There is intentionally no implementation that discovers,
 * starts, stops, injects into, or edits the installed Codex application.
 */
export interface OfficialCodexAdapter extends ThemeAdapter {
  readonly kind: 'official-codex';
}

/** Future independent client boundary; no App Server assumptions are made in M0/M1. */
export interface AppServerClientAdapter extends ThemeAdapter {
  readonly kind: 'app-server-client';
}

