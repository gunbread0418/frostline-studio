// @vitest-environment node

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../src/shared/theme';
import type { CodexCdpGateway, CodexCdpTarget } from './codex-cdp-client';
import {
  createArmedSession,
  type CodexCdpSession,
  type CodexCdpSessionStore,
} from './codex-cdp-session-store';
import { OfficialCodexAdapter } from './official-codex-adapter';
import type { CodexLauncherGateway } from './windows-codex-launcher';

const temporaryRoots: string[] = [];
const aumid = 'OpenAI.Codex_2p2nqsd0c76g0!App';
const target: CodexCdpTarget = {
  id: 'target_1',
  type: 'page',
  url: 'app://-/index.html',
  webSocketDebuggerUrl: 'ws://127.0.0.1:49173/devtools/page/target_1',
};

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

async function createHarness() {
  let session: CodexCdpSession | null = null;
  let running = true;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'frostline-adapter-'));
  temporaryRoots.push(root);
  const assetId = '11111111-1111-4111-8111-111111111111.png';
  await fs.writeFile(path.join(root, assetId), Buffer.from([137, 80, 78, 71]));
  const theme = createDefaultTheme();
  theme.image = { assetId, originalName: 'owned.png', url: `frostline-asset://image/${assetId}` };

  const launcher: CodexLauncherGateway = {
    inspect: vi.fn().mockImplementation(async () => ({ running, aumid: running ? aumid : null })),
    launch: vi.fn().mockImplementation(async () => {
      running = true;
      return { activationPid: 1234 };
    }),
    getPortOwner: vi.fn().mockResolvedValue({ ownerPid: 1234, aumid }),
  };
  const cdp: CodexCdpGateway = {
    waitForMainTarget: vi.fn().mockResolvedValue(target),
    evaluate: vi.fn().mockImplementation(async (_target, expression: string) => {
      if (expression.includes('marker-mismatch')) return { ok: true };
      if (expression.includes("profile: 'codex-electron-v1'")) {
        return { ok: true, profile: 'codex-electron-v1' };
      }
      return {
        ok: true,
        stage: 'complete',
        marker: /FROSTLINE_STUDIO_SKIN:([a-f0-9]{32})/.exec(expression)?.[1],
      };
    }),
  };
  const store: CodexCdpSessionStore = {
    load: vi.fn().mockImplementation(async () => session),
    save: vi.fn().mockImplementation(async (next: CodexCdpSession) => {
      session = next;
    }),
    clear: vi.fn().mockImplementation(async () => {
      session = null;
    }),
  };
  return {
    adapter: new OfficialCodexAdapter(
      launcher,
      cdp,
      store,
      (id) => path.join(root, id),
      'win32',
    ),
    cdp,
    launcher,
    store,
    theme,
    setRunning(value: boolean) {
      running = value;
    },
    setSession(value: CodexCdpSession | null) {
      session = value;
    },
  };
}

describe('OfficialCodexAdapter CDP manual flow', () => {
  it('never closes a running Codex and requires a user-directed exit first', async () => {
    const harness = await createHarness();

    const result = await harness.adapter.apply(harness.theme);

    expect(result.ok).toBe(false);
    expect(result.requiresCodexExit).toBe(true);
    expect(result.phase).toBe('waiting-for-exit');
    expect(harness.launcher.launch).not.toHaveBeenCalled();
    expect(harness.cdp.evaluate).not.toHaveBeenCalled();
  });

  it('launches once after manual exit, injects once, and verifies the marker', async () => {
    const harness = await createHarness();
    await harness.adapter.apply(harness.theme);
    harness.setRunning(false);

    const result = await harness.adapter.apply(harness.theme);

    expect(result.ok).toBe(true);
    expect(result.phase).toBe('active');
    expect(harness.launcher.launch).toHaveBeenCalledOnce();
    expect(harness.cdp.evaluate).toHaveBeenCalledTimes(2);
  });

  it('does not retry a failed injection and leaves an armed manual-retry state', async () => {
    const harness = await createHarness();
    harness.setRunning(false);
    harness.setSession(createArmedSession(aumid, 49173, 'b'.repeat(32)));
    vi.mocked(harness.cdp.evaluate).mockRejectedValueOnce(new Error('one-shot failure'));

    const result = await harness.adapter.apply(harness.theme);

    expect(result.ok).toBe(false);
    expect(result.phase).toBe('armed');
    expect(harness.cdp.evaluate).toHaveBeenCalledTimes(2);
    expect(result.message).toContain('자동 재시도하지 않습니다');
  });

  it('removes the injected style and clears the session without stopping Codex', async () => {
    const harness = await createHarness();
    await harness.adapter.apply(harness.theme);
    harness.setRunning(false);
    await harness.adapter.apply(harness.theme);

    const result = await harness.adapter.restore();

    expect(result.ok).toBe(true);
    expect(result.canRestore).toBe(false);
    expect(harness.store.clear).toHaveBeenCalledOnce();
    expect(harness.launcher.launch).toHaveBeenCalledOnce();
  });

  it('updates an active verified session without launching another Codex process', async () => {
    const harness = await createHarness();
    await harness.adapter.apply(harness.theme);
    harness.setRunning(false);
    await harness.adapter.apply(harness.theme);

    harness.theme.values.bodyOpacity = 64;
    const result = await harness.adapter.update(harness.theme);

    expect(result.ok).toBe(true);
    expect(result.stage).toBe('live-update');
    expect(harness.launcher.launch).toHaveBeenCalledOnce();
    expect(harness.cdp.evaluate).toHaveBeenCalledTimes(4);
  });
});
