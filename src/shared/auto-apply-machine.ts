export type AutoApplyState =
  | { status: 'disabled' }
  | { status: 'waiting-for-codex'; handledProcessIds: number[] }
  | { status: 'applying'; processId: number; handledProcessIds: number[] }
  | { status: 'applied'; processId: number; handledProcessIds: number[] }
  | { status: 'circuit-open'; processId: number; reason: string; handledProcessIds: number[] }
  | { status: 'emergency-stopped' };

export type AutoApplyEvent =
  | { type: 'ENABLE' }
  | { type: 'DISABLE' }
  | { type: 'CODEX_STARTED'; processId: number }
  | { type: 'APPLY_SUCCEEDED'; processId: number }
  | { type: 'APPLY_FAILED'; processId: number; reason: string }
  | { type: 'MANUAL_RETRY' }
  | { type: 'EMERGENCY_STOP' };

const markHandled = (ids: number[], processId: number) =>
  ids.includes(processId) ? ids : [...ids, processId];

export function transitionAutoApply(
  state: AutoApplyState,
  event: AutoApplyEvent,
): AutoApplyState {
  if (event.type === 'EMERGENCY_STOP') {
    return { status: 'emergency-stopped' };
  }

  if (event.type === 'DISABLE') {
    return { status: 'disabled' };
  }

  if (state.status === 'emergency-stopped') {
    return state;
  }

  if (event.type === 'ENABLE' && state.status === 'disabled') {
    return { status: 'waiting-for-codex', handledProcessIds: [] };
  }

  if (event.type === 'MANUAL_RETRY' && state.status === 'circuit-open') {
    return { status: 'waiting-for-codex', handledProcessIds: state.handledProcessIds };
  }

  if (event.type === 'CODEX_STARTED' && state.status === 'waiting-for-codex') {
    if (state.handledProcessIds.includes(event.processId)) {
      return state;
    }

    return {
      status: 'applying',
      processId: event.processId,
      handledProcessIds: markHandled(state.handledProcessIds, event.processId),
    };
  }

  if (
    event.type === 'APPLY_SUCCEEDED' &&
    state.status === 'applying' &&
    state.processId === event.processId
  ) {
    return {
      status: 'applied',
      processId: event.processId,
      handledProcessIds: state.handledProcessIds,
    };
  }

  if (
    event.type === 'APPLY_FAILED' &&
    state.status === 'applying' &&
    state.processId === event.processId
  ) {
    return {
      status: 'circuit-open',
      processId: event.processId,
      reason: event.reason,
      handledProcessIds: state.handledProcessIds,
    };
  }

  return state;
}

