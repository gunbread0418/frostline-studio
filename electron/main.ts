import { app, BrowserWindow, clipboard, dialog, ipcMain, net, protocol } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { IPC_CHANNELS } from '../src/shared/ipc';
import { ThemeStore } from './theme-store';
import { assertAppearanceGuide, assertThemeRecord } from '../src/shared/validation';
import { CodexCdpClient } from './codex-cdp-client';
import { FileCodexCdpSessionStore } from './codex-cdp-session-store';
import { OfficialCodexAdapter } from './official-codex-adapter';
import { WindowsCodexLauncher, type CodexLauncherGateway } from './windows-codex-launcher';
import { recommendThemePalette } from './theme-recommender';
import type { ThemeRecommendationMode } from '../src/shared/theme-recommendation';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'frostline-asset',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

const isDevelopment = process.argv.includes('--dev');
const isSmokeTest = process.argv.includes('--smoke-test');
const isScreenshotCapture = process.argv.includes('--capture-screenshot');
const smokeUserDataPath = readArgumentValue('--smoke-user-data=');
const smokePhase = readArgumentValue('--smoke-phase=');
const screenshotUserDataPath = readArgumentValue('--capture-user-data=');
const screenshotOutputPath = readArgumentValue('--capture-output=');
const productionPagePath = path.resolve(__dirname, '../../dist/index.html');
let mainWindow: BrowserWindow | null = null;
let store: ThemeStore;
let officialCodexAdapter: OfficialCodexAdapter;

