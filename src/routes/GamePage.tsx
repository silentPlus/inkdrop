import { useParams } from 'react-router-dom';

export function GamePage() {
  const { levelId } = useParams<{ levelId: string }>();
  return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h2>关卡 {levelId}</h2>
      <p style={{ color: 'var(--text-secondary)' }}>游戏棋盘占位 — 待 0.2 Canvas 渲染引擎实现</p>
    </div>
  );
}
