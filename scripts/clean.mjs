import { promises as fs } from 'node:fs';
import path from 'node:path';

const workspace = path.resolve(process.cwd());
const targets = ['dist', 'dist-electron'].map((name) => path.resolve(workspace, name));

for (const target of targets) {
  if (path.dirname(target) !== workspace) {
    throw new Error(`Refusing to clean a path outside the workspace: ${target}`);
  }
  await fs.rm(target, { recursive: true, force: true });
}
