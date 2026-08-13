import { constants, promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  LEGACY_THEME_FILE_VERSION,
  THEME_FILE_VERSION,
  createInitialState,
  type StudioState,
  type ThemeExportDocument,
  type ThemeRecord,
} from '../src/shared/theme';
import {
  assertStudioState,
  assertThemeRecord,
  isManagedAssetId,
  parseStudioState,
  parseThemeRecord,
} from '../src/shared/validation';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_IMPORT_BYTES = 36 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp']);
const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

export interface ImportedThemeResult {
  theme: ThemeRecord;
  sourceName: string;
}

export class ThemeStore {
  readonly imagesPath: string;
  readonly statePath: string;
  private saveQueue: Promise<void> = Promise.resolve();

  constructor(readonly rootPath: string) {
    this.imagesPath = path.join(rootPath, 'images');
    this.statePath = path.join(rootPath, 'themes.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.imagesPath, { recursive: true });
  }

  async load(): Promise<StudioState> {
    await this.initialize();
    try {
      const raw = await fs.readFile(this.statePath, 'utf8');
      const value: unknown = JSON.parse(raw);
      const state = parseStudioState(value);
      if (isLegacyVersion(value)) {
        await atomicWriteJson(this.statePath, state);
      }
      return state;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return createInitialState();
      }
      throw error;
    }
  }

  save(value: unknown): Promise<void> {
    assertStudioState(value);
    const state = structuredClone(value);
    const operation = this.saveQueue.then(async () => {
      await this.initialize();
      await atomicWriteJson(this.statePath, state);
      await this.pruneUnreferencedImages(state);
    });
    this.saveQueue = operation.catch(() => undefined);
    return operation;
  }

  async copyImage(sourcePath: string): Promise<{ assetId: string; originalName: string; url: string }> {
    await this.initialize();
    const extension = path.extname(sourcePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      throw new Error('PNG, JPG, JPEG, WebP, BMP 사진만 선택할 수 있습니다.');
    }

    const stat = await fs.stat(sourcePath);
    if (!stat.isFile() || stat.size === 0 || stat.size > MAX_IMAGE_BYTES) {
      throw new Error('사진은 비어 있지 않은 25MB 이하 파일이어야 합니다.');
    }

    const assetId = `${randomUUID()}${extension}`;
    const targetPath = this.resolveAssetPath(assetId);
    await fs.copyFile(sourcePath, targetPath, constants.COPYFILE_EXCL);
    return {
      assetId,
      originalName: path.basename(sourcePath),
      url: `frostline-asset://image/${assetId}`,
    };
  }

  resolveAssetPath(assetId: string): string {
    if (!isManagedAssetId(assetId)) {
      throw new Error('허용되지 않은 이미지 식별자입니다.');
    }
    const resolved = path.resolve(this.imagesPath, assetId);
    const expectedParent = `${path.resolve(this.imagesPath)}${path.sep}`;
    if (!resolved.startsWith(expectedParent)) {
      throw new Error('앱 이미지 폴더 밖에는 접근할 수 없습니다.');
    }
    return resolved;
  }

  async exportTheme(themeValue: unknown, destinationPath: string): Promise<void> {
    assertThemeRecord(themeValue);
    let image: ThemeExportDocument['theme']['image'] = null;

    if (themeValue.image) {
      const extension = path.extname(themeValue.image.assetId).toLowerCase();
      const bytes = await fs.readFile(this.resolveAssetPath(themeValue.image.assetId));
      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        throw new Error('내보낼 사진이 25MB 제한을 초과합니다.');
      }
      image = {
        originalName: themeValue.image.originalName,
        mimeType: MIME_BY_EXTENSION[extension] ?? 'application/octet-stream',
        dataBase64: bytes.toString('base64'),
      };
    }

