/**
 * Toolbar — 游戏操作工具栏
 */
import { useGameStore } from '@/store/gameStore';

export function Toolbar({
  onHint,
  onColorMix,
  onTogglePreview,
  previewMode,
}: {
  onHint?: () => void;
  onColorMix?: () => void;
  onTogglePreview?: () => void;
  previewMode?: boolean;
}) {
  const phase = useGameStore((s) => s.phase);
  const board = useGameStore((s) => s.board);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const undo = useGameStore((s) => s.undo);
  const reset = useGameStore((s) => s.reset);

  if (!board) return null;

  const canAct = phase === 'playing' || phase === 'lose';
  const canUndo = canAct && board.getHistoryLength() > 0;
  const hasHint = !!(currentLevel?.hint);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: 12,
      padding: '10px 16px',
      borderTop: '1px solid var(--border)',
      background: 'var(--bg)',
      flexShrink: 0,
    }}>
      <ToolButton
        label="撤销"
        icon="↩"
        shortcut="Z"
        onClick={undo}
        disabled={!canUndo}
      />
      <ToolButton
        label="重试"
        icon="🔄"
        shortcut="R"
        onClick={reset}
        disabled={!canAct}
      />
      <ToolButton
        label="配色表"
        icon="🎨"
        onClick={onColorMix ?? (() => {})}
        disabled={false}
      />
      <ToolButton
        label={previewMode ? '预览中' : '预览'}
        icon="👁️"
        onClick={onTogglePreview ?? (() => {})}
        disabled={!canAct}
        active={previewMode}
      />
      {hasHint && (
        <ToolButton
          label="提示"
          icon="💡"
          onClick={onHint ?? (() => {})}
          disabled={!canAct}
        />
      )}
    </div>
  );
}

function ToolButton({
  label,
  icon,
  shortcut,
  onClick,
  disabled,
  active,
}: {
  label: string;
  icon: string;
  shortcut?: string;
  onClick: () => void;
  disabled: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '6px 18px',
        borderRadius: 10,
        border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
        background: active ? 'var(--accent-light)' : disabled ? '#f5f5f5' : 'white',
        color: active ? 'var(--accent-dark)' : disabled ? 'var(--text-tertiary)' : 'var(--text)',
        fontSize: 13,
        cursor: disabled ? 'default' : 'pointer',
        minWidth: 64,
        opacity: disabled ? 0.5 : 1,
        fontWeight: active ? 600 : 400,
        transition: 'border 0.15s, background 0.15s, color 0.15s',
      }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span>{label}</span>
      {shortcut && (
        <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{shortcut}</span>
      )}
    </button>
  );
}
