// @vitest-environment node

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultTheme } from '../src/shared/theme';
import {
  buildApplyExpression,
  buildCompatibilityProbeExpression,
  buildRemoveExpression,
  compileCodexSkin,
} from './codex-skin';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe('Codex skin compiler', () => {
  it('embeds a managed image and every Frostline visual control in bounded CSS', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'frostline-skin-'));
    temporaryRoots.push(root);
    const assetId = '11111111-1111-4111-8111-111111111111.png';
    await fs.writeFile(path.join(root, assetId), Buffer.from([137, 80, 78, 71]));
    const theme = createDefaultTheme();
    theme.image = { assetId, originalName: 'owned.png', url: `frostline-asset://image/${assetId}` };

    const skin = await compileCodexSkin(theme, 'a'.repeat(32), (id) => path.join(root, id));

    expect(skin.imageUrl).toContain('data:image/png;base64,');
    expect(skin.css).toContain('object-fit: cover');
    expect(skin.css).toContain('brightness(72%)');
    expect(skin.css).toContain('rgba(8, 11, 18, 0.54)');
    expect(skin.css).toContain('#frostline-studio-codex-layer > img');
    expect(skin.css).toContain('rgba(13, 17, 25, 0.38)');
    expect(buildApplyExpression(skin)).toContain('frostlineStudioSkin');
    expect(buildApplyExpression(skin)).toContain('nextImage.decode');
    expect(buildApplyExpression(skin)).toContain('requestAnimationFrame');
    expect(buildCompatibilityProbeExpression()).toContain('codex-electron-v1');
    expect(buildCompatibilityProbeExpression()).not.toMatch(/textContent|innerText/);
    expect(buildRemoveExpression(skin.marker)).toContain('marker-mismatch');
  });

  it('requires an image for actual Codex background application', async () => {
    await expect(
      compileCodexSkin(createDefaultTheme(), 'b'.repeat(32), () => 'unused'),
    ).rejects.toThrow('먼저 사진을 선택');
  });

  it('chooses a visible input foreground and caret instead of reusing the accent', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'frostline-skin-'));
    temporaryRoots.push(root);
    const assetId = '11111111-1111-4111-8111-111111111111.png';
    await fs.writeFile(path.join(root, assetId), Buffer.from([137, 80, 78, 71]));
    const theme = createDefaultTheme();
    theme.image = { assetId, originalName: 'owned.png', url: `frostline-asset://image/${assetId}` };
    theme.values.inputColor = '#ffffff';
    theme.values.accentColor = '#ffffff';

    const skin = await compileCodexSkin(theme, 'c'.repeat(32), (id) => path.join(root, id));

    expect(skin.css).toContain('--frostline-input-foreground: #000000');
    expect(skin.css).toContain('--frostline-caret: #000000');
    expect(skin.css).toContain('caret-color: var(--frostline-caret) !important');
    expect(skin.css).toContain('cursor: text !important');
    expect(skin.css).not.toContain('--frostline-caret: #ffffff');
  });
});
