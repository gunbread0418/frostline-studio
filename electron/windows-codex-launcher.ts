import { spawn } from 'node:child_process';
import path from 'node:path';

const AUMID = /^[A-Za-z0-9._-]{1,180}![A-Za-z0-9._-]{1,80}$/;

export interface CodexProcessInspection {
  running: boolean;
  aumid: string | null;
}

export interface CodexPortOwner {
  ownerPid: number;
  aumid: string;
}

export interface CodexLauncherGateway {
  inspect(timeoutMs: number): Promise<CodexProcessInspection>;
  launch(aumid: string, port: number, timeoutMs: number): Promise<{ activationPid: number }>;
  getPortOwner(port: number, timeoutMs: number): Promise<CodexPortOwner>;
}

export class WindowsCodexLauncher implements CodexLauncherGateway {
  constructor(private readonly helperPath: string) {
    if (!path.isAbsolute(helperPath) || path.extname(helperPath).toLowerCase() !== '.exe') {
      throw new Error('Codex 실행 보조 프로그램 경로가 올바르지 않습니다.');
    }
  }

  async inspect(timeoutMs: number): Promise<CodexProcessInspection> {
    const result = await this.run(['--action=inspect'], timeoutMs);
    if (
      typeof result.running !== 'boolean' ||
      (result.aumid !== null && (typeof result.aumid !== 'string' || !AUMID.test(result.aumid)))
    ) {
      throw new Error('Codex 실행 상태 응답이 올바르지 않습니다.');
    }
    return { running: result.running, aumid: result.aumid };
  }

  async launch(
    aumid: string,
    port: number,
    timeoutMs: number,
  ): Promise<{ activationPid: number }> {
    if (!AUMID.test(aumid)) throw new Error('Codex 앱 식별자가 올바르지 않습니다.');
    validatePort(port);
    const encodedAumid = Buffer.from(aumid, 'utf8').toString('base64');
    const result = await this.run(
      ['--action=launch', `--aumid=${encodedAumid}`, `--port=${port}`],
      timeoutMs,
    );
    if (!Number.isInteger(result.activationPid) || Number(result.activationPid) <= 0) {
      throw new Error('Codex CDP 실행 결과에 유효한 PID가 없습니다.');
    }
    return { activationPid: Number(result.activationPid) };
  }

  async getPortOwner(port: number, timeoutMs: number): Promise<CodexPortOwner> {
    validatePort(port);
    const result = await this.run(['--action=owner', `--port=${port}`], timeoutMs);
    if (
      !Number.isInteger(result.ownerPid) ||
      Number(result.ownerPid) <= 0 ||
      typeof result.aumid !== 'string' ||
      !AUMID.test(result.aumid)
    ) {
      throw new Error('Codex CDP 포트 소유자 응답이 올바르지 않습니다.');
    }
    return { ownerPid: Number(result.ownerPid), aumid: result.aumid };
  }

  private run(argumentsList: string[], timeoutMs: number): Promise<Record<string, unknown>> {
    const timeout = Math.max(1_000, Math.min(timeoutMs, 20_000));
    return new Promise((resolve, reject) => {
      const child = spawn(this.helperPath, argumentsList, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (error?: Error, value?: Record<string, unknown>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(value ?? {});
      };
      const timer = setTimeout(() => {
        child.kill();
        finish(new Error('Codex 실행 보조 프로그램의 응답 시간이 초과되었습니다.'));
      }, timeout);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        if (stdout.length + chunk.length <= 16_384) stdout += chunk;
      });
      child.stderr.on('data', (chunk: string) => {
        if (stderr.length + chunk.length <= 2_048) stderr += chunk;
      });
      child.on('error', () => finish(new Error('Codex 실행 보조 프로그램을 시작하지 못했습니다.')));
      child.on('close', (code) => {
        if (code !== 0) {
          finish(new Error(helperFailureMessage(stderr)));
          return;
        }
        try {
          const encoded = stdout.trim();
          if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length > 16_384) {
            throw new Error('invalid-output');
          }
          const value: unknown = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
          if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error('invalid-output');
          }
          finish(undefined, value as Record<string, unknown>);
        } catch {
          finish(new Error('Codex 실행 보조 프로그램이 잘못된 응답을 반환했습니다.'));
        }
      });
    });
  }
}

function helperFailureMessage(stderr: string): string {
  const messages: Record<string, string> = {
    'ambiguous-codex-identity': '실행 중인 Codex 앱 식별자가 하나로 확인되지 않습니다.',
    'codex-already-running': 'Codex가 아직 실행 중입니다. 사용자가 직접 완전히 종료한 뒤 다시 눌러 주세요.',
    'invalid-aumid': '저장된 Codex 앱 식별자가 올바르지 않습니다.',
    'invalid-port': '선택한 CDP 포트가 올바르지 않습니다.',
    'port-owner-not-found': 'CDP 포트의 소유 프로세스를 확인하지 못했습니다.',
    'port-owner-not-packaged': 'CDP 포트를 연 프로세스가 확인된 Codex 패키지가 아닙니다.',
    'activation-failed': 'Windows가 Codex를 CDP 모드로 실행하지 못했습니다.',
  };
  const code = Object.keys(messages).find((candidate) => stderr.includes(candidate));
  return code ? messages[code] : 'Codex 실행 보조 프로그램이 실패했습니다.';
}

function validatePort(port: number): void {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Codex CDP 포트가 허용 범위를 벗어났습니다.');
  }
}
