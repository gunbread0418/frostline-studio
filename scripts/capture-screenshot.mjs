import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import electron from 'electron';

const root = process.cwd();
const outputPath = path.resolve(root, 'docs/screenshots/frostline-studio-preview.png');
const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'frostline-screenshot-'));

try {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const result = spawnSync(
    electron,
    [
      '.',
      '--capture-screenshot',
      `--capture-output=${outputPath}`,
      `--capture-user-data=${userDataPath}`,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 20000,
      windowsHide: true,
    },
  );

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);
  if (
    result.error ||
    result.status !== 0 ||
    !output.includes('FROSTLINE_SCREENSHOT_OK')
  ) {
    throw (
      result.error ??
      new Error(`Electron screenshot failed with status ${String(result.status)}.`)
    );
  }
  console.log(`Screenshot written to ${path.relative(root, outputPath)}`);
} finally {
  await fs.rm(userDataPath, { recursive: true, force: true });
}
