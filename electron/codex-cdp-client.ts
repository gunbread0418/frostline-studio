const MAX_DISCOVERY_BYTES = 256 * 1024;
const MAX_MESSAGE_BYTES = 2 * 1024 * 1024;
const MAIN_TARGET_URL = 'app://-/index.html';

export interface CodexCdpTarget {
  id: string;
  type: 'page';
  url: typeof MAIN_TARGET_URL;
  webSocketDebuggerUrl: string;
}

export interface CodexCdpGateway {
  waitForMainTarget(port: number, timeoutMs: number): Promise<CodexCdpTarget>;
  evaluate(
    target: CodexCdpTarget,
    expression: string,
    timeoutMs: number,
  ): Promise<unknown>;
}

export class CodexCdpClient implements CodexCdpGateway {
  async waitForMainTarget(port: number, timeoutMs: number): Promise<CodexCdpTarget> {
    validatePort(port);
    const deadline = Date.now() + boundedTimeout(timeoutMs);
    let lastError: unknown = new Error('CDP 대상이 아직 준비되지 않았습니다.');

    while (Date.now() < deadline) {
      try {
        return await this.discoverMainTarget(port, Math.min(1_000, deadline - Date.now()));
      } catch (error) {
        lastError = error;
      }
      await delay(Math.min(250, Math.max(0, deadline - Date.now())));
    }

    throw new Error(`Codex CDP 화면을 제한 시간 안에 찾지 못했습니다: ${safeDetail(lastError)}`);
  }

  async evaluate(
    target: CodexCdpTarget,
    expression: string,
    timeoutMs: number,
  ): Promise<unknown> {
    if (!isTarget(target)) throw new Error('검증되지 않은 Codex CDP 대상입니다.');
    if (!expression || Buffer.byteLength(expression, 'utf8') > 40 * 1024 * 1024) {
      throw new Error('Codex에 전달할 스타일 데이터의 크기가 올바르지 않습니다.');
    }

    const timeout = boundedTimeout(timeoutMs);
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(target.webSocketDebuggerUrl);
      let settled = false;
      const finish = (error?: Error, value?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.close();
        if (error) reject(error);
        else resolve(value);
      };
      const timer = setTimeout(
        () => finish(new Error('Codex CDP 스타일 적용 시간이 초과되었습니다.')),
        timeout,
      );

      socket.addEventListener('open', () => {
        socket.send(
          JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: {
              expression,
              awaitPromise: true,
              returnByValue: true,
            },
          }),
        );
      });
      socket.addEventListener('message', (event) => {
        if (typeof event.data !== 'string' || event.data.length > MAX_MESSAGE_BYTES) {
          finish(new Error('Codex CDP가 허용되지 않은 크기의 응답을 반환했습니다.'));
          return;
        }
        try {
          const message: unknown = JSON.parse(event.data);
          if (!isRecord(message) || message.id !== 1) return;
          if (isRecord(message.error)) {
            finish(new Error('Codex CDP가 스타일 적용 명령을 거부했습니다.'));
            return;
          }
          if (!isRecord(message.result)) {
            finish(new Error('Codex CDP 응답 형식이 올바르지 않습니다.'));
            return;
          }
          const result = message.result;
          if (isRecord(result.exceptionDetails)) {
            finish(new Error('Codex 화면에서 스타일 적용 중 예외가 발생했습니다.'));
            return;
          }
          const remote = result.result;
          finish(undefined, isRecord(remote) ? remote.value : undefined);
        } catch {
          finish(new Error('Codex CDP 응답을 해석할 수 없습니다.'));
        }
      });
      socket.addEventListener('error', () => {
        finish(new Error('Codex CDP WebSocket 연결에 실패했습니다.'));
      });
      socket.addEventListener('close', () => {
        if (!settled) finish(new Error('Codex CDP 연결이 결과 확인 전에 종료됐습니다.'));
      });
    });
  }

  private async discoverMainTarget(port: number, timeoutMs: number): Promise<CodexCdpTarget> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(50, timeoutMs));
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: controller.signal,
        redirect: 'error',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`CDP 검색 응답 ${response.status}`);
      const text = await response.text();
      if (!text || text.length > MAX_DISCOVERY_BYTES) {
        throw new Error('CDP 검색 결과의 크기가 올바르지 않습니다.');
      }
      const value: unknown = JSON.parse(text);
      if (!Array.isArray(value) || value.length > 32) {
        throw new Error('CDP 검색 결과의 형식이 올바르지 않습니다.');
      }
      const targets = value.filter((candidate): candidate is CodexCdpTarget =>
        isTarget(candidate, port),
      );
      if (targets.length !== 1) {
        throw new Error(`Codex 메인 화면이 ${targets.length}개 발견됐습니다.`);
      }
      return targets[0];
    } finally {
      clearTimeout(timer);
    }
  }
}

function isTarget(value: unknown, expectedPort?: number): value is CodexCdpTarget {
  if (!isRecord(value)) return false;
  if (
    value.type !== 'page' ||
    value.url !== MAIN_TARGET_URL ||
    typeof value.id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,256}$/.test(value.id) ||
    typeof value.webSocketDebuggerUrl !== 'string'
  ) {
    return false;
  }
  try {
    const url = new URL(value.webSocketDebuggerUrl);
    return (
      url.protocol === 'ws:' &&
      url.hostname === '127.0.0.1' &&
      (!expectedPort || Number(url.port) === expectedPort) &&
      /^\/devtools\/page\/[A-Za-z0-9_-]{1,256}$/.test(url.pathname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function boundedTimeout(value: number): number {
  return Math.max(1_000, Math.min(value, 20_000));
}

function validatePort(port: number): void {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Codex CDP 포트가 허용 범위를 벗어났습니다.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeDetail(error: unknown): string {
  return error instanceof Error && !/[\r\n]/.test(error.message)
    ? error.message.slice(0, 180)
    : '알 수 없는 오류';
}
