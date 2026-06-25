import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { useProgressStore } from '@/store/progressStore';
import { useGalleryStore } from '@/store/galleryStore';
import { Board } from '@/components/Board';
import { Toolbar } from '@/components/Toolbar';
import { WinAnimation } from '@/components/WinAnimation';
import { adManager } from '@/ads/AdManager';

export function GamePage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();

  const phase = useGameStore((s) => s.phase);
  const board = useGameStore((s) => s.board);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const stepCount = useGameStore((s) => s.stepCount);
  const loadLevel = useGameStore((s) => s.loadLevel);
  const onAnimationDone = useGameStore((s) => s.onAnimationDone);
  const undo = useGameStore((s) => s.undo);
  const reset = useGameStore((s) => s.reset);

  const completeLevel = useProgressStore((s) => s.completeLevel);
  const addGalleryItem = useGalleryStore((s) => s.addItem);
  const [showWinEffect, setShowWinEffect] = useState(false);

  // 通关时播放绽放动画
  useEffect(() => {
    if (phase === 'win') {
      setShowWinEffect(true);
    } else {
      setShowWinEffect(false);
    }
  }, [phase]);

  // 键盘快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        undo();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, reset]);

  // 加载关卡
  useEffect(() => {
    if (levelId) {
      loadLevel(levelId);
    }
  }, [levelId, loadLevel]);

  // 动画完成后检查通关
  useEffect(() => {
    if (phase === 'animating') {
      // 模拟动画播放时间
      const timer = setTimeout(() => {
        onAnimationDone();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [phase, onAnimationDone]);

  // 通关时记录进度 + 插屏广告
  const handleNextLevel = useCallback(async () => {
    if (board) {
      completeLevel(board.levelId, board.getStars());

      // 保存画作到画廊
      const flat: string[] = [];
      for (let r = 0; r < board.rows; r++) {
        for (let c = 0; c < board.cols; c++) {
          const cell = board.cells[r][c];
          flat.push(cell.color ?? cell.type === 1 ? (cell.color ?? '#FAF7F2') : '#FAF7F2');
        }
      }
      addGalleryItem({
        levelId: board.levelId,
        levelName: currentLevel?.name ?? board.levelId,
        timestamp: Date.now(),
        stars: board.getStars(),
        rows: board.rows,
        cols: board.cols,
        cells: flat,
      });
      const num = parseInt(board.levelId.replace('lv_', ''), 10);
      await adManager.showLevelInterstitial(num);
    }
    if (levelId) {
      const num = parseInt(levelId.replace('lv_', ''), 10);
      if (num < 110) {
        navigate(`/game/lv_${String(num + 1).padStart(3, '0')}`, { replace: true });
      } else {
        navigate('/levels', { replace: true });
      }
    }
  }, [board, levelId, completeLevel, navigate]);

  const handleRetry = useCallback(() => {
    if (levelId) {
      loadLevel(levelId);
    }
  }, [levelId, loadLevel]);

  if (phase === 'loading') {
    return (
      <div className="game-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-tertiary)' }}>载入中…</p>
      </div>
    );
  }

  return (
    <div className="game-page" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
    }}>
      {/* 顶栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        height: 48,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button onClick={() => navigate('/levels')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 18,
            cursor: 'pointer',
            color: 'var(--text)',
            padding: '4px 8px',
          }}
        >
          ←
        </button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>
          {board ? board.levelName : `关卡 ${levelId}`}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          步数: {stepCount}
        </span>
      </div>

      {/* 棋盘区域 */}
      <div style={{
        flex: 1,
        minHeight: 0,
        padding: 8,
      }}>
        <Board />
      </div>

      {/* 工具栏 */}
      <Toolbar />

      {/* 通关绽放动画 */}
      {showWinEffect && (
        <WinAnimation onDone={() => setShowWinEffect(false)} width={260} height={260} />
      )}

      {/* 通关弹窗 */}
      {phase === 'win' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: '32px 28px',
            textAlign: 'center',
            maxWidth: 300,
            width: '90%',
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
            <h2 style={{ fontSize: 22, marginBottom: 4 }}>通关！</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8 }}>
              {board && (
                <>
                  {stepCount} / {board.parSteps} 步 · {'⭐'.repeat(board.getStars())}
                </>
              )}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
              <button onClick={handleRetry}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'white',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                重玩
              </button>
              <button onClick={handleNextLevel}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--accent)',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                下一关
              </button>
            </div>
            <Link to="/gallery" style={{
              display: 'block',
              marginTop: 12,
              fontSize: 12,
              color: 'var(--text-tertiary)',
              textDecoration: 'none',
            }}>
              🎨 查看画廊
            </Link>
          </div>
        </div>
      )}

      {/* 失败弹窗 */}
      {phase === 'lose' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: '32px 28px',
            textAlign: 'center',
            maxWidth: 300,
            width: '90%',
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>😢</div>
            <h2 style={{ fontSize: 22, marginBottom: 4 }}>无法继续</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              所有源点已激活，但仍有空格未填充
            </p>
            <button onClick={handleRetry}
              style={{
                padding: '10px 24px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--accent)',
                color: 'white',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: 16,
              }}
            >
              重试
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
