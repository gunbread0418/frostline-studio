import { describe, expect, it } from 'vitest';
import { averageBgraPixels, recommendThemeFromAverageColor } from './theme-recommendation';

describe('photo-based theme recommendations', () => {
  it('averages Windows BGRA bitmap pixels while ignoring transparent pixels', () => {
    const average = averageBgraPixels(
      new Uint8Array([
        30, 20, 10, 255,
        70, 60, 50, 255,
        255, 255, 255, 0,
      ]),
    );

    expect(average).toEqual({ red: 30, green: 40, blue: 50 });
  });

  it('raises surface opacity when readability-first mode is selected', () => {
    const photo = recommendThemeFromAverageColor({ red: 120, green: 170, blue: 210 }, 'photo');
    const contrast = recommendThemeFromAverageColor(
      { red: 120, green: 170, blue: 210 },
      'contrast',
    );

    expect(contrast.values.bodyOpacity).toBeGreaterThan(photo.values.bodyOpacity!);
    expect(contrast.values.inputOpacity).toBeGreaterThan(photo.values.inputOpacity!);
    expect(contrast.values.foregroundColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(contrast.averageColor).toBe('#78aad2');
  });
});
