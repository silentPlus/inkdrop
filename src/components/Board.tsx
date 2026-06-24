/**
 * Board — Canvas 棋盘 React 组件
 *
 * 挂载 Canvas，管理 CanvasRenderer 生命周期，
 * 桥接 gameStore 到渲染层。
 */
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { CanvasRenderer } from '@/renderer/CanvasRenderer';

export function Board() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const board = useGameStore((s) => s.board);
  const phase = useGameStore((s) => s.phase);
  const clickSource = useGameStore((s) => s.clickSource);

  // ref 避免闭包陷阱
  const clickSourceRef = useRef(clickSource);
  clickSourceRef.current = clickSource;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new CanvasRenderer(canvas);
    rendererRef.current = renderer;

    renderer.onSourceClick = (sourceId: string) => {
      if (phaseRef.current === 'playing') {
        clickSourceRef.current(sourceId);
      }
    };

    renderer.startRendering();

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []); // 只挂载一次

  // board 变化时更新渲染器
  useEffect(() => {
    if (rendererRef.current && board) {
      rendererRef.current.setBoard(board);
    }
  }, [board]);

  // 适配容器大小
  useEffect(() => {
    const onResize = () => {
      if (rendererRef.current && board) {
        rendererRef.current.setBoard(board);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [board]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        touchAction: 'none',
      }}
    />
  );
}
