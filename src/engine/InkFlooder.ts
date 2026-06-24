/**
 * InkFlooder — BFS 墨水扩散算法
 *
 * 从源点出发，向上下左右四个方向逐格扩散。
 * 扩散规则：
 *   1. 空格 → 用当前颜色填充，加入扩散前沿
 *   2. 未激活源点 → 颜色混合（更新源点颜色），停止该方向
 *   3. 已填充/障碍物/边界 → 停止该方向
 *   4. 已激活源点 → 视为已填充（不继续扩散）
 *
 * 返回「受影响格子列表」供渲染层播放动画。
 */
import { CellType, GameBoard } from './GameBoard';
import { mixColorNames } from './ColorMixer';

/* ====================== 扩散结果 ====================== */

export interface FloodAffected {
  row: number;
  col: number;
  color: string;
  delay: number;       // 扩散延迟 (ms)，由 BFS 距离计算
}

export interface MixEvent {
  sourceId: string;
  sourceRow: number;
  sourceCol: number;
  oldColor: string;     // 混合前颜色
  newColor: string;     // 混合后颜色
  mixedWith: string;    // 与之混合的墨水颜色
}

export interface FloodResult {
  affected: FloodAffected[];  // 所有被填充的格子（含颜色 + 延迟）
  mixes: MixEvent[];          // 发生的颜色混合事件
}

/* ====================== 扩散算法 ====================== */

/** 四个方向：上、右、下、左 */
const DIRS = [
  [-1, 0],
  [1, 0],
  [0, 1],
  [0, -1],
];

/**
 * 从指定源点执行 BFS 扩散
 * 注意：调用前需由 GameBoard.activateSource() 激活源点并保存快照
 */
export function flood(board: GameBoard, sourceId: string): FloodResult {
  const src = board.getSourceById(sourceId);
  if (!src || !src.activated) {
    return { affected: [], mixes: [] };
  }

  const affected: FloodAffected[] = [];
  const mixes: MixEvent[] = [];
  const visited = new Set<string>();

  // BFS 队列：存储已确定要扩散的格子
  const queue: { row: number; col: number; color: string; distance: number }[] = [];

  // 源点自身 → 向四方向发起扩散
  for (const [dr, dc] of DIRS) {
    const nr = src.row + dr;
    const nc = src.col + dc;
    if (inBounds(board, nr, nc)) {
      const key = `${nr},${nc}`;
      visited.add(key);
      queue.push({ row: nr, col: nc, color: src.color, distance: 1 });
    }
  }

  // 每个方向的初始 delte 距离
  while (queue.length > 0) {
    const { row, col, color, distance } = queue.shift()!;
    const cell = board.cells[row][col];

    // 空格 → 填充并继续扩散
    if (cell.type === CellType.Empty) {
      board.fillCell(row, col, color);
      affected.push({
        row,
        col,
        color,
        delay: distance * 80, // 每格 80ms 延迟
      });

      // 继续向四方向扩散
      for (const [dr, dc] of DIRS) {
        const nr = row + dr;
        const nc = col + dc;
        const key = `${nr},${nc}`;
        if (inBounds(board, nr, nc) && !visited.has(key)) {
          visited.add(key);
          queue.push({ row: nr, col: nc, color, distance: distance + 1 });
        }
      }
      continue;
    }

    // 未激活源点 → 颜色混合 → 停止整个 BFS
    if (cell.type === CellType.Source && cell.sourceId) {
      const targetSrc = board.getSourceById(cell.sourceId);
      if (targetSrc && !targetSrc.activated) {
        const oldColor = targetSrc.color;
        board.fillCell(row, col, color); // 内部触发混合，更新源点颜色
        const newColor = targetSrc.color;
        mixes.push({
          sourceId: targetSrc.id,
          sourceRow: row,
          sourceCol: col,
          oldColor,
          newColor,
          mixedWith: color,
        });
        affected.push({
          row,
          col,
          color: newColor,
          delay: distance * 80,
        });
        // 碰到未激活源点 → 立即终止扩散，留出空间给混合后的颜色
        return { affected, mixes };
      }
      // 已激活的源点 / 已经混合过的 → 视为障碍，不继续扩散
      continue;
    }

    // 其他情况（障碍物/边界/已填充/已激活源点）→ 不扩散，不回填入 affected
  }

  return { affected, mixes };
}

function inBounds(board: GameBoard, row: number, col: number): boolean {
  return row >= 0 && row < board.rows && col >= 0 && col < board.cols;
}

/* ====================== 预览 ====================== */

/**
 * 预览点击某个源点后的扩散范围（不实际修改棋盘）
 */
export function previewFlood(
  board: GameBoard,
  sourceId: string,
): { cells: Array<{ row: number; col: number; color: string }>; mixes: MixEvent[] } {
  const src = board.getSourceById(sourceId);
  if (!src) return { cells: [], mixes: [] };

  const cells: Array<{ row: number; col: number; color: string }> = [];
  const mixes: MixEvent[] = [];
  const visited = new Set<string>();

  const queue: { row: number; col: number; color: string }[] = [];
  for (const [dr, dc] of DIRS) {
    const nr = src.row + dr;
    const nc = src.col + dc;
    if (inBounds(board, nr, nc)) {
      visited.add(`${nr},${nc}`);
      queue.push({ row: nr, col: nc, color: src.color });
    }
  }

  while (queue.length > 0) {
    const { row, col, color } = queue.shift()!;
    const cell = board.cells[row][col];

    if (cell.type === CellType.Empty) {
      cells.push({ row, col, color });
      for (const [dr, dc] of DIRS) {
        const nr = row + dr;
        const nc = col + dc;
        const key = `${nr},${nc}`;
        if (inBounds(board, nr, nc) && !visited.has(key)) {
          visited.add(key);
          queue.push({ row: nr, col: nc, color });
        }
      }
      continue;
    }

    if (cell.type === CellType.Source && cell.sourceId) {
      const targetSrc = board.getSourceById(cell.sourceId);
      if (targetSrc && !targetSrc.activated) {
        const mixed = mixColorNames(color, targetSrc.color);
        cells.push({ row, col, color: mixed.hex });
        mixes.push({
          sourceId: targetSrc.id,
          sourceRow: row,
          sourceCol: col,
          oldColor: targetSrc.color,
          newColor: mixed.hex,
          mixedWith: color,
        });
        continue;
      }
    }
  }

  return { cells, mixes };
}
