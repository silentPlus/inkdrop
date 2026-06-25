/**
 * galleryStore — 画作画廊数据持久化
 *
 * 通关时保存棋盘快照，支持浏览和下载。
 */
import { create } from 'zustand';

export interface GalleryItem {
  levelId: string;
  levelName: string;
  timestamp: number;
  stars: number;
  rows: number;
  cols: number;
  cells: string[]; // flat: cells[r * cols + c] = color hex
}

interface GalleryState {
  items: GalleryItem[];
  addItem: (item: GalleryItem) => void;
}

function load(): GalleryItem[] {
  try {
    const raw = localStorage.getItem('inkdrop_gallery');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function save(items: GalleryItem[]) {
  try { localStorage.setItem('inkdrop_gallery', JSON.stringify(items)); } catch { /* */ }
}

export const useGalleryStore = create<GalleryState>((set) => ({
  items: load(),

  addItem: (item) =>
    set((s) => {
      // 去重：同一关卡取最新
      const filtered = s.items.filter((i) => i.levelId !== item.levelId);
      const next = [item, ...filtered].slice(0, 50); // 最多存 50 幅
      save(next);
      return { items: next };
    }),
}));
