import { promises as fs } from 'node:fs';
import path from 'node:path';
import { resolveThemeTokens } from '../src/shared/theme-tokens';
import type { ThemeRecord } from '../src/shared/theme';

export const FROSTLINE_STYLE_ID = 'frostline-studio-codex-skin';
export const FROSTLINE_LAYER_ID = 'frostline-studio-codex-layer';
const MAX_RUNTIME_IMAGE_BYTES = 16 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

export interface CompiledCodexSkin {
  css: string;
  marker: string;
  imageUrl: string;
}

export async function compileCodexSkin(
  theme: ThemeRecord,
  marker: string,
  resolveAssetPath: (assetId: string) => string,
): Promise<CompiledCodexSkin> {
  if (!theme.image) {
    throw new Error('실제 Codex 배경에 적용하려면 먼저 사진을 선택해야 합니다.');
  }
  if (!/^[a-f0-9]{32}$/.test(marker)) {
    throw new Error('Codex 스킨 확인 표식이 올바르지 않습니다.');
  }
  const imagePath = resolveAssetPath(theme.image.assetId);
  const extension = path.extname(imagePath).toLowerCase();
  const mime = MIME_BY_EXTENSION[extension];
  if (!mime) throw new Error('Codex 배경에 지원되지 않는 사진 형식입니다.');
  const bytes = await fs.readFile(imagePath);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_RUNTIME_IMAGE_BYTES) {
    throw new Error('Codex에 적용할 사진은 비어 있지 않은 16MB 이하 파일이어야 합니다.');
  }
  const imageUrl = `data:${mime};base64,${bytes.toString('base64')}`;
  const values = theme.values;
  const tokens = resolveThemeTokens(values);
  const blurInset = Math.ceil(values.blur * 2 + 8);
  const scale = values.backgroundScale / 100;

  const css = `/* FROSTLINE_STUDIO_SKIN:${marker} */
:root[data-codex-window-type="electron"] {
  --color-background-surface: ${tokens.bodySurface} !important;
  --color-background-panel: ${tokens.sidebarSurface} !important;
  --color-background-card: ${tokens.cardSurface} !important;
  --color-background-button-primary: ${tokens.accent} !important;
  --color-border: ${tokens.border} !important;
  --foreground: ${tokens.foreground} !important;
  --muted-foreground: ${tokens.mutedForeground} !important;
  --card-foreground: ${tokens.foreground} !important;
  --primary: ${tokens.accent} !important;
  --primary-foreground: ${tokens.accentForeground} !important;
  --accent: ${tokens.accent} !important;
  --accent-foreground: ${tokens.accentForeground} !important;
  --color-text-primary: ${tokens.foreground} !important;
  --color-text-secondary: ${tokens.mutedForeground} !important;
  --color-text-tertiary: ${tokens.mutedForeground} !important;
  --color-link: ${tokens.link} !important;
  --frostline-foreground: ${tokens.foreground};
  --frostline-muted-foreground: ${tokens.mutedForeground};
  --frostline-input-foreground: ${tokens.inputForeground};
  --frostline-link: ${tokens.link};
  --frostline-caret: ${tokens.caret};
  --frostline-ui-font: ${tokens.uiFontStack};
  --frostline-code-font: ${tokens.codeFontStack};
}
html, body, #root { min-height: 100%; }
html {
  background: ${values.bodyColor} !important;
  font-size: ${values.fontScale}% !important;
}
body {
  background: transparent !important;
  color: var(--frostline-foreground) !important;
  font-family: var(--frostline-ui-font) !important;
}
#${FROSTLINE_LAYER_ID} {
  position: fixed !important;
  inset: 0 !important;
  overflow: hidden !important;
  pointer-events: none !important;
  z-index: 0 !important;
}
#${FROSTLINE_LAYER_ID} > img {
  position: absolute !important;
  inset: -${blurInset}px !important;
  width: calc(100% + ${blurInset * 2}px) !important;
  height: calc(100% + ${blurInset * 2}px) !important;
  object-fit: ${values.backgroundFit} !important;
  object-position: ${values.backgroundX}% ${values.backgroundY}% !important;
  transform: scale(${scale}) !important;
  transform-origin: ${values.backgroundX}% ${values.backgroundY}% !important;
  filter: brightness(${values.brightness}%) saturate(${values.saturation}%) contrast(${values.contrast}%) blur(${values.blur}px) !important;
}
#${FROSTLINE_LAYER_ID} > [data-frostline-overlay] {
  position: absolute !important;
  inset: 0 !important;
  background: ${tokens.overlay} !important;
}
#root {
  position: relative !important;
  z-index: 1 !important;
  isolation: isolate !important;
  background: transparent !important;
}
.app-shell-left-panel {
  background: ${tokens.sidebarSurface} !important;
  border-color: ${tokens.border} !important;
  backdrop-filter: blur(8px) saturate(1.08) !important;
}
.main-surface,
.browser-main-surface {
  background: ${tokens.bodySurface} !important;
  color: var(--frostline-foreground) !important;
}
.main-surface article,
.browser-main-surface article {
  background: ${tokens.cardSurface} !important;
  color: var(--frostline-foreground) !important;
}
#root :where(h1, h2, h3, h4, h5, h6, p, li, label) {
  color: var(--frostline-foreground) !important;
}
#root :where(small, time) {
  color: var(--frostline-muted-foreground) !important;
}
body,
button,
input,
textarea,
[contenteditable="true"] {
  font-family: var(--frostline-ui-font) !important;
}
pre,
code,
kbd,
samp {
  font-family: var(--frostline-code-font) !important;
}
a:not([role="button"]) {
  color: var(--frostline-link) !important;
}
::selection {
  background: ${tokens.selection} !important;
  color: var(--frostline-foreground) !important;
}
textarea,
input,
[contenteditable="true"] {
  background: ${tokens.inputSurface} !important;
  border-color: ${tokens.border} !important;
  color: var(--frostline-input-foreground) !important;
  caret-color: var(--frostline-caret) !important;
  cursor: text !important;
}
textarea::placeholder,
input::placeholder {
  color: ${tokens.mutedForeground} !important;
}
`;

  return { css, marker, imageUrl };
}

