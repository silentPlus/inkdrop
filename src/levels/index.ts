import tutorialLevels from './tutorial.json';
import type { LevelData } from '../engine/LevelValidator';

const levelCache = new Map<string, LevelData>();

function loadBuiltinLevels(): void {
  for (const level of tutorialLevels) {
    levelCache.set(level.id, level as LevelData);
  }
}

// Initialize on import
loadBuiltinLevels();

export function getLevel(id: string): LevelData | undefined {
  return levelCache.get(id);
}

export function getAllLevels(): LevelData[] {
  return [...levelCache.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function getLevelCount(): number {
  return levelCache.size;
}
