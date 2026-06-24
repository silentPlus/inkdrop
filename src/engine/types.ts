/** 单个格子状态 */
export enum CellType {
  Empty = 'empty',
  Filled = 'filled',
  Obstacle = 'obstacle',
  Source = 'source',
  Target = 'target',
}

/** 格子上存储的颜色信息 */
export interface CellColor {
  hex: string;
  name: string;
}

/** 单个格子 */
export interface Cell {
  row: number;
  col: number;
  type: CellType;
  color?: CellColor;
  sourceId?: string;
  targetColor?: CellColor;
}

/** 源点定义 */
export interface Source {
  id: string;
  row: number;
  col: number;
  color: string;
  name: string;
}

/** 障碍物 */
export interface Obstacle {
  row: number;
  col: number;
}

/** 目标格 */
export interface Target {
  row: number;
  col: number;
  color: string;
  name: string;
}

/** 关卡数据 */
export interface LevelData {
  id: string;
  name: string;
  difficulty: number;
  board: {
    rows: number;
    cols: number;
  };
  sources: Source[];
  obstacles: Obstacle[];
  targets: Target[];
  solution: string[];
  par_steps: number;
  hint?: string;
  theme?: string;
  author?: string;
}
