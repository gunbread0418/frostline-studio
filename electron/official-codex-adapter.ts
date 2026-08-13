import { randomBytes } from 'node:crypto';
import net from 'node:net';
import type {
  ApplyStage,
  ApplyResult,
  OfficialCodexAdapter as OfficialCodexAdapterContract,
} from '../src/shared/adapters';
import { OFFICIAL_CODEX_CAPABILITIES } from '../src/shared/adapters';
import type { OfficialCodexStatus } from '../src/shared/ipc';
import type { ThemeRecord } from '../src/shared/theme';
import type { CodexCdpGateway, CodexCdpTarget } from './codex-cdp-client';
import {
  createActiveSession,
  createArmedSession,
  createWaitingSession,
  type CodexCdpSession,
  type CodexCdpSessionStore,
} from './codex-cdp-session-store';
import {
  buildApplyExpression,
  buildCompatibilityProbeExpression,
  buildRemoveExpression,
  compileCodexSkin,
} from './codex-skin';
import type { CodexLauncherGateway } from './windows-codex-launcher';

const DEFAULT_TIMEOUT_MS = 15_000;

export class OfficialCodexAdapter implements OfficialCodexAdapterContract {
  readonly kind = 'official-codex' as const;
  readonly capabilities = OFFICIAL_CODEX_CAPABILITIES;
  private operationInFlight = false;

  constructor(
    private readonly launcher: CodexLauncherGateway,
    private readonly cdp: CodexCdpGateway,
    private readonly sessionStore: CodexCdpSessionStore,
    private readonly resolveAssetPath: (assetId: string) => string,
    private readonly platform = process.platform,
  ) {}

  async getStatus(): Promise<OfficialCodexStatus> {
    const available = this.platform === 'win32';
    if (!available) {
      return {
        available: false,
        canRestore: false,
        requiresCodexExit: false,
        phase: 'unavailable',
        experimental: true,
        message: 'Windows에서만 사용할 수 있습니다.',
      };
    }
    const session = await this.sessionStore.load();
    if (session?.phase === 'waiting-for-exit') {
      return {
        available: true,
        canRestore: true,
        requiresCodexExit: true,
        phase: 'waiting-for-exit',
        experimental: true,
        message: 'Codex를 사용자가 직접 완전히 종료한 뒤 적용 버튼을 다시 눌러 주세요.',
      };
    }
    if (session?.phase === 'armed') {
      return {
        available: true,
        canRestore: true,
        requiresCodexExit: false,
        phase: 'armed',
        experimental: true,
        message: 'CDP 세션이 준비됐습니다. 실패했다면 수동 재시도하거나 복원할 수 있습니다.',
      };
    }
    if (session?.phase === 'active') {
      return {
        available: true,
        canRestore: true,
        requiresCodexExit: false,
        phase: 'active',
        experimental: true,
        message: 'Frostline 사진 스킨이 현재 Codex 세션에 적용돼 있습니다.',
      };
    }
    return {
      available: true,
      canRestore: false,
      requiresCodexExit: false,
      phase: 'ready',
      experimental: true,
      message: '사진 스킨을 한 번 적용할 준비가 됐습니다.',
    };
  }

