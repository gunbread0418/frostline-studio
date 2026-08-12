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
};

beforeEach(() => {
  vi.mocked(api.loadState).mockResolvedValue(createInitialState());
  vi.mocked(api.saveState).mockResolvedValue({ savedAt: new Date().toISOString() });
  vi.mocked(api.selectImage).mockResolvedValue({ canceled: true });
  vi.mocked(api.exportTheme).mockResolvedValue({ canceled: true });
  vi.mocked(api.importTheme).mockResolvedValue({ canceled: true });
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

  it('keeps actual Codex integration controls disabled in M1', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Codex에 적용' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '자동 적용 켜기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '비상 정지' })).toBeDisabled();
  });
});

