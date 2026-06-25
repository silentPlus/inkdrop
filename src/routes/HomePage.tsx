import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h1>Ink Drop · 墨滴扩散</h1>
      <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>
        彩色墨滴自动扩散填充解谜游戏
      </p>
      <div style={{ marginTop: 32, display: 'flex', gap: 16, justifyContent: 'center' }}>
        <Link to="/levels">
          <button style={{ padding: '12px 32px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontSize: 16, border: 'none', cursor: 'pointer' }}>
            开始游戏
          </button>
        </Link>
        <Link to="/settings">
          <button style={{ padding: '12px 32px', borderRadius: 8, background: 'var(--card)', color: 'var(--text)', fontSize: 16, border: '1px solid var(--border)', cursor: 'pointer' }}>
            ⚙ 设置
          </button>
        </Link>
      </div>
      <div style={{ marginTop: 20 }}>
        <Link to="/gallery" style={{ fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none' }}>
          🎨 画作画廊
        </Link>
      </div>
    </div>
  );
}
