import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const releaseDirectory = path.join(projectRoot, 'release');
const checksumPath = path.join(releaseDirectory, 'SHA256SUMS.txt');
const releaseEntries = await fs.readdir(releaseDirectory, { withFileTypes: true });
const artifactNames = releaseEntries
  .filter((entry) => entry.isFile() && /(?:\.exe|\.exe\.blockmap)$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

if (!artifactNames.some((name) => name.endsWith('.exe'))) {
  throw new Error('No Windows installer was found for checksum generation.');
}

const lines = [];
for (const artifactName of artifactNames) {
  const digest = await sha256(path.join(releaseDirectory, artifactName));
  lines.push(`${digest}  ${artifactName}`);
}

await fs.writeFile(checksumPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`FROSTLINE_PACKAGE_CHECKSUM_OK files=${artifactNames.length}`);

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const input = createReadStream(filePath);
    input.on('error', reject);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('end', () => resolve(hash.digest('hex')));
  });
}
