/**
 * settingsStore — 用户设置（localStorage 持久化）
 */
import { create } from 'zustand';

interface SettingsState {
  themeId: string;
  colorblindMode: boolean;
  setTheme: (id: string) => void;
  toggleColorblind: () => void;
}

function load(): { themeId?: string; colorblindMode?: boolean } {
  try {
    const raw = localStorage.getItem('inkdrop_settings');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function save(data: Partial<SettingsState>) {
  try { localStorage.setItem('inkdrop_settings', JSON.stringify(data)); } catch { /* */ }
}

const saved = load();

export const useSettingsStore = create<SettingsState>((set) => ({
  themeId: saved.themeId ?? 'rice-paper',
  colorblindMode: saved.colorblindMode ?? false,

  setTheme: (id: string) =>
    set(() => { save({ themeId: id }); return { themeId: id }; }),

  toggleColorblind: () =>
    set((s) => {
      const next = !s.colorblindMode;
      save({ colorblindMode: next });
      return { colorblindMode: next };
    }),
}));
