/**
 * Toolbar — 游戏操作工具栏
 */
import { useGameStore } from '@/store/gameStore';

export function Toolbar() {
  const phase = useGameStore((s) => s.phase);
  const board = useGameStore((s) => s.board);
  const undo = useGameStore((s) => s.undo);
  const reset = useGameStore((s) => s.reset);

  if (!board) return null;

  const canAct = phase === 'playing' || phase === 'lose';
  const canUndo = canAct && board.getHistoryLength() > 0;

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
    </div>
  );
}

function ToolButton({
  label,
  icon,
  shortcut,
  onClick,
  disabled,
}: {
  label: string;
  icon: string;
  shortcut?: string;
  onClick: () => void;
  disabled: boolean;
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
        border: '1px solid var(--border)',
        background: disabled ? '#f5f5f5' : 'white',
        color: disabled ? 'var(--text-tertiary)' : 'var(--text)',
        fontSize: 13,
        cursor: disabled ? 'default' : 'pointer',
        minWidth: 64,
        opacity: disabled ? 0.5 : 1,
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
