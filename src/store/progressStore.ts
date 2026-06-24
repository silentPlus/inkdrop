/**
 * progressStore — 关卡进度持久化
 */
import { create } from 'zustand';

interface ProgressState {
  completedLevels: Set<string>;
  stars: Record<string, number>; // levelId → stars (1-3)

  completeLevel: (levelId: string, stars: number) => void;
  isCompleted: (levelId: string) => boolean;
  getStars: (levelId: string) => number;
}

const saved = loadProgress();

export const useProgressStore = create<ProgressState>((set, get) => ({
  completedLevels: saved.completedLevels,
  stars: saved.stars,

  completeLevel: (levelId: string, stars: number) => {
    const { completedLevels, stars: currentStars } = get();
    const next = new Set(completedLevels);
    next.add(levelId);

    // 保留最高星级
    const newStars = {
      ...currentStars,
      [levelId]: Math.max(stars, currentStars[levelId] ?? 0),
    };

    set({ completedLevels: next, stars: newStars });
    saveProgress({ completedLevels: next, stars: newStars });
  },

  isCompleted: (levelId: string) => get().completedLevels.has(levelId),

  getStars: (levelId: string) => get().stars[levelId] ?? 0,
}));

function loadProgress(): { completedLevels: Set<string>; stars: Record<string, number> } {
  try {
    const raw = localStorage.getItem('inkdrop_progress');
    if (raw) {
      const data = JSON.parse(raw);
      return {
        completedLevels: new Set(data.completedLevels ?? []),
        stars: data.stars ?? {},
      };
    }
  } catch { /* ignore */ }
  return { completedLevels: new Set(), stars: {} };
}

function saveProgress(data: { completedLevels: Set<string>; stars: Record<string, number> }) {
  try {
    localStorage.setItem(
      'inkdrop_progress',
      JSON.stringify({
        completedLevels: [...data.completedLevels],
        stars: data.stars,
      }),
    );
  } catch { /* ignore */ }
}
