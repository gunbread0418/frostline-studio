// @vitest-environment node

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/shared/theme';
import { ThemeStore } from './theme-store';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

async function createTemporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'frostline-studio-test-'));
  temporaryRoots.push(root);
  return root;
}

describe('ThemeStore', () => {
  it('keeps a copied image and state after the original moves and the store reopens', async () => {
    const root = await createTemporaryRoot();
    const sourcePath = path.join(root, 'source.png');
    await fs.writeFile(sourcePath, Buffer.from('local-image-fixture'));

    const firstStore = new ThemeStore(path.join(root, 'user-data'));
    const asset = await firstStore.copyImage(sourcePath);
    const state = createInitialState();
    state.themes[0].image = asset;
    await firstStore.save(state);
    await fs.unlink(sourcePath);

    const secondStore = new ThemeStore(path.join(root, 'user-data'));
    const restored = await secondStore.load();
    const copiedBytes = await fs.readFile(secondStore.resolveAssetPath(asset.assetId), 'utf8');

    expect(restored.themes[0].image).toEqual(asset);
    expect(copiedBytes).toBe('local-image-fixture');
    expect(await fs.readdir(path.join(root, 'user-data'))).toContain('themes.json');
    expect((await fs.readdir(path.join(root, 'user-data'))).some((name) => name.endsWith('.tmp'))).toBe(false);
  });

  it('exports and imports a portable theme with its image', async () => {
    const root = await createTemporaryRoot();
    const sourcePath = path.join(root, 'aurora.jpg');
    const exportPath = path.join(root, 'portable-theme.json');
    await fs.writeFile(sourcePath, Buffer.from('portable-image'));

    const store = new ThemeStore(path.join(root, 'user-data'));
    const state = createInitialState();
    state.themes[0].name = '오로라';
    state.themes[0].image = await store.copyImage(sourcePath);
    await store.exportTheme(state.themes[0], exportPath);
    const imported = await store.importTheme(exportPath);

    expect(imported.theme.name).toBe('오로라 (가져옴)');
    expect(imported.theme.id).not.toBe(state.themes[0].id);
    expect(imported.theme.image?.assetId).not.toBe(state.themes[0].image?.assetId);
    expect(
      await fs.readFile(store.resolveAssetPath(imported.theme.image!.assetId), 'utf8'),
    ).toBe('portable-image');
  });

  it('serializes overlapping saves and keeps the newest state', async () => {
    const root = await createTemporaryRoot();
    const store = new ThemeStore(path.join(root, 'user-data'));
    const first = createInitialState();
    first.themes[0].name = '첫 저장';
    const second = structuredClone(first);
    second.themes[0].name = '마지막 저장';

    await Promise.all([store.save(first), store.save(second)]);

    expect((await store.load()).themes[0].name).toBe('마지막 저장');
  });

  it('imports the public image-free example theme', async () => {
    const root = await createTemporaryRoot();
    const store = new ThemeStore(path.join(root, 'user-data'));
    const examplePath = path.resolve(
      process.cwd(),
      'examples/frostline-midnight.frostline-theme.json',
    );

    const imported = await store.importTheme(examplePath);

    expect(imported.theme.name).toBe('Frostline Midnight (가져옴)');
    expect(imported.theme.image).toBeNull();
  });
});
