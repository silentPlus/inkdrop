import { Link, useNavigate } from 'react-router-dom';
import { getAllLevels } from '@/levels';
import { useProgressStore } from '@/store/progressStore';

function groupBy<T>(arr: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    groups.push(arr.slice(i, i + size));
  }
  return groups;
}

const GROUP_NAMES: Record<number, string> = {
  0: '🌱 入门',
  1: '🌿 基础',
  2: '🏔️ 进阶',
};

export function LevelSelectPage() {
  const navigate = useNavigate();
  const levels = getAllLevels();
  const isCompleted = useProgressStore((s) => s.isCompleted);
  const getStars = useProgressStore((s) => s.getStars);
  const groups = groupBy(levels, 10);

  const completedCount = levels.filter((l) => isCompleted(l.id)).length;

  return (
    <div style={{
      padding: '16px 0',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* 顶栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px 12px',
        flexShrink: 0,
      }}>
        <div>
          <h2 style={{ fontSize: 22, margin: 0 }}>选择关卡</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '2px 0 0' }}>
            {completedCount} / {levels.length} 已通关
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
        >
          返回
        </button>
      </div>

      {/* 关卡分组 — 纵向滚动 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 20px',
      }}>
        {groups.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>
                {GROUP_NAMES[gi] ?? `🎨 第${gi + 1}组`}
              </span>
              <span style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                background: 'var(--bg)',
                padding: '1px 8px',
                borderRadius: 10,
              }}>
                关 {gi * 10 + 1}-{Math.min((gi + 1) * 10, levels.length)}
              </span>
            </div>

            {/* 横向滑动组 */}
            <div style={{
              display: 'flex',
              gap: 10,
              overflowX: 'auto',
              paddingBottom: 8,
              scrollSnapType: 'x mandatory',
            }}>
              {group.map((level, i) => {
                const globalIndex = gi * 10 + i;
                const completed = isCompleted(level.id);
                const stars = getStars(level.id);
                const isNext = !completed && (globalIndex === 0 || isCompleted(levels[globalIndex - 1]?.id ?? ''));
                const locked = !completed && !isNext && globalIndex > 0;

                return (
                  <Link
                    key={level.id}
                    to={locked ? '#' : `/game/${level.id}`}
                    style={{
                      textDecoration: 'none',
                      pointerEvents: locked ? 'none' : 'auto',
                      scrollSnapAlign: 'start',
                      flexShrink: 0,
                    }}
                    onClick={(e) => locked && e.preventDefault()}
                  >
                    <div
                      style={{
                        width: 72,
                        height: 88,
                        borderRadius: 10,
                        background: completed
                          ? 'var(--accent-light)'
                          : isNext
                          ? 'var(--card)'
                          : '#f5f5f5',
                        border: completed
                          ? '2px solid var(--accent)'
                          : isNext
                          ? '2px solid var(--accent)'
                          : '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        cursor: locked ? 'default' : 'pointer',
                        opacity: locked ? 0.4 : 1,
                      }}
                    >
                      <span style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: completed
                          ? 'var(--accent-dark)'
                          : isNext
                          ? 'var(--accent)'
                          : 'var(--text-tertiary)',
                      }}>
                        {locked ? '🔒' : globalIndex + 1}
                      </span>
                      <span style={{
                        fontSize: 9,
                        color: 'var(--text-tertiary)',
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
                      {isNext && !completed && (
                        <span style={{ fontSize: 9, color: 'var(--accent)' }}>当前</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
