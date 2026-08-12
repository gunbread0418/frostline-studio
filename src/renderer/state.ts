import {
  createDefaultTheme,
  type ActivityLog,
  type StudioState,
  type ThemeRecord,
  type ThemeValues,
} from '../shared/theme';

export function appendLog(
  state: StudioState,
  level: ActivityLog['level'],
  message: string,
): StudioState {
  const log: ActivityLog = {
    id: crypto.randomUUID(),
    level,
    message,
    createdAt: new Date().toISOString(),
  };
  return { ...state, logs: [log, ...state.logs].slice(0, 100) };
}

export function updateSelectedTheme(
  state: StudioState,
  update: (theme: ThemeRecord) => ThemeRecord,
): StudioState {
  return {
    ...state,
    themes: state.themes.map((theme) =>
      theme.id === state.selectedThemeId
        ? { ...update(theme), updatedAt: new Date().toISOString() }
        : theme,
    ),
  };
}

export function updateSelectedValues(
  state: StudioState,
  patch: Partial<ThemeValues>,
): StudioState {
  return updateSelectedTheme(state, (theme) => ({
    ...theme,
    values: { ...theme.values, ...patch },
  }));
}

export function cloneSelectedTheme(state: StudioState): StudioState {
  const source = getSelectedTheme(state);
  const now = new Date().toISOString();
  const clone: ThemeRecord = {
    ...source,
    id: crypto.randomUUID(),
    name: `${source.name} 복사본`.slice(0, 80),
    values: { ...source.values },
    image: source.image ? { ...source.image } : null,
    createdAt: now,
    updatedAt: now,
  };
  return appendLog(
    { ...state, selectedThemeId: clone.id, themes: [...state.themes, clone] },
    'success',
    `“${source.name}” 테마를 복제했습니다.`,
  );
}

export function deleteSelectedTheme(state: StudioState): StudioState {
  if (state.themes.length <= 1) return state;
  const deleted = getSelectedTheme(state);
  const themes = state.themes.filter((theme) => theme.id !== deleted.id);
  return appendLog(
    { ...state, themes, selectedThemeId: themes[0].id },
    'warning',
    `“${deleted.name}” 테마를 삭제했습니다.`,
  );
}

export function addTheme(state: StudioState): StudioState {
  const theme = createDefaultTheme();
  return appendLog(
    { ...state, themes: [...state.themes, theme], selectedThemeId: theme.id },
    'success',
    '새 테마를 만들었습니다.',
  );
}

export function addImportedTheme(state: StudioState, theme: ThemeRecord): StudioState {
  return appendLog(
    { ...state, themes: [...state.themes, theme], selectedThemeId: theme.id },
    'success',
    `“${theme.name}” 테마를 가져왔습니다.`,
  );
}

export function getSelectedTheme(state: StudioState): ThemeRecord {
  return state.themes.find((theme) => theme.id === state.selectedThemeId) ?? state.themes[0];
}

