/**
 * WinAnimation — 通关绽放粒子动画
 *
 * Canvas 粒子系统：墨滴从中心向外扩散，金粉撒落效果。
 * 约 2 秒动画时长，结束后调用 onDone 回调。
 */
import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

const COLORS = [
  '#7c3aed', '#a78bfa', '#c084fc',
  '#f59e0b', '#fbbf24', '#fcd34d',
  '#10b981', '#34d399', '#6ee7b7',
  '#3b82f6', '#60a5fa', '#93c5fd',
  '#ec4899', '#f472b6', '#f9a8d4',
];

export function WinAnimation({
  onDone,
  width = 300,
  height = 300,
}: {
  onDone: () => void;
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = width / 2;
    const cy = height / 2;
    const particles: Particle[] = [];
    const startTime = performance.now();
    const DURATION = 2000;
    let animId = 0;

    // 生成粒子
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 1,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.7,
      });
    }

    function draw(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / DURATION, 1);

      ctx.clearRect(0, 0, width, height);

      if (progress < 0.15) {
        // Phase 0: central bloom
        const t = progress / 0.15;
        const r = t * 60;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        gradient.addColorStop(0, 'rgba(124, 58, 237, 0.6)');
        gradient.addColorStop(0.5, 'rgba(167, 139, 250, 0.3)');
        gradient.addColorStop(1, 'rgba(124, 58, 237, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Phases 1-2: particles
        for (const p of particles) {
          const particleProgress = Math.min((progress - 0.15) / 0.85, 1);
          p.life = particleProgress;

          // Movement
          const px = cx + p.vx * p.life * 1.5;
          const py = cy + p.vy * p.life * 1.5 - (1 - p.life) * 20; // gentle rise
          const r = p.radius * (1 - p.life * 0.5);

          // Fade out in last 30%
          const fadeProgress = Math.max(0, (p.life - 0.7) / 0.3);
          p.alpha = 1 - fadeProgress;

          if (p.alpha > 0) {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = r * 2;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        // Gold sparkles in center
        const sparkCount = 20;
        for (let i = 0; i < sparkCount; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * 15;
          const sx = cx + Math.cos(a) * d;
          const sy = cy + Math.sin(a) * d;
          const sparkAlpha = (1 - progress) * 0.6 * Math.random();

          ctx.fillStyle = `rgba(251, 191, 36, ${sparkAlpha})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (progress < 1) {
        animId = requestAnimationFrame(draw);
      } else {
        onDone();
      }
    }

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [width, height, onDone]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width,
        height,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
}
