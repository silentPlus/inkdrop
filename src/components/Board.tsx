/**
 * Board — PixiJS 棋盘 React 组件
 */
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { PixiRenderer } from '@/renderer/PixiRenderer';

export function Board({ onCapture }: { onCapture?: (fn: () => string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PixiRenderer | null>(null);
  const board = useGameStore((s) => s.board);
  const stepCount = useGameStore((s) => s.stepCount);
  const lastFlood = useGameStore((s) => s.lastFlood);
  const phase = useGameStore((s) => s.phase);
  const clickSource = useGameStore((s) => s.clickSource);
  const onAnimationDone = useGameStore((s) => s.onAnimationDone);
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

  useEffect(() => {
    if (rendererRef.current && board) {
      rendererRef.current.setBoard(board);
    }
  }, [board]);

  // 有扩散结果 → 启动逐格动画；否则普通重绘
  useEffect(() => {
    if (!rendererRef.current) return;
    if (lastFlood) {
      rendererRef.current.animateFlood(lastFlood.affected);
    } else {
      rendererRef.current.refresh();
    }
  }, [stepCount, lastFlood]);

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