  async apply(
    theme: ThemeRecord,
    options: { timeoutMs: number } = { timeoutMs: DEFAULT_TIMEOUT_MS },
  ): Promise<ApplyResult> {
    return this.runExclusive(async () => {
      this.assertWindows();
      const timeoutMs = boundedTimeout(options.timeoutMs);
      let stage: ApplyStage = 'inspect';
      let session = await this.sessionStore.load();
      const inspection = await this.launcher.inspect(Math.min(timeoutMs, 4_000));
      if (session?.phase === 'active') {
        if (inspection.running) {
          return this.result(
            false,
            inspection.aumid === session.aumid
              ? '이미 현재 Codex 세션에 스킨이 적용돼 있습니다. 먼저 복원해 주세요.'
              : '현재 Codex가 적용 당시 확인한 앱과 달라 작업을 중단했습니다.',
            session,
            false,
            'inspect',
          );
        }
        session = createWaitingSession(session.aumid);
        await this.sessionStore.save(session);
      }
      if (inspection.running && session?.phase !== 'armed') {
        if (!inspection.aumid) {
          return this.result(false, '실행 중인 Codex의 Windows 앱 식별자를 확인하지 못했습니다.', session, false, 'inspect');
        }
        if (session && session.aumid !== inspection.aumid) {
          return this.result(false, '실행 중인 Codex가 이전에 확인한 앱과 다릅니다.', session, false, 'inspect');
        }
        session = createWaitingSession(inspection.aumid);
        await this.sessionStore.save(session);
        return this.result(
          false,
          'Codex를 Frostline이 종료하지 않습니다. 작업을 저장하고 트레이 메뉴에서 Codex를 직접 완전히 종료한 뒤 적용 버튼을 다시 눌러 주세요.',
          session,
          true,
          'waiting-for-exit',
        );
      }

      const marker = randomBytes(16).toString('hex');
      let skin;
      try {
        skin = await compileCodexSkin(theme, marker, this.resolveAssetPath);
      } catch (error) {
        return this.result(
          false,
          safeErrorMessage(error),
          session,
          false,
          'image-compile',
          'image-compile-failed',
        );
      }
      const aumid = session?.aumid ?? inspection.aumid;
      if (!aumid) {
        return this.result(
          false,
          'Codex 앱 식별 정보가 없습니다. Codex를 일반 모드로 한 번 실행한 상태에서 다시 시작해 주세요.',
          session,
          false,
          'inspect',
        );
      }

      let port: number;
      if (session?.phase === 'armed' && inspection.running) {
        port = session.port;
        session = createArmedSession(aumid, port, marker);
        await this.sessionStore.save(session);
      } else {
        if (inspection.running) {
          return this.result(
            false,
            'Codex가 아직 실행 중입니다. 사용자가 직접 완전히 종료한 뒤 다시 눌러 주세요.',
            session,
            true,
            'waiting-for-exit',
          );
        }
        stage = 'launch';
        port = await reserveLoopbackPort();
        await this.launcher.launch(aumid, port, Math.min(timeoutMs, 5_000));
        session = createArmedSession(aumid, port, marker);
        await this.sessionStore.save(session);
      }

      let target: CodexCdpTarget | null = null;
      try {
        stage = 'port-owner';
        await this.waitForVerifiedOwner(aumid, port, timeoutMs);
        stage = 'target-discovery';
        target = await this.cdp.waitForMainTarget(port, timeoutMs);
        stage = 'compatibility';
        const compatibility = await this.cdp.evaluate(
          target,
          buildCompatibilityProbeExpression(),
          Math.min(timeoutMs, 4_000),
        );
        if (!isCompatibilityVerification(compatibility)) {
          throw new AdapterStageError(
            'compatibility',
            'codex-profile-mismatch',
            '현재 Codex 화면 구조가 검증된 호환성 프로필과 달라 적용을 중단했습니다.',
          );
        }
        stage = 'style-install';
        const observed = await this.cdp.evaluate(target, buildApplyExpression(skin), timeoutMs);
        if (!isApplyVerification(observed, marker)) {
          throw verificationError(observed, stage);
        }
        const active = createActiveSession(aumid, port, target.id, marker);
        await this.sessionStore.save(active);
        return this.result(
          true,
          '선택한 사진과 색상을 현재 Codex 화면에 적용하고 결과를 확인했습니다.',
          active,
          false,
          'complete',
        );
      } catch (error) {
        if (target) {
          await this.cdp
            .evaluate(target, buildRemoveExpression(marker), Math.min(timeoutMs, 3_000))
            .catch(() => undefined);
        }
        const failure = normalizeStageError(error, stage);
        return this.result(
          false,
          `${failure.message} 자동 재시도하지 않습니다. 수동 재시도 또는 복원을 선택해 주세요.`,
          session,
          false,
          failure.stage,
          failure.code,
        );
      }
    });
  }

