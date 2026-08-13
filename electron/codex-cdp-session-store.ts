import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const AUMID = /^[A-Za-z0-9._-]{1,180}![A-Za-z0-9._-]{1,80}$/;
const TARGET_ID = /^[A-Za-z0-9_-]{1,256}$/;
const MARKER = /^[a-f0-9]{32}$/;

export type CodexCdpSession =
  | {
      format: 'frostline-codex-cdp-session';
      version: 1;
      phase: 'waiting-for-exit';
      aumid: string;
      createdAt: string;
    }
  | {
      format: 'frostline-codex-cdp-session';
      version: 1;
      phase: 'armed';
      aumid: string;
      port: number;
      marker: string;
      createdAt: string;
    }
  | {
      format: 'frostline-codex-cdp-session';
      version: 1;
      phase: 'active';
      aumid: string;
      port: number;
      targetId: string;
      marker: string;
      createdAt: string;
    };

export interface CodexCdpSessionStore {
  load(): Promise<CodexCdpSession | null>;
  save(session: CodexCdpSession): Promise<void>;
  clear(): Promise<void>;
}

export class FileCodexCdpSessionStore implements CodexCdpSessionStore {
  readonly sessionPath: string;

  constructor(rootPath: string) {
    this.sessionPath = path.join(rootPath, 'codex-cdp-session.json');
  }

  async load(): Promise<CodexCdpSession | null> {
    try {
      const raw = await fs.readFile(this.sessionPath, 'utf8');
      const value: unknown = JSON.parse(raw);
      if (!isCodexCdpSession(value)) {
        throw new Error('저장된 Codex CDP 세션 정보의 형식이 올바르지 않습니다.');
      }
      return value;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(session: CodexCdpSession): Promise<void> {
    if (!isCodexCdpSession(session)) {
      throw new Error('저장할 Codex CDP 세션 정보의 형식이 올바르지 않습니다.');
    }
    await fs.mkdir(path.dirname(this.sessionPath), { recursive: true });
    const temporaryPath = `${this.sessionPath}.${randomUUID()}.tmp`;
    try {
      const handle = await fs.open(temporaryPath, 'wx');
      try {
        await handle.writeFile(`${JSON.stringify(session, null, 2)}\n`, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.rename(temporaryPath, this.sessionPath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async clear(): Promise<void> {
    await fs.unlink(this.sessionPath).catch((error: unknown) => {
      if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
    });
  }
}

export function createWaitingSession(aumid: string): CodexCdpSession {
  return baseSession('waiting-for-exit', aumid);
}

export function createArmedSession(aumid: string, port: number, marker: string): CodexCdpSession {
  return { ...baseSession('armed', aumid), port, marker };
}

export function createActiveSession(
  aumid: string,
  port: number,
  targetId: string,
  marker: string,
): CodexCdpSession {
  return {
    ...baseSession('active', aumid),
    port,
    targetId,
    marker,
  };
}

function baseSession<TPhase extends CodexCdpSession['phase']>(phase: TPhase, aumid: string) {
  return {
    format: 'frostline-codex-cdp-session' as const,
    version: 1 as const,
    phase,
    aumid,
    createdAt: new Date().toISOString(),
  };
}

function isCodexCdpSession(value: unknown): value is CodexCdpSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<CodexCdpSession>;
  if (
    candidate.format !== 'frostline-codex-cdp-session' ||
    candidate.version !== 1 ||
    !candidate.aumid ||
    !AUMID.test(candidate.aumid) ||
    typeof candidate.createdAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(candidate.createdAt)
  ) {
    return false;
  }
  if (candidate.phase === 'waiting-for-exit') {
    return Object.keys(candidate).length === 5;
  }
  if (
    (candidate.phase === 'armed' || candidate.phase === 'active') &&
    (!Number.isInteger(candidate.port) || Number(candidate.port) < 1024 || Number(candidate.port) > 65535)
  ) {
    return false;
  }
  if (candidate.phase === 'armed') {
    return (
      typeof candidate.marker === 'string' &&
      MARKER.test(candidate.marker) &&
      Object.keys(candidate).length === 7
    );
  }
  return (
    candidate.phase === 'active' &&
    typeof candidate.targetId === 'string' &&
    TARGET_ID.test(candidate.targetId) &&
    typeof candidate.marker === 'string' &&
    MARKER.test(candidate.marker) &&
    Object.keys(candidate).length === 8
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
