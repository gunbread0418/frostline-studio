import type { CSSProperties } from 'react';
import type {
  AdapterCapabilities,
  ApplyResult,
  ThemeAdapter,
} from '../../shared/adapters';
import type { ThemeRecord } from '../../shared/theme';
import { resolveThemeTokens } from '../../shared/theme-tokens';

export class PreviewAdapter implements ThemeAdapter {
  readonly kind = 'preview' as const;
  readonly capabilities: AdapterCapabilities = {
    preview: true,
    apply: true,
    restore: true,
    liveUpdate: true,
    autoApply: false,
  };

  createImageStyle(theme: ThemeRecord): CSSProperties {
    const { values } = theme;
    return {
      objectFit: values.backgroundFit,
      objectPosition: `${values.backgroundX}% ${values.backgroundY}%`,
      filter: `brightness(${values.brightness}%) saturate(${values.saturation}%) contrast(${values.contrast}%) blur(${values.blur}px)`,
      transform: `scale(${values.backgroundScale / 100})`,
    };
  }

  createPreviewVariables(theme: ThemeRecord): CSSProperties {
    const { values } = theme;
    const tokens = resolveThemeTokens(values);
    return {
      '--preview-overlay': tokens.overlay,
      '--preview-sidebar': tokens.sidebarSurface,
      '--preview-body': tokens.bodySurface,
      '--preview-input': tokens.inputSurface,
      '--preview-card': tokens.cardSurface,
      '--preview-border': tokens.border,
      '--preview-accent': tokens.accent,
      '--preview-accent-foreground': tokens.accentForeground,
      '--preview-foreground': tokens.foreground,
      '--preview-muted-foreground': tokens.mutedForeground,
      '--preview-input-foreground': tokens.inputForeground,
      '--preview-link': tokens.link,
      '--preview-selection': tokens.selection,
      '--preview-caret': tokens.caret,
      '--preview-ui-font': tokens.uiFontStack,
      '--preview-code-font': tokens.codeFontStack,
      '--preview-font-scale': tokens.fontScale,
    } as CSSProperties;
  }

  async apply(): Promise<ApplyResult> {
    return {
      ok: true,
      message: '독립 미리보기에 테마를 반영했습니다.',
      attemptedAt: new Date().toISOString(),
    };
  }

  async restore(): Promise<ApplyResult> {
    return {
      ok: true,
      message: '독립 미리보기를 기본 상태로 되돌렸습니다.',
      attemptedAt: new Date().toISOString(),
    };
  }
}

export const previewAdapter = new PreviewAdapter();
