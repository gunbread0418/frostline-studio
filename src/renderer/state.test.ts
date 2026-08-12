import { describe, expect, it } from 'vitest';
import { createInitialState } from '../shared/theme';
import {
  addTheme,
  cloneSelectedTheme,
  deleteSelectedTheme,
  getSelectedTheme,
  updateSelectedValues,
} from './state';

describe('theme library state', () => {
  it('updates only the selected theme', () => {
    const original = createInitialState();
    const withSecond = addTheme(original);
    const updated = updateSelectedValues(withSecond, { brightness: 123 });

    expect(getSelectedTheme(updated).values.brightness).toBe(123);
    expect(updated.themes[0].values.brightness).toBe(
      original.themes[0].values.brightness,
    );
  });

  it('clones a theme without sharing the values object', () => {
    const original = createInitialState();
    const cloned = cloneSelectedTheme(original);

    expect(cloned.themes).toHaveLength(2);
    expect(cloned.themes[1].id).not.toBe(cloned.themes[0].id);
    expect(cloned.themes[1].values).toEqual(cloned.themes[0].values);
    expect(cloned.themes[1].values).not.toBe(cloned.themes[0].values);
  });

  it('does not delete the last theme', () => {
    const original = createInitialState();
    expect(deleteSelectedTheme(original)).toBe(original);
  });
});

