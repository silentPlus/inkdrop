/**
 * 主题皮肤定义
 */
export interface Theme {
  id: string;
  name: string;
  /** CSS 背景色 */
  cssBg: string;
  /** PixiJS 棋盘底色 */
  boardBg: number;
  /** PixiJS 空格色 */
  emptyCell: number;
  /** PixiJS 网格线 */
  gridLine: number;
  /** 源点光晕 */
  sourceGlow: number;
  /** CSS 文字色 */
  textColor: string;
  /** CSS 卡片色 */
  cardBg: string;
  /** CSS 边框色 */
  borderColor: string;
}

export const THEMES: Theme[] = [
  {
    id: 'rice-paper',
    name: '宣纸',
    cssBg: '#f8f9fb',
    boardBg: 0xF5F0EB,
    emptyCell: 0xFAF7F2,
    gridLine: 0xE6DFD3,
    sourceGlow: 0x7c3aed,
    textColor: '#1a1a2e',
    cardBg: '#ffffff',
    borderColor: '#e5e0d8',
  },
  {
    id: 'watercolor',
    name: '水彩纸',
    cssBg: '#f0f4f8',
    boardBg: 0xEDF2F7,
    emptyCell: 0xF7FAFC,
    gridLine: 0xCBD5E1,
    sourceGlow: 0x3b82f6,
    textColor: '#1e293b',
    cardBg: '#ffffff',
    borderColor: '#cbd5e1',
  },
  {
    id: 'starry',
    name: '星空',
    cssBg: '#0f172a',
    boardBg: 0x1E293B,
    emptyCell: 0x334155,
    gridLine: 0x475569,
    sourceGlow: 0xfbbf24,
    textColor: '#e2e8f0',
    cardBg: '#1e293b',
    borderColor: '#475569',
  },
  {
    id: 'parchment',
    name: '羊皮卷',
    cssBg: '#fef3c7',
    boardBg: 0xF5E6C8,
    emptyCell: 0xFEF9E7,
    gridLine: 0xDEB887,
    sourceGlow: 0xdc2626,
    textColor: '#451a03',
    cardBg: '#fef3c7',
    borderColor: '#d4a574',
  },
];
