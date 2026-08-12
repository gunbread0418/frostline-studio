import { promises as fs } from 'node:fs';
import path from 'node:path';

const workspace = path.resolve(process.cwd());
const releaseDirectory = path.resolve(workspace, 'release');

if (path.dirname(releaseDirectory) !== workspace || path.basename(releaseDirectory) !== 'release') {
  throw new Error(`Refusing to clean an unexpected release path: ${releaseDirectory}`);
}

await fs.rm(releaseDirectory, { recursive: true, force: true });
