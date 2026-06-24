import { Link } from 'react-router-dom';
import { getAllLevels } from '@/levels';

export function LevelSelectPage() {
  const levels = getAllLevels();

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: '0 auto' }}>
      <h2>选择关卡</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 12,
        marginTop: 20,
      }}>
        {levels.map((level, i) => (
          <Link key={level.id} to={`/game/${level.id}`}>
            <button
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: 8,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--text)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <span>{i + 1}</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                {level.name}
              </span>
            </button>
          </Link>
        ))}
      </div>
    </div>
  );
}
