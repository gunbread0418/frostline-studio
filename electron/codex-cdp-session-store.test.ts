// @vitest-environment node

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createActiveSession,
  createWaitingSession,
  FileCodexCdpSessionStore,
} from './codex-cdp-session-store';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe('FileCodexCdpSessionStore', () => {
  it('atomically advances a waiting session to an active session', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'frostline-cdp-store-'));
    temporaryRoots.push(root);
    const store = new FileCodexCdpSessionStore(root);
    const aumid = 'OpenAI.Codex_2p2nqsd0c76g0!App';

    await store.save(createWaitingSession(aumid));
    expect((await store.load())?.phase).toBe('waiting-for-exit');

    await store.save(createActiveSession(aumid, 49173, 'target_1', 'a'.repeat(32)));
    expect(await store.load()).toMatchObject({ phase: 'active', port: 49173 });
    expect((await fs.readdir(root)).some((name) => name.endsWith('.tmp'))).toBe(false);

    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it('rejects a malformed persisted session', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'frostline-cdp-store-'));
    temporaryRoots.push(root);
    const store = new FileCodexCdpSessionStore(root);
    await fs.writeFile(store.sessionPath, '{"phase":"active","port":80}', 'utf8');

    await expect(store.load()).rejects.toThrow('형식이 올바르지 않습니다');
  });
});
