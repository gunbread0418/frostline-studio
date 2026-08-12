import { app, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { IPC_CHANNELS } from '../src/shared/ipc';
import { ThemeStore } from './theme-store';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'frostline-asset',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

const isDevelopment = process.argv.includes('--dev');
const isSmokeTest = process.argv.includes('--smoke-test');
const smokeUserDataPath = readArgumentValue('--smoke-user-data=');
const smokePhase = readArgumentValue('--smoke-phase=');
const productionPagePath = path.resolve(__dirname, '../../dist/index.html');
let mainWindow: BrowserWindow | null = null;
let store: ThemeStore;

if (smokeUserDataPath) {
  app.setPath('userData', path.resolve(smokeUserDataPath));
}
if (isSmokeTest) {
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
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedPageUrl(url)) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => {
    if (!isSmokeTest) mainWindow?.show();
  });
  mainWindow.webContents.once('did-finish-load', () => {
    if (isSmokeTest) void runSmokePhase();
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

function readArgumentValue(prefix: string): string | undefined {
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}
