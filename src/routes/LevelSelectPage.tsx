import { Link } from 'react-router-dom';
import { getAllLevels } from '@/levels';
import { useProgressStore } from '@/store/progressStore';

export function LevelSelectPage() {
  const levels = getAllLevels();
  const isCompleted = useProgressStore((s) => s.isCompleted);
  const getStars = useProgressStore((s) => s.getStars);

  return (
    <div style={{ padding: 20, maxWidth: 480, margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ marginBottom: 8 }}>选择关卡</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
        共 {levels.length} 关 · {levels.filter((l) => isCompleted(l.id)).length} 已通关
      </p>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 10,
        alignContent: 'start',
        paddingBottom: 20,
      }}>
        {levels.map((level, i) => {
          const completed = isCompleted(level.id);
          const stars = getStars(level.id);

          return (
            <Link key={level.id} to={`/game/${level.id}`} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  aspectRatio: '1',
                  borderRadius: 10,
                  background: completed ? 'var(--accent-light)' : 'var(--card)',
                  border: completed ? '2px solid var(--accent)' : '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <span style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: completed ? 'var(--accent-dark)' : 'var(--text)',
                }}>
                  {i + 1}
                </span>
                <span style={{
                  fontSize: 9,
                  color: 'var(--text-tertiary)',
                  fontWeight: 400,
                  textAlign: 'center',
                  lineHeight: 1.2,
                  maxWidth: '90%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {level.name}
                </span>
                {completed && (
                  <span style={{ fontSize: 10 }}>{'⭐'.repeat(stars)}</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