    const document: ThemeExportDocument = {
      format: 'frostline-theme',
      version: THEME_FILE_VERSION,
      exportedAt: new Date().toISOString(),
      theme: { ...themeValue, image },
    };
    await atomicWriteJson(destinationPath, document);
  }

  async importTheme(sourcePath: string): Promise<ImportedThemeResult> {
    await this.initialize();
    const stat = await fs.stat(sourcePath);
    if (!stat.isFile() || stat.size === 0 || stat.size > MAX_IMPORT_BYTES) {
      throw new Error('테마 파일은 비어 있지 않은 36MB 이하 파일이어야 합니다.');
    }

    const raw = await fs.readFile(sourcePath, 'utf8');
    const document = parseExportDocument(JSON.parse(raw));

    const id = randomUUID();
    const now = new Date().toISOString();
    let image: ThemeRecord['image'] = null;
    if (document.theme.image) {
      const extension = extensionForMime(document.theme.image.mimeType);
      const bytes = Buffer.from(document.theme.image.dataBase64, 'base64');
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
        throw new Error('가져온 사진이 비어 있거나 25MB 제한을 초과합니다.');
      }
      const assetId = `${randomUUID()}${extension}`;
      await fs.writeFile(this.resolveAssetPath(assetId), bytes, { flag: 'wx' });
      image = {
        assetId,
        originalName: document.theme.image.originalName,
        url: `frostline-asset://image/${assetId}`,
      };
    }

    const theme: ThemeRecord = {
      ...document.theme,
      id,
      name: `${document.theme.name} (가져옴)`.slice(0, 80),
      image,
      createdAt: now,
      updatedAt: now,
    };
    assertThemeRecord(theme);
    return { theme, sourceName: path.basename(sourcePath) };
  }

  private async pruneUnreferencedImages(state: StudioState): Promise<void> {
    const referenced = new Set(
      state.themes.flatMap((theme) => (theme.image ? [theme.image.assetId] : [])),
    );
    const entries = await fs.readdir(this.imagesPath, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        if (entry.isFile() && isManagedAssetId(entry.name) && !referenced.has(entry.name)) {
          await fs.unlink(this.resolveAssetPath(entry.name));
        }
      }),
    );
  }
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  const body = `${JSON.stringify(value, null, 2)}\n`;
  try {
    const handle = await fs.open(temporaryPath, 'wx');
    try {
      await handle.writeFile(body, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function parseExportDocument(value: unknown): ThemeExportDocument {
  if (!value || typeof value !== 'object') {
    throw new Error('지원하지 않는 Frostline Studio 테마 파일입니다.');
  }
  const candidate = value as Partial<ThemeExportDocument>;
  if (
    candidate.format !== 'frostline-theme' ||
    (candidate.version !== THEME_FILE_VERSION &&
      candidate.version !== LEGACY_THEME_FILE_VERSION) ||
    typeof candidate.exportedAt !== 'string' ||
    !candidate.theme ||
    typeof candidate.theme !== 'object'
  ) {
    throw new Error('지원하지 않는 Frostline Studio 테마 파일입니다.');
  }

  const image = candidate.theme.image;
  const themeWithoutImage = { ...candidate.theme, image: null };
  const normalizedTheme = parseThemeRecord(themeWithoutImage);
  if (
    image !== null &&
    !(
      typeof image === 'object' &&
      typeof image.originalName === 'string' &&
      image.originalName.length > 0 &&
      image.originalName.length <= 255 &&
      typeof image.mimeType === 'string' &&
      ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'].includes(image.mimeType) &&
      typeof image.dataBase64 === 'string' &&
      image.dataBase64.length > 0
    )
  ) {
    throw new Error('지원하지 않는 Frostline Studio 테마 파일입니다.');
  }
  return {
    format: 'frostline-theme',
    version: THEME_FILE_VERSION,
    exportedAt: candidate.exportedAt,
    theme: { ...normalizedTheme, image: image ?? null },
  };
}

function extensionForMime(mimeType: string): string {
  const match = Object.entries(MIME_BY_EXTENSION).find(([, mime]) => mime === mimeType);
  if (!match) throw new Error('지원하지 않는 이미지 형식입니다.');
  return match[0] === '.jpeg' ? '.jpg' : match[0];
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isLegacyVersion(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === LEGACY_THEME_FILE_VERSION
  );
}
