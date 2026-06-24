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
          <button style={{ padding: '12px 32px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontSize: 16 }}>
            开始游戏
          </button>
        </Link>
      </div>
    </div>
  );
}