if (smokeUserDataPath) {
  app.setPath('userData', path.resolve(smokeUserDataPath));
}
if (screenshotUserDataPath) {
  app.setPath('userData', path.resolve(screenshotUserDataPath));
}
if (isSmokeTest || isScreenshotCapture) {
  app.disableHardwareAcceleration();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  app.setName('Frostline Studio');
  store = new ThemeStore(app.getPath('userData'));
  await store.initialize();
  const launcherPath = app.isPackaged
    ? path.join(process.resourcesPath, 'helper', 'FrostlineCodexLauncher.exe')
    : path.resolve(__dirname, '../../native/bin/FrostlineCodexLauncher.exe');
  const codexLauncher: CodexLauncherGateway =
    process.platform === 'win32'
      ? new WindowsCodexLauncher(launcherPath)
      : {
          inspect: async () => ({ running: false, aumid: null }),
          launch: async () => {
            throw new Error('Codex 사진 스킨은 Windows에서만 사용할 수 있습니다.');
          },
          getPortOwner: async () => {
            throw new Error('Codex 사진 스킨은 Windows에서만 사용할 수 있습니다.');
          },
        };
  officialCodexAdapter = new OfficialCodexAdapter(
    codexLauncher,
    new CodexCdpClient(),
    new FileCodexCdpSessionStore(app.getPath('userData')),
    (assetId) => store.resolveAssetPath(assetId),
  );
  registerAssetProtocol();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#0a0e15',
    show: false,
    title: 'Frostline Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      offscreen: isScreenshotCapture,
      backgroundThrottling: !isScreenshotCapture,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedPageUrl(url)) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => {
    if (!isSmokeTest && !isScreenshotCapture) mainWindow?.show();
  });
  mainWindow.webContents.once('did-finish-load', () => {
    if (isSmokeTest) void runSmokePhase();
    if (isScreenshotCapture) void captureScreenshot();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDevelopment) {
    void mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

function registerAssetProtocol(): void {
  protocol.handle('frostline-asset', (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'image') {
        return new Response('Not found', { status: 404 });
      }
      const assetId = decodeURIComponent(url.pathname.replace(/^\//, ''));
      return net.fetch(pathToFileURL(store.resolveAssetPath(assetId)).toString());
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.loadState, (event) => {
    assertTrustedSender(event.senderFrame?.url);
    return store.load();
  });

  ipcMain.handle(IPC_CHANNELS.saveState, async (event, state: unknown) => {
    assertTrustedSender(event.senderFrame?.url);
    await store.save(state);
    return { savedAt: new Date().toISOString() };
  });

  ipcMain.handle(IPC_CHANNELS.selectImage, async (event) => {
    assertTrustedSender(event.senderFrame?.url);
    const owner = requireSenderWindow(event.sender);
    const result = await dialog.showOpenDialog(owner, {
      title: '배경 사진 선택',
      properties: ['openFile'],
      filters: [{ name: '사진', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    return { canceled: false, asset: await store.copyImage(result.filePaths[0]) };
  });

  ipcMain.handle(IPC_CHANNELS.exportTheme, async (event, theme: unknown) => {
    assertTrustedSender(event.senderFrame?.url);
    const owner = requireSenderWindow(event.sender);
    const result = await dialog.showSaveDialog(owner, {
      title: '테마 내보내기',
      defaultPath: 'frostline-theme.frostline-theme.json',
      filters: [{ name: 'Frostline Studio 테마', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    await store.exportTheme(theme, result.filePath);
    return { canceled: false, fileName: path.basename(result.filePath) };
  });

  ipcMain.handle(IPC_CHANNELS.importTheme, async (event) => {
    assertTrustedSender(event.senderFrame?.url);
    const owner = requireSenderWindow(event.sender);
    const result = await dialog.showOpenDialog(owner, {
      title: '테마 가져오기',
      properties: ['openFile'],
      filters: [{ name: 'Frostline Studio 테마', extensions: ['json'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    const imported = await store.importTheme(result.filePaths[0]);
    return { canceled: false, theme: imported.theme, fileName: imported.sourceName };
  });

  ipcMain.handle(IPC_CHANNELS.copyAppearanceGuide, (event, text: unknown) => {
    assertTrustedSender(event.senderFrame?.url);
    assertAppearanceGuide(text);
    clipboard.writeText(text);
    return { copiedAt: new Date().toISOString() };
  });

  ipcMain.handle(
    IPC_CHANNELS.recommendThemePalette,
    (event, theme: unknown, mode: ThemeRecommendationMode) => {
      assertTrustedSender(event.senderFrame?.url);
      requireSenderWindow(event.sender);
      assertThemeRecord(theme);
      if (!['photo', 'balanced', 'contrast'].includes(mode)) {
        throw new Error('지원하지 않는 색상 추천 모드입니다.');
      }
      return recommendThemePalette(theme, mode, (assetId) => store.resolveAssetPath(assetId));
    },
  );

  ipcMain.handle(IPC_CHANNELS.getOfficialCodexStatus, (event) => {
    assertTrustedSender(event.senderFrame?.url);
    requireSenderWindow(event.sender);
    return officialCodexAdapter.getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.applyOfficialCodexTheme, (event, theme: unknown) => {
    assertTrustedSender(event.senderFrame?.url);
    requireSenderWindow(event.sender);
    assertThemeRecord(theme);
    return officialCodexAdapter.apply(theme, { timeoutMs: 15_000 });
  });

  ipcMain.handle(IPC_CHANNELS.updateOfficialCodexTheme, (event, theme: unknown) => {
    assertTrustedSender(event.senderFrame?.url);
    requireSenderWindow(event.sender);
    assertThemeRecord(theme);
    return officialCodexAdapter.update(theme, { timeoutMs: 8_000 });
  });

  ipcMain.handle(IPC_CHANNELS.restoreOfficialCodexTheme, (event) => {
    assertTrustedSender(event.senderFrame?.url);
    requireSenderWindow(event.sender);
    return officialCodexAdapter.restore({ timeoutMs: 15_000 });
  });
}

function assertTrustedSender(senderUrl: string | undefined): void {
  if (!senderUrl || !isTrustedPageUrl(senderUrl)) {
    throw new Error('신뢰할 수 없는 화면에서 보낸 요청을 차단했습니다.');
  }
}

function isTrustedPageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (isDevelopment) {
      return url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port === '5173';
    }
    return url.protocol === 'file:' && path.resolve(fileURLToPath(url)) === productionPagePath;
  } catch {
    return false;
  }
}

function requireSenderWindow(sender: Electron.WebContents): BrowserWindow {
  const owner = BrowserWindow.fromWebContents(sender);
  if (!owner || owner !== mainWindow) {
    throw new Error('기본 Frostline Studio 창에서만 파일 작업을 요청할 수 있습니다.');
  }
  return owner;
}

async function runSmokePhase(): Promise<void> {
  if (!mainWindow || !smokePhase) {
    console.error('FROSTLINE_SMOKE_ERROR: missing smoke phase');
    app.exit(1);
    return;
  }

  try {
    const result = await mainWindow.webContents.executeJavaScript(`
      (async () => {
        const deadline = Date.now() + 3000;
        while (!document.querySelector('[aria-label="테마 실시간 미리보기"]')) {
          if (Date.now() > deadline) throw new Error('preview did not render');
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        // Let the renderer's initial debounced save finish before the smoke phase
        // writes its own state, otherwise a faster packaged startup can overwrite it.
        await new Promise((resolve) => setTimeout(resolve, 600));
        const state = await window.frostline.loadState();
        if (${JSON.stringify(smokePhase)} === 'write') {
          state.themes[0].name = 'Smoke Restart Theme';
          state.themes[0].values.brightness = 131;
          state.selectedThemeId = state.themes[0].id;
          await window.frostline.saveState(state);
          return 'write';
        }
        if (
          state.themes[0].name !== 'Smoke Restart Theme' ||
          state.themes[0].values.brightness !== 131
        ) {
          throw new Error('saved theme was not restored');
        }
        return 'verify';
      })()
    `);
    console.log(`FROSTLINE_SMOKE_${String(result).toUpperCase()}_OK`);
    app.exit(0);
  } catch (error) {
    console.error(`FROSTLINE_SMOKE_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    app.exit(1);
  }
}

async function captureScreenshot(): Promise<void> {
  if (!mainWindow || !screenshotOutputPath || path.extname(screenshotOutputPath) !== '.png') {
    console.error('FROSTLINE_SCREENSHOT_ERROR: invalid output path');
    app.exit(1);
    return;
  }

  try {
    await mainWindow.webContents.executeJavaScript(`
      (async () => {
        const deadline = Date.now() + 3000;
        while (!document.querySelector('[aria-label="테마 실시간 미리보기"]')) {
          if (Date.now() > deadline) throw new Error('preview did not render');
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const colorTab = [...document.querySelectorAll('[role="tab"]')]
          .find((element) => element.textContent?.trim() === '색상');
        colorTab?.click();
        const stableDeadline = Date.now() + 3000;
        while (
          document.querySelector('.boot-state') ||
          !document.querySelector('.editor-panel') ||
          colorTab?.getAttribute('aria-selected') !== 'true'
        ) {
          if (Date.now() > stableDeadline) throw new Error('editor did not become stable');
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        await new Promise((resolve) => setTimeout(resolve, 600));
      })()
    `);
    mainWindow.webContents.invalidate();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const image = await mainWindow.webContents.capturePage();
    if (image.isEmpty()) throw new Error('captured image is empty');
    const outputPath = path.resolve(screenshotOutputPath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, image.toPNG());
    console.log('FROSTLINE_SCREENSHOT_OK');
    app.exit(0);
  } catch (error) {
    console.error(
      `FROSTLINE_SCREENSHOT_ERROR: ${error instanceof Error ? error.message : String(error)}`,
    );
    app.exit(1);
  }
}

function readArgumentValue(prefix: string): string | undefined {
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}
