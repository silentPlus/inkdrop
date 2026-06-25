/**
 * gameStore — 游戏核心状态（Zustand）
 */
import { create } from 'zustand';
import { GameBoard } from '../engine/GameBoard';
import { flood } from '../engine/InkFlooder';
import type { FloodAffected, MixEvent } from '../engine/InkFlooder';
import type { LevelData } from '../engine/types';
import { loadLevelById } from '../levels';
import { analytics } from '../utils/analytics';

export type GamePhase = 'idle' | 'loading' | 'playing' | 'animating' | 'win' | 'lose';

interface GameState {
  phase: GamePhase;
  board: GameBoard | null;
  currentLevel: LevelData | null;
  stepCount: number;

  // 动画结果（渲染层读取）
  lastFlood: { affected: FloodAffected[]; mixes: MixEvent[] } | null;

  // 操作
  loadLevel: (id: string) => void;
  clickSource: (sourceId: string) => void;
  onAnimationDone: () => void;
  undo: () => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'idle',
  board: null,
  currentLevel: null,
  stepCount: 0,
  lastFlood: null,

  loadLevel: (id: string) => {
    set({ phase: 'loading' });
    const level = loadLevelById(id);
    if (!level) {
      set({ phase: 'idle', currentLevel: null, board: null });
      return;
    }
    const board = new GameBoard(level);
    set({
      phase: 'playing',
      board,
      currentLevel: level,
      stepCount: 0,
      lastFlood: null,
    });
    analytics.levelStart(id);
  },

  clickSource: (sourceId: string) => {
    const { board, phase } = get();
    if (!board || phase !== 'playing') return;

    const src = board.getSourceById(sourceId);
    if (!src || src.activated) return;

    set({ phase: 'animating' });

    // activateSource 内部已保存快照
    board.activateSource(sourceId);

    // 执行扩散
    const result = flood(board, sourceId);

    set({
      lastFlood: result,
      stepCount: board.stepCount,
    });
  },

  onAnimationDone: () => {
    const { board } = get();
    if (!board) return;

    if (board.isComplete()) {
      set({ phase: 'win' });
      analytics.levelComplete(board.levelId, board.stepCount, board.getStars());
    } else if (board.isDeadlocked()) {
      set({ phase: 'lose' });
      analytics.levelFail(board.levelId);
    } else {
      set({ phase: 'playing' });
    }
  },

  undo: () => {
    const { board, phase } = get();
    if (!board || (phase !== 'playing' && phase !== 'lose')) return;

    const ok = board.undo();
    if (ok) {
      set({
        stepCount: board.stepCount,
        phase: 'playing',
        lastFlood: null,
      });
      analytics.undoUsed(board.levelId);
    }
  },

  reset: () => {
    const { board } = get();
    if (!board) return;

    board.reset();
    set({
      phase: 'playing',
      stepCount: 0,
      lastFlood: null,
    });
    analytics.retryUsed(board.levelId);
  },
}));
