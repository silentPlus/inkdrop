/**
 * Board — PixiJS 棋盘 React 组件
 */
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { PixiRenderer } from '@/renderer/PixiRenderer';

export function Board({ onCapture, previewMode }: { onCapture?: (fn: () => string) => void; previewMode?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PixiRenderer | null>(null);
  const board = useGameStore((s) => s.board);
  const stepCount = useGameStore((s) => s.stepCount);
  const lastFlood = useGameStore((s) => s.lastFlood);
  const undoCells = useGameStore((s) => s.undoCells);
  const phase = useGameStore((s) => s.phase);
  const clickSource = useGameStore((s) => s.clickSource);
  const onAnimationDone = useGameStore((s) => s.onAnimationDone);
  const finishUndo = useGameStore((s) => s.finishUndo);
  const colorblindMode = useSettingsStore((s) => s.colorblindMode);
  const themeId = useSettingsStore((s) => s.themeId);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    PixiRenderer.create(container)
      .then((renderer) => {
        if (cancelled) { renderer.destroy(); return; }
        rendererRef.current = renderer;
        renderer.onSourceClick = (sourceId: string) => {
          if (phaseRef.current === 'playing') {
            clickSource(sourceId);
          }
        };
        renderer.onFloodComplete = () => {
          onAnimationDone();
        };
        renderer.onUndoComplete = () => {
          finishUndo();
        };
        renderer.setColorblindMode(colorblindMode);
        renderer.setTheme(themeId);
        const currentBoard = useGameStore.getState().board;
        if (currentBoard) renderer.setBoard(currentBoard);
        // 暴露截图能力给父组件
        onCaptureRef.current?.(() => renderer.captureImage());
      })
      .catch((err) => console.error('PixiJS:', err));

    return () => {
      cancelled = true;
      rendererRef.current?.destroy();
    };
  }, []);

  // 色盲模式切换
  useEffect(() => {
    rendererRef.current?.setColorblindMode(colorblindMode);
  }, [colorblindMode]);

  // 主题切换
  useEffect(() => {
    rendererRef.current?.setTheme(themeId);
  }, [themeId]);

  // 预览模式切换
  useEffect(() => {
    rendererRef.current?.setPreviewMode(previewMode ?? false);
  }, [previewMode]);

  useEffect(() => {
    if (rendererRef.current && board) {
      rendererRef.current.setBoard(board);
    }
  }, [board]);

  // 有扩散/撤销结果 → 启动对应动画；否则普通重绘
  useEffect(() => {
    if (!rendererRef.current) return;
    if (undoCells) {
      rendererRef.current.animateUndo(undoCells);
    } else if (lastFlood) {
      rendererRef.current.animateFlood(lastFlood.affected, lastFlood.mixes, lastFlood.obstaclesHit);
    } else {
      rendererRef.current.refresh();
    }
  }, [stepCount, lastFlood, undoCells]);

  useEffect(() => {
    const onResize = () => rendererRef.current?.refresh();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  );
}
