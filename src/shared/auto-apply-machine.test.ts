import { describe, expect, it } from 'vitest';
import { transitionAutoApply, type AutoApplyState } from './auto-apply-machine';

describe('automatic apply safety state machine', () => {
  it('handles one process id at most once', () => {
    let state: AutoApplyState = { status: 'disabled' };
    state = transitionAutoApply(state, { type: 'ENABLE' });
    state = transitionAutoApply(state, { type: 'CODEX_STARTED', processId: 4120 });
    state = transitionAutoApply(state, { type: 'APPLY_SUCCEEDED', processId: 4120 });

    expect(state.status).toBe('applied');
    if (state.status !== 'applied') return;

    const waiting: AutoApplyState = {
      status: 'waiting-for-codex',
      handledProcessIds: state.handledProcessIds,
    };
    expect(
      transitionAutoApply(waiting, { type: 'CODEX_STARTED', processId: 4120 }),
    ).toEqual(waiting);
  });

  it('opens the circuit after the first failure and only manual retry unlocks it', () => {
    let state: AutoApplyState = { status: 'waiting-for-codex', handledProcessIds: [] };
    state = transitionAutoApply(state, { type: 'CODEX_STARTED', processId: 9001 });
    state = transitionAutoApply(state, {
      type: 'APPLY_FAILED',
      processId: 9001,
      reason: 'timeout',
    });

    expect(state.status).toBe('circuit-open');
    expect(transitionAutoApply(state, { type: 'ENABLE' })).toEqual(state);
    expect(transitionAutoApply(state, { type: 'MANUAL_RETRY' }).status).toBe(
      'waiting-for-codex',
    );
  });

  it('makes emergency stop terminal in the current session', () => {
    const stopped = transitionAutoApply(
      { status: 'waiting-for-codex', handledProcessIds: [] },
      { type: 'EMERGENCY_STOP' },
    );
    expect(stopped).toEqual({ status: 'emergency-stopped' });
    expect(transitionAutoApply(stopped, { type: 'ENABLE' })).toEqual(stopped);
  });
});

