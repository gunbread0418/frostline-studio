import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

if (process.platform !== 'win32') {
  throw new Error('The installer smoke test only supports Windows.');
}

const projectRoot = path.resolve(import.meta.dirname, '..');
const releaseDirectory = path.join(projectRoot, 'release');
const installerNames = (await fs.readdir(releaseDirectory)).filter((name) =>
  /^Frostline-Studio-\d+\.\d+\.\d+-Setup-x64\.exe$/.test(name),
);

if (installerNames.length !== 1) {
  throw new Error(`Expected one installer, found ${installerNames.length}.`);
}

const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'frostline-installer-smoke-'));
const installDirectory = path.join(temporaryRoot, 'Frostline Studio');
const smokeUserData = path.join(temporaryRoot, 'user-data');
const installerPath = path.join(releaseDirectory, installerNames[0]);
const appPath = path.join(installDirectory, 'Frostline Studio.exe');
let uninstallerPath;

try {
  await runExecutable(installerPath, ['/S', `/D=${installDirectory}`], 120_000);
  await assertFile(appPath, 'installed Frostline Studio executable');
  console.log('FROSTLINE_INSTALLER_INSTALL_OK');

  await runExecutable(
    appPath,
    ['--smoke-test', `--smoke-user-data=${smokeUserData}`, '--smoke-phase=write'],
    30_000,
  );
  await runExecutable(
    appPath,
    ['--smoke-test', `--smoke-user-data=${smokeUserData}`, '--smoke-phase=verify'],
    30_000,
  );
  console.log('FROSTLINE_INSTALLER_RESTART_OK');

  uninstallerPath = await findUninstaller(installDirectory);
  await runExecutable(uninstallerPath, ['/S'], 120_000);
  await waitForRemoval(appPath, 15_000);
  console.log('FROSTLINE_INSTALLER_UNINSTALL_OK');
} finally {
  if (await fileExists(appPath)) {
    uninstallerPath ??= await findUninstaller(installDirectory).catch(() => undefined);
    if (uninstallerPath) {
      await runExecutable(uninstallerPath, ['/S'], 120_000).catch(() => undefined);
      await waitForRemoval(appPath, 15_000).catch(() => undefined);
    }
  }
  assertTemporaryPath(temporaryRoot);
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}

async function runExecutable(filePath, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(filePath, args, {
      cwd: path.dirname(filePath),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Timed out while running ${path.basename(filePath)}.`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `${path.basename(filePath)} exited with ${String(code)}. ${stderr || stdout}`.trim(),
        ),
      );
    });
  });
}

async function findUninstaller(directory) {
  const entries = await fs.readdir(directory);
  const candidates = entries.filter((name) => /^Uninstall.*\.exe$/i.test(name));
  if (candidates.length !== 1) {
    throw new Error(`Expected one uninstaller, found ${candidates.length}.`);
  }
  return path.join(directory, candidates[0]);
}

async function waitForRemoval(filePath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (await fileExists(filePath)) {
    if (Date.now() >= deadline) {
      throw new Error(`Uninstaller did not remove ${filePath}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function assertFile(filePath, label) {
  const stats = await fs.stat(filePath).catch(() => null);
  if (!stats?.isFile()) throw new Error(`Missing ${label}: ${filePath}`);
}

async function fileExists(filePath) {
  return fs.access(filePath).then(
    () => true,
    () => false,
  );
}

function assertTemporaryPath(value) {
  const expectedPrefix = path.resolve(os.tmpdir(), 'frostline-installer-smoke-');
  if (!path.resolve(value).startsWith(expectedPrefix)) {
    throw new Error(`Refusing to clean unexpected path: ${value}`);
  }
}
