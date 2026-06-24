import tutorialLevels from './tutorial.json';
import basicLevels from './basic.json';
import type { LevelData } from '../engine/types';

const levelCache = new Map<string, LevelData>();

function loadBuiltinLevels(): void {
  for (const level of [...tutorialLevels, ...basicLevels]) {
    levelCache.set(level.id, level as unknown as LevelData);
  }
}

loadBuiltinLevels();

export function getLevel(id: string): LevelData | undefined {
  return levelCache.get(id);
}

/** 通过完整 ID（如 "lv_001"）加载关卡 */
export function loadLevelById(id: string): LevelData | undefined {
  return levelCache.get(id);
}

export function getAllLevels(): LevelData[] {
  return [...levelCache.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function getLevelCount(): number {
  return levelCache.size;
}