  async update(
    theme: ThemeRecord,
    options: { timeoutMs: number } = { timeoutMs: 8_000 },
  ): Promise<ApplyResult> {
    return this.runExclusive(async () => {
      this.assertWindows();
      const timeoutMs = boundedTimeout(options.timeoutMs);
      const session = await this.sessionStore.load();
      if (!session || session.phase !== 'active') {
        return this.result(
          false,
          '라이브 갱신에 사용할 활성 Codex 세션이 없습니다.',
          session,
          false,
          'live-update',
          'active-session-missing',
        );
      }
      try {
        const inspection = await this.launcher.inspect(Math.min(timeoutMs, 3_000));
        if (!inspection.running || inspection.aumid !== session.aumid) {
          throw new AdapterStageError(
            'live-update',
            'codex-session-changed',
            '현재 Codex 세션이 적용 당시 확인한 세션과 달라 라이브 갱신을 중단했습니다.',
          );
        }
        await this.waitForVerifiedOwner(session.aumid, session.port, timeoutMs);
        const target = await this.cdp.waitForMainTarget(session.port, timeoutMs);
        if (target.id !== session.targetId) {
          throw new AdapterStageError(
            'live-update',
            'target-changed',
            'Codex 기본 화면 대상이 바뀌어 라이브 갱신을 중단했습니다.',
          );
        }
        const compatibility = await this.cdp.evaluate(
          target,
          buildCompatibilityProbeExpression(),
          Math.min(timeoutMs, 3_000),
        );
        if (!isCompatibilityVerification(compatibility)) {
          throw new AdapterStageError(
            'compatibility',
            'codex-profile-mismatch',
            '현재 Codex 화면 구조가 검증된 호환성 프로필과 다릅니다.',
          );
        }
        const skin = await compileCodexSkin(theme, session.marker, this.resolveAssetPath);
        const observed = await this.cdp.evaluate(target, buildApplyExpression(skin), timeoutMs);
        if (!isApplyVerification(observed, session.marker)) {
          throw verificationError(observed, 'live-update');
        }
        return this.result(
          true,
          '변경한 테마를 현재 Codex 화면에 바로 반영했습니다.',
          session,
          false,
          'live-update',
        );
      } catch (error) {
        const failure = normalizeStageError(error, 'live-update');
        return this.result(
          false,
          `${failure.message} 이전에 정상 적용된 화면은 유지합니다. 자동 재시도하지 않습니다.`,
          session,
          false,
          failure.stage,
          failure.code,
        );
      }
    });
  }

  async restore(
    options: { timeoutMs: number } = { timeoutMs: DEFAULT_TIMEOUT_MS },
  ): Promise<ApplyResult> {
    return this.runExclusive(async () => {
      this.assertWindows();
      const session = await this.sessionStore.load();
      if (!session) return this.result(false, '복원할 Frostline Codex 세션이 없습니다.', null, false, 'restore');
      if (session.phase === 'waiting-for-exit') {
        await this.sessionStore.clear();
        return this.result(true, '대기 중이던 Codex 적용을 취소했습니다.', null, false, 'restore');
      }

      const inspection = await this.launcher.inspect(Math.min(options.timeoutMs, 4_000));
      if (!inspection.running) {
        await this.sessionStore.clear();
        return this.result(true, 'Codex 세션이 이미 종료돼 사진 스킨도 사라졌습니다.', null, false, 'restore');
      }
      if (inspection.aumid !== session.aumid) {
        return this.result(false, '현재 Codex가 적용 당시 확인한 앱과 달라 복원을 중단했습니다.', session, false, 'restore');
      }

      try {
        await this.waitForVerifiedOwner(session.aumid, session.port, options.timeoutMs);
        const target = await this.cdp.waitForMainTarget(session.port, options.timeoutMs);
        const marker = session.marker;
        const observed = await this.cdp.evaluate(
          target,
          buildRemoveExpression(marker),
          options.timeoutMs,
        );
        if (!isRemoveVerification(observed)) {
          throw new Error('Codex가 스킨 제거 결과를 확인하지 못했습니다.');
        }
        await this.sessionStore.clear();
        return this.result(
          true,
          '현재 Codex 화면에서 Frostline 사진 스킨을 제거했습니다. CDP 포트는 사용자가 Codex를 정상 종료할 때 닫힙니다.',
          null,
          false,
          'restore',
        );
      } catch (error) {
        return this.result(false, safeErrorMessage(error), session, false, 'restore');
      }
    });
  }

  private async waitForVerifiedOwner(
    expectedAumid: string,
    port: number,
    timeoutMs: number,
  ): Promise<void> {
    const deadline = Date.now() + boundedTimeout(timeoutMs);
    let lastError: unknown = new Error('CDP 포트가 아직 준비되지 않았습니다.');
    while (Date.now() < deadline) {
      try {
        const owner = await this.launcher.getPortOwner(port, Math.min(2_000, deadline - Date.now()));
        if (owner.aumid !== expectedAumid) {
          throw new Error('CDP 포트를 연 프로세스가 확인한 Codex 앱과 다릅니다.');
        }
        return;
      } catch (error) {
        lastError = error;
      }
      await delay(Math.min(250, Math.max(0, deadline - Date.now())));
    }
    throw new Error(`Codex CDP 포트 소유자를 확인하지 못했습니다: ${safeErrorMessage(lastError)}`);
  }

