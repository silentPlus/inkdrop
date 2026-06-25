import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { THEMES } from '@/renderer/themes';

/**
 * 将当前主题的 CSS 变量注入到 document.documentElement
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeId = useSettingsStore((s) => s.themeId);

  useEffect(() => {
    const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
    const root = document.documentElement;
    root.style.setProperty('--bg', theme.cssBg);
    root.style.setProperty('--text', theme.textColor);
    root.style.setProperty('--text-secondary', theme.textColor + 'cc');
    root.style.setProperty('--text-tertiary', theme.textColor + '88');
    root.style.setProperty('--card', theme.cardBg);
    root.style.setProperty('--border', theme.borderColor);
    root.style.backgroundColor = theme.cssBg;
    root.style.color = theme.textColor;
  }, [themeId]);

  return <>{children}</>;
}
