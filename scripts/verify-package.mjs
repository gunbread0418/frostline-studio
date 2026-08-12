import { listPackage, extractFile } from '@electron/asar';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const releaseDirectory = path.join(projectRoot, 'release');
const unpackedDirectory = path.join(releaseDirectory, 'win-unpacked');
const asarPath = path.join(unpackedDirectory, 'resources', 'app.asar');

const installerPattern = /^Frostline-Studio-\d+\.\d+\.\d+-Setup-x64\.exe$/;
const allowedRoots = new Set(['dist', 'dist-electron', 'node_modules', 'package.json', 'LICENSE']);
const forbiddenPathParts = [
  '.git',
  'local-assets',
  'private-assets',
  'user-data',
];
const sensitiveContentPatterns = [
  { label: 'absolute Windows user path', expression: /[A-Z]:\\Users\\[^\\\s]+/i },
  { label: 'OneDrive path', expression: /OneDrive[\\/]/i },
  { label: 'GitHub token', expression: /(?:gh[opsu]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/ },
  { label: 'private key', expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

await assertFile(asarPath, 'packaged app.asar');
await assertFile(path.join(unpackedDirectory, 'Frostline Studio.exe'), 'packaged executable');

const releaseEntries = await fs.readdir(releaseDirectory, { withFileTypes: true });
const installers = releaseEntries
  .filter((entry) => entry.isFile() && installerPattern.test(entry.name))
  .map((entry) => entry.name);

if (installers.length !== 1) {
  throw new Error(`Expected exactly one x64 NSIS installer, found ${installers.length}.`);
}

const asarEntries = listPackage(asarPath, { isPack: false });
const normalizedEntries = asarEntries.map(normalizeAsarPath).filter(Boolean);
const unexpectedRoots = [...new Set(
  normalizedEntries
    .map((entry) => entry.split('/')[0])
    .filter((root) => !allowedRoots.has(root)),
)];

if (unexpectedRoots.length > 0) {
  throw new Error(`Unexpected app.asar roots: ${unexpectedRoots.join(', ')}`);
}

const forbiddenEntries = normalizedEntries.filter((entry) => {
  const parts = entry.toLowerCase().split('/');
  const containsPrivateDirectory = forbiddenPathParts.some((part) =>
    parts.includes(part.toLowerCase()),
  );
  const containsTypeScriptSource = /\.(?:ts|tsx|map)$/i.test(entry);
  return containsPrivateDirectory || containsTypeScriptSource;
});

if (forbiddenEntries.length > 0) {
  throw new Error(`Forbidden packaged paths: ${forbiddenEntries.slice(0, 8).join(', ')}`);
}

const appOwnedTextEntries = asarEntries.filter((entry) => {
  const normalized = normalizeAsarPath(entry);
  const isAppOwned =
    normalized === 'package.json' ||
    normalized === 'LICENSE' ||
    normalized.startsWith('dist/') ||
    normalized.startsWith('dist-electron/');
  return isAppOwned && /\.(?:css|html|js|json|md|txt)$/i.test(normalized);
});

for (const entry of appOwnedTextEntries) {
  const archivePath = normalizeAsarPath(entry).split('/').join(path.sep);
  const content = extractFile(asarPath, archivePath).toString('utf8');
  for (const pattern of sensitiveContentPatterns) {
    if (pattern.expression.test(content)) {
      throw new Error(`${pattern.label} found in packaged file ${normalizeAsarPath(entry)}.`);
    }
  }
}

const installerPath = path.join(releaseDirectory, installers[0]);
const installerStats = await fs.stat(installerPath);
console.log(`FROSTLINE_PACKAGE_VERIFY_OK installer=${installers[0]}`);
console.log(`FROSTLINE_PACKAGE_ASAR_ENTRIES=${normalizedEntries.length}`);
console.log(`FROSTLINE_PACKAGE_INSTALLER_BYTES=${installerStats.size}`);

function normalizeAsarPath(value) {
  return value.replaceAll('\\', '/').replace(/^\/+/, '');
}

async function assertFile(filePath, label) {
  const stats = await fs.stat(filePath).catch(() => null);
  if (!stats?.isFile()) throw new Error(`Missing ${label}: ${filePath}`);
}
