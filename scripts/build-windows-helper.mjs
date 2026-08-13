import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

if (process.platform !== 'win32') {
  throw new Error('Frostline Codex launcher can only be built on Windows.');
}

const workspace = path.resolve(process.cwd());
const windowsDirectory = process.env.WINDIR;
if (!windowsDirectory || !path.isAbsolute(windowsDirectory)) {
  throw new Error('WINDIR is not available.');
}

const compilerPath = path.join(
  windowsDirectory,
  'Microsoft.NET',
  'Framework64',
  'v4.0.30319',
  'csc.exe',
);
const sourcePath = path.join(workspace, 'native', 'FrostlineCodexLauncher', 'Program.cs');
const outputDirectory = path.join(workspace, 'native', 'bin');
const outputPath = path.join(outputDirectory, 'FrostlineCodexLauncher.exe');

await fs.access(compilerPath);
await fs.access(sourcePath);
await fs.mkdir(outputDirectory, { recursive: true });

const result = spawnSync(
  compilerPath,
  [
    '/nologo',
    '/target:exe',
    '/platform:x64',
    `/out:${outputPath}`,
    '/reference:System.Core.dll',
    sourcePath,
  ],
  { cwd: workspace, encoding: 'utf8', windowsHide: true },
);

if (result.status !== 0) {
  throw new Error(`Windows helper compilation failed.\n${result.stdout}\n${result.stderr}`);
}

const stats = await fs.stat(outputPath);
if (!stats.isFile() || stats.size === 0) {
  throw new Error('Windows helper compilation produced no executable.');
}

console.log(`FROSTLINE_CODEX_LAUNCHER_BUILD_OK bytes=${stats.size}`);
