/**
 * GameBoard — 棋盘状态模型
 *
 * 管理所有格子的状态、源点列表、操作历史和通关判定。
 * 扩散逻辑由 InkFlooder 负责，GameBoard 只管状态读写。
 */
import type { LevelData, Target } from './types';
import { mixColorNames } from './ColorMixer';

/* ====================== 棋盘基础类型 ====================== */

export enum CellType {
  Empty   = 0,
  Filled  = 1,
  Obstacle = 2,
  Source  = 3,
}

export interface CellState {
  type: CellType;
  color: string | null;   // hex 颜色
  sourceId: string | null; // 如果是源点，关联的 source.id
}

export interface SourceState {
  id: string;
  row: number;
  col: number;
  originalColor: string;  // 源点的原始颜色 hex
  color: string;          // 当前颜色（可能被混合改变）
  activated: boolean;     // 是否已被点击激活
}

/** 一次快照（用于 undo） */
interface Snapshot {
  cells: CellState[][];
  sources: SourceState[];
  stepCount: number;
}

/* ====================== GameBoard 类 ====================== */

export class GameBoard {
  readonly rows: number;
  readonly cols: number;
  cells: CellState[][];
  sources: SourceState[];
  targets: Target[];
  parSteps: number;
  stepCount = 0;
  private history: Snapshot[] = [];
  readonly levelId: string;
  readonly levelName: string;

  constructor(level: LevelData) {
    this.levelId = level.id;
    this.levelName = level.name;
    this.rows = level.board.rows;
    this.cols = level.board.cols;
    this.parSteps = level.par_steps;
    this.targets = level.targets ?? [];

    // 初始化格子
    this.cells = [];
    for (let r = 0; r < this.rows; r++) {
      this.cells[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.cells[r][c] = { type: CellType.Empty, color: null, sourceId: null };
      }
    }

    // 放置障碍物
    for (const obs of level.obstacles ?? []) {
      this.cells[obs.row][obs.col].type = CellType.Obstacle;
    }

    // 放置源点
    this.sources = [];
    for (const src of level.sources) {
      const color = src.color;
      this.cells[src.row][src.col] = {
        type: CellType.Source,
        color,
        sourceId: src.id,
      };
      this.sources.push({
        id: src.id,
        row: src.row,
        col: src.col,
        originalColor: color,
        color,
        activated: false,
      });
    }
  }

  /* ========== 查询 ========== */

  getSourceAt(row: number, col: number): SourceState | undefined {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return undefined;
    const cell = this.cells[row][col];
    if (cell.type === CellType.Source && cell.sourceId) {
      return this.sources.find((s) => s.id === cell.sourceId);
    }
    return undefined;
  }

  getSourceById(id: string): SourceState | undefined {
    return this.sources.find((s) => s.id === id);
  }

  getUnactivatedSources(): SourceState[] {
    return this.sources.filter((s) => !s.activated);
  }

  /** 获取所有可以点击的源点（未激活） */
  getClickableSources(): SourceState[] {
    return this.getUnactivatedSources();
  }

  isComplete(): boolean {
    // 所有源点都已激活
    const allActivated = this.sources.every((s) => s.activated);
    if (!allActivated) return false;

    // 所有空格都已填充
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.cells[r][c].type === CellType.Empty) return false;
      }
    }

    // 目标格颜色验证（如果有）
    for (const t of this.targets) {
      const cell = this.cells[t.row][t.col];
      if (cell.color !== t.color) return false;
    }

    return true;
  }

  isDeadlocked(): boolean {
    if (this.isComplete()) return false;
    // 没有可激活的源点 → 死局
    return this.getUnactivatedSources().length === 0;
  }

  /** 获取空格数量 */
  getEmptyCount(): number {
    let count = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.cells[r][c].type === CellType.Empty) count++;
      }
    }
    return count;
  }

  /* ========== 操作 ========== */

  /** 保存快照（操作前调用） */
  saveSnapshot(): void {
    const snapshot: Snapshot = {
      cells: this.cells.map((row) =>
        row.map((cell) => ({ ...cell }))
      ),
      sources: this.sources.map((s) => ({ ...s })),
      stepCount: this.stepCount,
    };
    this.history.push(snapshot);
  }

  /**
   * 激活源点 —— 标记为已激活，源点格变为已填充
   * 扩散逻辑由 InkFlooder 负责
   */
  activateSource(sourceId: string): void {
    const src = this.getSourceById(sourceId);
    if (!src || src.activated) return;

    this.saveSnapshot();
    src.activated = true;
    this.stepCount++;

    // 源点格子自身变为已填充（但颜色保持）
    const cell = this.cells[src.row][src.col];
    cell.type = CellType.Filled;
  }

  /**
   * 用指定颜色填充一个空格
   * 返回 true 表示填充成功
   */
  fillCell(row: number, col: number, color: string): boolean {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return false;

    const cell = this.cells[row][col];

    // 只有空格才能填充
    if (cell.type !== CellType.Empty && cell.type !== CellType.Source) return false;

    // 如果是源点且未激活 → 触发颜色混合
    if (cell.type === CellType.Source && cell.sourceId) {
      const src = this.getSourceById(cell.sourceId);
      if (src && !src.activated) {
        // 颜色混合：当前墨水色 + 源点原色
        const mixed = mixColorNames(color, src.color);
        src.color = mixed.hex;
        cell.color = mixed.hex;
        // 源点不被填充，只是颜色改变
        return false; // 停止该方向的进一步扩散
      }
      return false; // 已激活的源点相当于障碍物
    }

    cell.type = CellType.Filled;
    cell.color = color;
    return true;
  }

  /** 撤销上一步 */
  undo(): boolean {
    if (this.history.length === 0) return false;
    const snap = this.history.pop()!;
    this.cells = snap.cells;
    this.sources = snap.sources;
    this.stepCount = snap.stepCount;
    return true;
  }

  /** 重置到初始状态 */
  reset(): void {
    this.history = [];
    this.stepCount = 0;
    // 恢复所有格子
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.cells[r][c].type === CellType.Filled) {
          this.cells[r][c] = { type: CellType.Empty, color: null, sourceId: null };
        }
      }
    }
    // 恢复所有源点
    for (const src of this.sources) {
      src.activated = false;
      src.color = src.originalColor;
      this.cells[src.row][src.col] = {
        type: CellType.Source,
        color: src.originalColor,
        sourceId: src.id,
      };
    }
    // 重新设置障碍物与源点（从 level 恢复可能被填充覆盖的源点格）
  }

  /** 获取操作历史长度 */
  getHistoryLength(): number {
    return this.history.length;
  }

  /** 计算星级 (1-3)，基于 par_steps */
  getStars(): number {
    const ratio = this.stepCount / this.parSteps;
    if (ratio <= 1.0) return 3;
    if (ratio <= 1.5) return 2;
    return 1;
  }

  /** 深拷贝当前完整状态（用于渲染） */
  getState(): { cells: CellState[][]; sources: SourceState[] } {
    return {
      cells: this.cells,
      sources: this.sources,
    };
  }
}
