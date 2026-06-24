/**
 * 颜色混合系统
 *
 * 采用加权 RGB 混合 + 预计算混合矩阵。
 * 基础色盘：红 #EF4444 / 黄 #F59E0B / 蓝 #3B82F6 / 绿 #10B981 / 洋红 #EC4899
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** 5 色基础调色盘 */
export const PALETTE: Record<string, RGB> = {
  red:     { r: 239, g:  68, b:  71 },  // #EF4444
  yellow:  { r: 245, g: 158, b:  11 },  // #F59E0B
  blue:    { r:  59, g: 130, b: 246 },  // #3B82F6
  green:   { r:  16, g: 185, b: 129 },  // #10B981
  magenta: { r: 236, g:  72, b: 153 },  // #EC4899
};

/** 颜色名 → hex */
export const COLOR_HEX: Record<string, string> = {
  red:     '#EF4444',
  yellow:  '#F59E0B',
  blue:    '#3B82F6',
  green:   '#10B981',
  magenta: '#EC4899',
  orange:  '#F97316',
  purple:  '#8B5CF6',
  cyan:    '#06B6D4',
  'yellow-green': '#84CC16',
  coral:   '#FB7185',
  'deep-purple': '#7C3AEA',
  'gray-brown': '#78716C',
};

/** hex → RGB */
export function hexToRgb(hex: string): RGB {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.substring(0, 2), 16),
    g: parseInt(cleaned.substring(2, 4), 16),
    b: parseInt(cleaned.substring(4, 6), 16),
  };
}

/** RGB → hex */
export function rgbToHex({ r, g, b }: RGB): string {
  return `#${[r, g, b]
    .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** 计算两个 RGB 的欧氏距离（判断颜色相似度） */
function rgbDistance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/** 找到调色盘中最接近的颜色名 */
export function findClosestColorName(rgb: RGB): string {
  let best = 'gray-brown';
  let bestDist = Infinity;
  for (const [name, prgb] of Object.entries(PALETTE)) {
    const d = rgbDistance(rgb, prgb);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  // Also check mixed colors
  for (const [name, hex] of Object.entries(COLOR_HEX)) {
    const d = rgbDistance(rgb, hexToRgb(hex));
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

/**
 * 加权 RGB 混合
 * weight 默认相等，代表两种墨水等量混合
 */
export function mixColors(c1: RGB, w1: number, c2: RGB, w2: number): RGB {
  const total = w1 + w2;
  return {
    r: (c1.r * w1 + c2.r * w2) / total,
    g: (c1.g * w1 + c2.g * w2) / total,
    b: (c1.b * w1 + c2.b * w2) / total,
  };
}

/** 通过颜色名解析为 RGB */
export function resolveColor(nameOrHex: string): RGB {
  // 直接从 PALETTE 查找
  if (PALETTE[nameOrHex]) return PALETTE[nameOrHex];
  // 从 COLOR_HEX 查找
  if (COLOR_HEX[nameOrHex]) return hexToRgb(COLOR_HEX[nameOrHex]);
  // hex 字符串
  if (nameOrHex.startsWith('#')) return hexToRgb(nameOrHex);
  return PALETTE.red; // 兜底
}

/** 混合两个颜色（输入为颜色名或 hex），返回 { hex, name }（自动吸附到预设色） */
export function mixColorNames(a: string, b: string): { hex: string; name: string } {
  const rgbA = resolveColor(a);
  const rgbB = resolveColor(b);
  const mixed = mixColors(rgbA, 1, rgbB, 1);
  const name = findClosestColorName(mixed);
  const hex = COLOR_HEX[name] || rgbToHex(mixed);
  return { hex, name };
}
