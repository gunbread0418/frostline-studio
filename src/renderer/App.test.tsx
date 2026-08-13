import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FrostlineApi } from '../shared/ipc';
import { createInitialState } from '../shared/theme';
import { App } from './App';

const api: FrostlineApi = {
  loadState: vi.fn(),
  saveState: vi.fn(),
  selectImage: vi.fn(),
  exportTheme: vi.fn(),
  importTheme: vi.fn(),
  copyAppearanceGuide: vi.fn(),
  recommendThemePalette: vi.fn(),
  getOfficialCodexStatus: vi.fn(),
  applyOfficialCodexTheme: vi.fn(),
  updateOfficialCodexTheme: vi.fn(),
  restoreOfficialCodexTheme: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.loadState).mockResolvedValue(createInitialState());
  vi.mocked(api.saveState).mockResolvedValue({ savedAt: new Date().toISOString() });
  vi.mocked(api.selectImage).mockResolvedValue({ canceled: true });
  vi.mocked(api.exportTheme).mockResolvedValue({ canceled: true });
  vi.mocked(api.importTheme).mockResolvedValue({ canceled: true });
  vi.mocked(api.copyAppearanceGuide).mockResolvedValue({
    copiedAt: new Date().toISOString(),
  });
  vi.mocked(api.recommendThemePalette).mockResolvedValue({
    mode: 'balanced',
    averageColor: '#446688',
    luminance: 0.12,
    values: { bodyColor: '#0f1720' },
  });
  vi.mocked(api.getOfficialCodexStatus).mockResolvedValue({
    available: true,
    canRestore: false,
    requiresCodexExit: false,
    phase: 'ready',
    experimental: true,
    message: '사진 스킨을 한 번 적용할 준비가 됐습니다.',
  });
  vi.mocked(api.applyOfficialCodexTheme).mockResolvedValue({
    ok: true,
    message: '선택한 사진과 색상을 현재 Codex 화면에 적용하고 결과를 확인했습니다.',
    attemptedAt: new Date().toISOString(),
    canRestore: true,
    requiresCodexExit: false,
    phase: 'active',
  });
  vi.mocked(api.updateOfficialCodexTheme).mockResolvedValue({
    ok: true,
    message: '변경한 테마를 현재 Codex 화면에 바로 반영했습니다.',
    attemptedAt: new Date().toISOString(),
    canRestore: true,
    requiresCodexExit: false,
    phase: 'active',
    stage: 'live-update',
  });
  vi.mocked(api.restoreOfficialCodexTheme).mockResolvedValue({
    ok: true,
    message: '현재 Codex 화면에서 Frostline 사진 스킨을 제거했습니다.',
    attemptedAt: new Date().toISOString(),
    canRestore: false,
    requiresCodexExit: false,
    phase: 'ready',
  });
  Object.defineProperty(window, 'frostline', { value: api, configurable: true });
});

describe('Frostline Studio renderer', () => {
  it('loads saved state, renders the preview, and persists an edit', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: '실시간 미리보기' })).toBeVisible();
    expect(screen.getByLabelText('테마 실시간 미리보기')).toBeVisible();
    await user.click(screen.getByRole('tab', { name: '색상' }));
    expect(screen.getByLabelText('오버레이 색상')).toBeVisible();

    await waitFor(() => expect(api.saveState).toHaveBeenCalled());
  });

  it('enables approved M3 manual apply but keeps M4 automation disabled', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Codex에 적용' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '복원' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '자동 적용 켜기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '비상 정지' })).toBeDisabled();
  });

  it('requires confirmation and records a verified one-shot apply result', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Codex에 적용' }));

    await waitFor(() => expect(api.applyOfficialCodexTheme).toHaveBeenCalledOnce());
    expect(
      await screen.findAllByText('선택한 사진과 색상을 현재 Codex 화면에 적용하고 결과를 확인했습니다.'),
    ).toHaveLength(2);
    expect(screen.getByRole('button', { name: '복원' })).toBeEnabled();
  });

  it('stops after one failed apply and exposes only a manual retry action', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.applyOfficialCodexTheme).mockResolvedValueOnce({
      ok: false,
      message: '한 번 실패했습니다. 자동 재시도하지 않습니다.',
      attemptedAt: new Date().toISOString(),
      canRestore: false,
      requiresCodexExit: false,
      phase: 'ready',
    });
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Codex에 적용' }));

    expect(await screen.findByRole('button', { name: '수동 재시도' })).toBeEnabled();
    expect(api.applyOfficialCodexTheme).toHaveBeenCalledOnce();
  });

  it('copies a manual Appearance guide without applying it to Codex', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('tab', { name: '색상' }));
    await user.click(screen.getByRole('button', { name: 'Appearance 가이드 복사' }));

    await waitFor(() => expect(api.copyAppearanceGuide).toHaveBeenCalledOnce());
    expect(vi.mocked(api.copyAppearanceGuide).mock.calls[0][0]).toContain(
      '공식 Appearance에는 사진 배경 항목이 없습니다.',
    );
    expect(screen.getByText('클립보드에 복사했습니다.')).toBeVisible();
  });

  it('applies a photo-based recommendation through validated preload IPC', async () => {
    const user = userEvent.setup();
    const state = createInitialState();
    state.themes[0].image = {
      assetId: '11111111-1111-4111-8111-111111111111.png',
      originalName: 'sample.png',
      url: 'frostline-asset://image/11111111-1111-4111-8111-111111111111.png',
    };
    vi.mocked(api.loadState).mockResolvedValueOnce(state);
    render(<App />);

    await user.click(await screen.findByRole('button', { name: '균형' }));

    await waitFor(() =>
      expect(api.recommendThemePalette).toHaveBeenCalledWith(state.themes[0], 'balanced'),
    );
    expect(await screen.findByText(/균형 적용 · 평균색 #446688/)).toBeVisible();
  });

  it('locks live updates after the first failure until manual reconnect', async () => {
    vi.mocked(api.getOfficialCodexStatus).mockResolvedValueOnce({
      available: true,
      canRestore: true,
      requiresCodexExit: false,
      phase: 'active',
      experimental: true,
      message: '사진 스킨이 적용돼 있습니다.',
    });
    vi.mocked(api.updateOfficialCodexTheme).mockResolvedValueOnce({
      ok: false,
      message: '라이브 갱신 확인에 실패했습니다.',
      attemptedAt: new Date().toISOString(),
      canRestore: true,
      phase: 'active',
      stage: 'visibility-check',
      diagnosticCode: 'layer-not-visible',
    });
    render(<App />);

    expect(
      await screen.findByRole('button', { name: '라이브 연결 다시 시작' }),
    ).toBeEnabled();
    expect(api.updateOfficialCodexTheme).toHaveBeenCalledOnce();
    expect(await screen.findAllByText(/visibility-check\/layer-not-visible/)).not.toHaveLength(0);
  });
});
