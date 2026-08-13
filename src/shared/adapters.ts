import type { ThemeRecord } from './theme';

export type AdapterKind = 'preview' | 'official-codex' | 'app-server-client';

export interface AdapterCapabilities {
  preview: boolean;
  apply: boolean;
  restore: boolean;
  liveUpdate: boolean;
  autoApply: boolean;
}

export type ApplyStage =
  | 'inspect'
  | 'waiting-for-exit'
  | 'launch'
  | 'port-owner'
  | 'target-discovery'
  | 'compatibility'
  | 'image-compile'
  | 'style-install'
  | 'image-decode'
  | 'visibility-check'
  | 'complete'
  | 'live-update'
  | 'restore';

export interface ApplyResult {
  ok: boolean;
  message: string;
  attemptedAt: string;
  canRestore?: boolean;
  requiresCodexExit?: boolean;
  phase?: 'ready' | 'waiting-for-exit' | 'armed' | 'active';
  stage?: ApplyStage;
  diagnosticCode?: string;
}

export interface ThemeAdapter {
  readonly kind: AdapterKind;
  readonly capabilities: AdapterCapabilities;
  apply(theme: ThemeRecord, options?: { timeoutMs: number }): Promise<ApplyResult>;
  update?(theme: ThemeRecord, options?: { timeoutMs: number }): Promise<ApplyResult>;
  restore(options?: { timeoutMs: number }): Promise<ApplyResult>;
}

export const OFFICIAL_CODEX_CAPABILITIES: AdapterCapabilities = {
  preview: false,
  apply: true,
  restore: true,
  liveUpdate: true,
  autoApply: false,
};

/**
 * M3 experimental boundary. The adapter may inject a local image and CSS into one
 * verified Codex renderer over a loopback-only CDP session. It must not modify the
 * installed package, force-stop Codex, or retry automatically.
 */
export interface OfficialCodexAdapter extends ThemeAdapter {
  readonly kind: 'official-codex';
  update(theme: ThemeRecord, options?: { timeoutMs: number }): Promise<ApplyResult>;
}

/** Future independent client boundary; this does not modify the official desktop app. */
export interface AppServerClientAdapter extends ThemeAdapter {
  readonly kind: 'app-server-client';
}
