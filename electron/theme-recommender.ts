import { nativeImage } from 'electron';
import type { ThemeRecord } from '../src/shared/theme';
import {
  averageBgraPixels,
  recommendThemeFromAverageColor,
  type ThemeRecommendation,
  type ThemeRecommendationMode,
} from '../src/shared/theme-recommendation';

export function recommendThemePalette(
  theme: ThemeRecord,
  mode: ThemeRecommendationMode,
  resolveAssetPath: (assetId: string) => string,
): ThemeRecommendation {
  if (!theme.image) {
    throw new Error('먼저 배경 사진을 선택해 주세요.');
  }
  const image = nativeImage.createFromPath(resolveAssetPath(theme.image.assetId));
  if (image.isEmpty()) {
    throw new Error('선택한 사진을 분석하지 못했습니다.');
  }
  const sample = image.resize({ width: 32, height: 32, quality: 'good' }).toBitmap();
  return recommendThemeFromAverageColor(averageBgraPixels(sample), mode);
}