export function buildApplyExpression(skin: CompiledCodexSkin): string {
  const styleId = JSON.stringify(FROSTLINE_STYLE_ID);
  const layerId = JSON.stringify(FROSTLINE_LAYER_ID);
  const css = JSON.stringify(skin.css);
  const marker = JSON.stringify(skin.marker);
  const imageUrl = JSON.stringify(skin.imageUrl);
  return `(async () => {
    const root = document.getElementById('root');
    if (!root) return { ok: false, stage: 'compatibility', reason: 'root-not-found' };
    const currentMarker = document.documentElement.dataset.frostlineStudioSkin;
    if (currentMarker && currentMarker !== ${marker}) {
      return { ok: false, stage: 'style-install', reason: 'marker-conflict' };
    }
    let style = document.getElementById(${styleId});
    if (style && style.tagName !== 'STYLE') {
      return { ok: false, stage: 'style-install', reason: 'style-id-conflict' };
    }
    let layer = document.getElementById(${layerId});
    if (layer && layer.tagName !== 'DIV') {
      return { ok: false, stage: 'style-install', reason: 'layer-id-conflict' };
    }

    const nextImage = new Image();
    nextImage.alt = '';
    nextImage.decoding = 'async';
    let loadTimer;
    const loaded = new Promise((resolve) => {
      loadTimer = setTimeout(() => resolve(false), 5000);
      nextImage.addEventListener('load', () => {
        clearTimeout(loadTimer);
        resolve(nextImage.naturalWidth > 0 && nextImage.naturalHeight > 0);
      }, { once: true });
      nextImage.addEventListener('error', () => {
        clearTimeout(loadTimer);
        resolve(false);
      }, { once: true });
    });
    nextImage.src = ${imageUrl};
    if (nextImage.complete) clearTimeout(loadTimer);
    const imageLoaded = nextImage.complete
      ? nextImage.naturalWidth > 0 && nextImage.naturalHeight > 0
      : await loaded;
    if (!imageLoaded) {
      return { ok: false, stage: 'image-decode', reason: 'image-load-failed' };
    }
    try { await nextImage.decode(); } catch {
      if (!nextImage.complete || nextImage.naturalWidth === 0) {
        return { ok: false, stage: 'image-decode', reason: 'image-decode-failed' };
      }
    }

    if (!style) {
      style = document.createElement('style');
      style.id = ${styleId};
      document.head.appendChild(style);
    }
    if (!layer) {
      layer = document.createElement('div');
      layer.id = ${layerId};
      document.body.prepend(layer);
    }
    const overlay = document.createElement('div');
    overlay.dataset.frostlineOverlay = '';
    layer.replaceChildren(nextImage, overlay);
    layer.dataset.frostlineMarker = ${marker};
    style.textContent = ${css};
    document.documentElement.dataset.frostlineStudioSkin = ${marker};
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const bounds = nextImage.getBoundingClientRect();
    const visible =
      style.isConnected &&
      layer.isConnected &&
      nextImage.isConnected &&
      nextImage.complete &&
      nextImage.naturalWidth > 0 &&
      bounds.width > 0 &&
      bounds.height > 0 &&
      getComputedStyle(layer).pointerEvents === 'none';
    return {
      ok: visible,
      stage: visible ? 'complete' : 'visibility-check',
      reason: visible ? undefined : 'layer-not-visible',
      marker: document.documentElement.dataset.frostlineStudioSkin,
      styleId: style.id,
      layerId: layer.id,
      imageWidth: nextImage.naturalWidth,
      imageHeight: nextImage.naturalHeight
    };
  })()`;
}

export function buildCompatibilityProbeExpression(): string {
  return `(() => {
    const root = document.getElementById('root');
    const windowType = document.documentElement.dataset.codexWindowType;
    const sidebarCount = document.querySelectorAll('.app-shell-left-panel').length;
    const mainSurfaceCount = document.querySelectorAll('.main-surface, .browser-main-surface').length;
    const composerCount = document.querySelectorAll('textarea, [contenteditable="true"]').length;
    return {
      ok: Boolean(root) && windowType === 'electron' && (sidebarCount > 0 || mainSurfaceCount > 0),
      profile: 'codex-electron-v1',
      windowType: windowType ?? null,
      selectors: { sidebarCount, mainSurfaceCount, composerCount }
    };
  })()`;
}

export function buildRemoveExpression(marker: string): string {
  const styleId = JSON.stringify(FROSTLINE_STYLE_ID);
  const layerId = JSON.stringify(FROSTLINE_LAYER_ID);
  const expectedMarker = JSON.stringify(marker);
  return `(() => {
    const current = document.documentElement.dataset.frostlineStudioSkin;
    if (current && current !== ${expectedMarker}) {
      return { ok: false, reason: 'marker-mismatch', marker: current };
    }
    document.getElementById(${styleId})?.remove();
    document.getElementById(${layerId})?.remove();
    delete document.documentElement.dataset.frostlineStudioSkin;
    return {
      ok: !document.getElementById(${styleId}) &&
        !document.getElementById(${layerId}) &&
        !document.documentElement.dataset.frostlineStudioSkin
    };
  })()`;
}
