import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import electron from 'electron';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'frostline-electron-smoke-'));

try {
  runPhase('write');
  runPhase('verify');
  console.log('Electron restart persistence smoke test: OK');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

function runPhase(phase) {
  const result = spawnSync(
    electron,
    ['.', '--smoke-test', `--smoke-phase=${phase}`, `--smoke-user-data=${root}`],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
    },
  );

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);
  if (result.error || result.status !== 0 || !output.includes(`FROSTLINE_SMOKE_${phase.toUpperCase()}_OK`)) {
    throw result.error ?? new Error(`Electron smoke phase “${phase}” failed with status ${result.status}.`);
  }
}
