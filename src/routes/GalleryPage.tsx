/**
 * GalleryPage — 画作画廊
 *
 * 浏览所有通关后的棋盘快照，支持下载为图片。
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGalleryStore, type GalleryItem } from '@/store/galleryStore';
import { Application, Graphics } from 'pixi.js';

export function GalleryPage() {
  const navigate = useNavigate();
  const items = useGalleryStore((s) => s.items);

  return (
    <div style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, maxWidth: 600, margin: '0 auto 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text)' }}>
            ←
          </button>
          <h2 style={{ fontSize: 20, margin: 0 }}>画作画廊</h2>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {items.length} 幅作品
        </span>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div>
          <p>通关后画作会出现在这里</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 12,
          maxWidth: 600,
          margin: '0 auto',
        }}>
          {items.map((item) => (
            <GalleryCard key={`${item.levelId}-${item.timestamp}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function GalleryCard({ item }: { item: GalleryItem }) {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    const size = 160;
    let destroyed = false;

    const render = async () => {
      const app = new Application();
      await app.init({ width: size, height: size, background: 0xF5F0EB, antialias: true });
      if (destroyed) { app.destroy(true); return; }

      const cs = Math.floor(size / Math.max(item.rows, item.cols));
      const ox = Math.floor((size - cs * item.cols) / 2);
      const oy = Math.floor((size - cs * item.rows) / 2);
      const pad = 2;

      const g = new Graphics();
      for (let r = 0; r < item.rows; r++) {
        for (let c = 0; c < item.cols; c++) {
          const colorHex = item.cells[r * item.cols + c] ?? '#FAF7F2';
          const hex = parseInt(colorHex.replace('#', ''), 16);
          g.rect(ox + c * cs + pad, oy + r * cs + pad, cs - pad * 2, cs - pad * 2).fill(hex);
        }
      }
      app.stage.addChild(g);
      container.appendChild(app.canvas);
    };

    render();
    return () => { destroyed = true; };
  }, [item]);

  const handleDownload = async () => {
    const size = 400;
    const app = new Application();
    await app.init({ width: size, height: size, background: 0xF5F0EB, antialias: true });

    const cs = Math.floor(size / Math.max(item.rows, item.cols));
    const ox = Math.floor((size - cs * item.cols) / 2);
    const oy = Math.floor((size - cs * item.rows) / 2);
    const pad = 2;

    const g = new Graphics();
    for (let r = 0; r < item.rows; r++) {
      for (let c = 0; c < item.cols; c++) {
        const colorHex = item.cells[r * item.cols + c] ?? '#FAF7F2';
        const hex = parseInt(colorHex.replace('#', ''), 16);
        g.rect(ox + c * cs + pad, oy + r * cs + pad, cs - pad * 2, cs - pad * 2).fill(hex);
      }
    }
    app.stage.addChild(g);

    // 等待一帧渲染
    await new Promise((r) => setTimeout(r, 100));
    const blob = await new Promise<Blob | null>((resolve) =>
      (app.canvas as HTMLCanvasElement).toBlob(resolve, 'image/png')
    );
    app.destroy(true);

    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inkdrop-${item.levelId}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const date = new Date(item.timestamp);
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div ref={canvasRef} style={{ width: 160, height: 160 }} />
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          {item.levelName}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {date.toLocaleDateString('zh-CN')}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <span style={{ fontSize: 11 }}>{'⭐'.repeat(item.stars)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            下载
          </button>
        </div>
      </div>
    </div>
  );
}