  private async runExclusive(operation: () => Promise<ApplyResult>): Promise<ApplyResult> {
    if (this.operationInFlight) {
      return this.result(false, 'Codex 스킨 작업이 이미 한 번 진행 중입니다.', await this.sessionStore.load());
    }
    this.operationInFlight = true;
    try {
      return await operation();
    } catch (error) {
      const session = await this.sessionStore.load().catch(() => null);
      return this.result(false, safeErrorMessage(error), session);
    } finally {
      this.operationInFlight = false;
    }
  }

  private assertWindows(): void {
    if (this.platform !== 'win32') throw new Error('Codex 사진 스킨은 Windows에서만 사용할 수 있습니다.');
  }

  private result(
    ok: boolean,
    message: string,
    session: CodexCdpSession | null | undefined,
    requiresCodexExit = false,
    stage?: ApplyStage,
    diagnosticCode?: string,
  ): ApplyResult {
    return {
      ok,
      message,
      attemptedAt: new Date().toISOString(),
      canRestore: Boolean(session),
      requiresCodexExit,
      phase: session?.phase ?? 'ready',
      stage,
      diagnosticCode,
    };
  }
}

async function reserveLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else if (port < 1024 || port > 65535) reject(new Error('사용 가능한 로컬 포트를 찾지 못했습니다.'));
        else resolve(port);
      });
    });
  });
}

function isApplyVerification(value: unknown, marker: string): boolean {
  return (
    isRecord(value) &&
    value.ok === true &&
    value.stage === 'complete' &&
    value.marker === marker
  );
}

function isCompatibilityVerification(value: unknown): boolean {
  return isRecord(value) && value.ok === true && value.profile === 'codex-electron-v1';
}

function isRemoveVerification(value: unknown): boolean {
  return isRecord(value) && value.ok === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedTimeout(value: number): number {
  return Math.max(1_000, Math.min(value, 20_000));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length <= 300 && !/[\r\n]/.test(error.message)) {
    return error.message;
  }
  return 'Codex 사진 스킨 작업에 실패했습니다.';
}

class AdapterStageError extends Error {
  constructor(
    readonly stage: ApplyStage,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function verificationError(value: unknown, fallbackStage: ApplyStage): AdapterStageError {
  if (isRecord(value)) {
    const stage = isApplyStage(value.stage) ? value.stage : fallbackStage;
    const code = typeof value.reason === 'string' ? value.reason.slice(0, 80) : 'verification-failed';
    const labels: Partial<Record<ApplyStage, string>> = {
      compatibility: 'Codex 화면 구조 확인에 실패했습니다.',
      'style-install': 'Codex에 테마 스타일을 설치하지 못했습니다.',
      'image-decode': 'Codex가 배경 사진을 디코딩하지 못했습니다.',
      'visibility-check': '배경 사진 레이어가 화면에 표시되는지 확인하지 못했습니다.',
      'live-update': '변경한 테마를 현재 Codex 화면에서 확인하지 못했습니다.',
    };
    return new AdapterStageError(stage, code, labels[stage] ?? 'Codex 적용 결과를 확인하지 못했습니다.');
  }
  return new AdapterStageError(fallbackStage, 'invalid-verification', 'Codex 적용 확인 응답이 올바르지 않습니다.');
}

function normalizeStageError(
  error: unknown,
  fallbackStage: ApplyStage,
): { stage: ApplyStage; code: string; message: string } {
  if (error instanceof AdapterStageError) {
    return { stage: error.stage, code: error.code, message: error.message };
  }
  return { stage: fallbackStage, code: 'operation-failed', message: safeErrorMessage(error) };
}

function isApplyStage(value: unknown): value is ApplyStage {
  return [
    'inspect',
    'waiting-for-exit',
    'launch',
    'port-owner',
    'target-discovery',
    'compatibility',
    'image-compile',
    'style-install',
    'image-decode',
    'visibility-check',
    'complete',
    'live-update',
    'restore',
  ].includes(String(value));
}
