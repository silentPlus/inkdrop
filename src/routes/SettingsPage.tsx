import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/store/settingsStore';
import { THEMES } from '@/renderer/themes';

export function SettingsPage() {
  const navigate = useNavigate();
  const themeId = useSettingsStore((s) => s.themeId);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const colorblindMode = useSettingsStore((s) => s.colorblindMode);
  const toggleColorblind = useSettingsStore((s) => s.toggleColorblind);

  return (
    <div style={{ padding: '20px', maxWidth: 420, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: '4px 8px', color: 'var(--text)' }}
        >
          ←
        </button>
        <h2 style={{ fontSize: 20, margin: 0 }}>设置</h2>
      </div>

      {/* 主题选择 */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px',
        marginBottom: 16,
      }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>主题</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              style={{
                padding: '10px',
                borderRadius: 10,
                border: themeId === t.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: t.cardBg,
                color: t.textColor,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: themeId === t.id ? 700 : 400,
              }}
            >
              {'宣纸📜·水彩纸🖌·星空🌙·羊皮卷📖'.split('·')[THEMES.indexOf(t)] ?? t.name}
            </button>
          ))}
        </div>
      </div>

      {/* 色盲模式 */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>色盲友好模式</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              为每种颜色叠加独立图案标识
            </div>
          </div>
          <button
            onClick={toggleColorblind}
            style={{
              width: 44,
              height: 26,
              borderRadius: 13,
              border: 'none',
              background: colorblindMode ? 'var(--accent)' : 'var(--border)',
              cursor: 'pointer',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <span style={{
              display: 'block',
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'white',
              position: 'absolute',
              top: 3,
              left: colorblindMode ? 21 : 3,
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
      </div>
    </div>
  );
}
