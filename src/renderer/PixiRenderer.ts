/**
 * PixiRenderer — PixiJS v8 渲染引擎
 */
import { Application, Container, Graphics, Rectangle } from 'pixi.js';
import { CellType, GameBoard } from '../engine/GameBoard';
import { previewFlood } from '../engine/InkFlooder';
import { THEMES, type Theme } from './themes';

const C = {
  obstacle: 0x94A3B8,
  obstacleStroke: 0x64748B,
};

const PULSE_MS = 2000;

export class PixiRenderer {
  private app!: Application;
  private boardContainer = new Container();
  private previewContainer = new Container();
  private sourcesContainer = new Container();
  private targetsContainer = new Container();
  private board: GameBoard | null = null;
  private colorblindMode = false;
  private theme: Theme = THEMES[0];
  private cellSize = 0;
  private offsetX = 0;
  private offsetY = 0;
  private startTime = 0;
  private sourceSprites = new Map<string, Container>();

  onSourceClick?: (sourceId: string) => void;

  private constructor() {}

  static async create(container: HTMLElement): Promise<PixiRenderer> {
    const r = new PixiRenderer();

    r.app = new Application();
    await r.app.init({
      width: container.clientWidth || 400,
      height: container.clientHeight || 400,
      background: r.theme.cssBg,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // 将 PixiJS 创建的 canvas 添加到容器
    r.app.canvas.style.width = '100%';
    r.app.canvas.style.height = '100%';
    r.app.canvas.style.display = 'block';
    r.app.canvas.style.touchAction = 'none';
    container.appendChild(r.app.canvas);

    r.app.stage.addChild(r.boardContainer);
    r.app.stage.addChild(r.previewContainer);
    r.app.stage.addChild(r.targetsContainer);
    r.app.stage.addChild(r.sourcesContainer);
    r.app.stage.eventMode = 'static';
    r.app.stage.hitArea = r.app.screen;
    r.startTime = performance.now();

    r.app.ticker.add(() => r.updateSources());
    return r;
  }

  setBoard(board: GameBoard): void {
    this.board = board;
    this.layoutAndDraw();
  }

  setColorblindMode(on: boolean): void {
    this.colorblindMode = on;
    this.layoutAndDraw();
  }

  setTheme(themeId: string): void {
    this.theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
    this.layoutAndDraw();
  }

  private layoutAndDraw(): void {
    if (!this.board) return;

    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const { rows, cols } = this.board;

    const maxW = (w - 24) / cols;
    const maxH = (h - 24) / rows;
    this.cellSize = Math.floor(Math.min(maxW, maxH));

    const bw = this.cellSize * cols;
    const bh = this.cellSize * rows;
    this.offsetX = Math.floor((w - bw) / 2);
    this.offsetY = Math.floor((h - bh) / 2);

    this.boardContainer.removeChildren();
    this.previewContainer.removeChildren();
    this.sourcesContainer.removeChildren();
    this.targetsContainer.removeChildren();
    this.sourceSprites.clear();

    this.drawGrid();
    this.drawCells();
  }

  /* ========== 网格 ========== */

  private drawGrid(): void {
    if (!this.board) return;
    const g = new Graphics();
    const cs = this.cellSize;
    const ox = this.offsetX;
    const oy = this.offsetY;
    const bw = cs * this.board.cols;
    const bh = cs * this.board.rows;

    g.rect(ox, oy, bw, bh).fill(this.theme.emptyCell);
    g.setStrokeStyle({ width: 0.5, color: this.theme.gridLine });
    for (let i = 0; i <= this.board.rows; i++) {
      const y = oy + i * cs;
      g.moveTo(ox, y).lineTo(ox + bw, y);
    }
    for (let j = 0; j <= this.board.cols; j++) {
      const x = ox + j * cs;
      g.moveTo(x, oy).lineTo(x, oy + bh);
    }
    g.stroke();
    this.boardContainer.addChild(g);
  }

  /* ========== 格子 ========== */

  private drawCells(): void {
    if (!this.board) return;
    const cs = this.cellSize;
    const ox = this.offsetX;
    const oy = this.offsetY;
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const cell = this.board.cells[r][c];
        const x = ox + c * cs;
        const y = oy + r * cs;
        const s = cs;

        switch (cell.type) {
          case CellType.Filled: {
            const color = parseInt(cell.color!.replace('#', ''), 16);
            const g = new Graphics();
            g.rect(x, y, s, s).fill(color);
            g.rect(x, y, s, s).stroke({ width: 0.5, color: 0x000000, alpha: 0.08 });
            this.boardContainer.addChild(g);

            // 色盲模式图案叠加
            if (this.colorblindMode) {
              this.drawPattern(x, y, s, cell.color!);
            }
            break;
          }
          case CellType.Obstacle: {
            const g = new Graphics();
            g.rect(x, y, s, s).fill(C.obstacle);
            g.setStrokeStyle({ width: 1, color: C.obstacleStroke, alpha: 0.6 });
            g.moveTo(x, y).lineTo(x + s, y + s);
            g.moveTo(x + s, y).lineTo(x, y + s);
            g.stroke();
            this.boardContainer.addChild(g);
            break;
          }
          case CellType.Source: {
            this.createSource(r, c, cell.color!, cell.sourceId!);
            break;
          }
        }
      }
    }
    this.drawTargets();
  }

  /* ========== 色盲模式图案 ========== */

  private readonly COLOR_PATTERN: Record<string, number> = {
    '#EF4444': 0, '#3B82F6': 1, '#F59E0B': 2, '#10B981': 3, '#EC4899': 4,
    '#F97316': 2, '#8B5CF6': 1, '#06B6D4': 1, '#FB7185': 0, '#7C3AEA': 1, '#78716C': 3,
  };

  private drawPattern(x: number, y: number, size: number, colorHex: string): void {
    const pattern = this.COLOR_PATTERN[colorHex] ?? 0;
    const g = new Graphics();
    const pad = 3;
    const alpha = 0.75;

    switch (pattern) {
      case 0: // 横线 — red系
        g.setStrokeStyle({ width: 1.5, color: 0xFFFFFF, alpha });
        for (let py = y + pad; py < y + size - pad; py += 4) {
          g.moveTo(x + pad, py).lineTo(x + size - pad, py);
        }
        g.stroke();
        break;
      case 1: { // 圆点 — blue系
        for (let py = y + pad + 2; py < y + size - pad; py += 6) {
          for (let px = x + pad + 2; px < x + size - pad; px += 6) {
            g.circle(px, py, 1.2).fill({ color: 0xFFFFFF, alpha });
          }
        }
        break;
      }
      case 2: // 斜线 — yellow系
        g.setStrokeStyle({ width: 1.5, color: 0xFFFFFF, alpha });
        for (let d = -size; d < size * 2; d += 5) {
          g.moveTo(x + pad, y + pad + d).lineTo(x + pad + d, y + pad);
        }
        g.stroke();
        break;
      case 3: // 交叉 — green系
        g.setStrokeStyle({ width: 1, color: 0xFFFFFF, alpha });
        for (let d = -size; d < size * 2; d += 6) {
          g.moveTo(x + pad, y + pad + d).lineTo(x + pad + d, y + pad);
          g.moveTo(x + size - pad, y + pad + d).lineTo(x + size - pad - d, y + pad);
        }
        g.stroke();
        break;
      case 4: // 网格 — magenta系
        g.setStrokeStyle({ width: 1, color: 0xFFFFFF, alpha });
        for (let py = y + pad; py < y + size - pad; py += 5) {
          g.moveTo(x + pad, py).lineTo(x + size - pad, py);
        }
        for (let px = x + pad; px < x + size - pad; px += 5) {
          g.moveTo(px, y + pad).lineTo(px, y + size - pad);
        }
        g.stroke();
        break;
    }
    this.boardContainer.addChild(g);
  }

  /* ========== 源点 ========== */

  private createSource(row: number, col: number, colorHex: string, sourceId: string): void {
    const cs = this.cellSize;
    const cx = this.offsetX + col * cs + cs / 2;
    const cy = this.offsetY + row * cs + cs / 2;
    const color = parseInt(colorHex.replace('#', ''), 16);
    const r = cs * 0.3;

    const ctr = new Container();
    ctr.x = cx;
    ctr.y = cy;
    ctr.label = sourceId;
    ctr.eventMode = 'static';
    ctr.cursor = 'pointer';
    ctr.hitArea = new Rectangle(-r - 4, -r - 4, (r + 4) * 2, (r + 4) * 2);
    ctr.on('pointertap', () => this.onSourceClick?.(sourceId));

    // hover 预览
    ctr.on('pointerover', () => this.showPreview(sourceId));
    ctr.on('pointerout', () => this.hidePreview());

    const glow = new Graphics();
    glow.circle(0, 0, r + 2).fill({ color: this.theme.sourceGlow, alpha: 0.25 });
    ctr.addChild(glow);

    const bgc = new Graphics();
    bgc.circle(0, 0, r).fill(0xFFFFFF);
    ctr.addChild(bgc);

    const ink = new Graphics();
    ink.circle(0, 0, r * 0.65).fill(color);
    ctr.addChild(ink);

    const hl = new Graphics();
    hl.circle(-r * 0.2, -r * 0.2, r * 0.25).fill({ color: 0xFFFFFF, alpha: 0.4 });
    ctr.addChild(hl);

    this.sourcesContainer.addChild(ctr);
    this.sourceSprites.set(sourceId, ctr);
  }

  /* ========== 目标标记 ========== */

  private drawTargets(): void {
    if (!this.board || this.board.targets.length === 0) return;
    const cs = this.cellSize;
    const ox = this.offsetX;
    const oy = this.offsetY;

    for (const t of this.board.targets) {
      const cx = ox + t.col * cs + cs / 2;
      const cy = oy + t.row * cs + cs / 2;
      const sz = cs * 0.18;
      const color = parseInt(t.color.replace('#', ''), 16);
      const cell = this.board.cells[t.row][t.col];
      const satisfied = cell.type === CellType.Filled && cell.color === t.color;

      const g = new Graphics();
      g.setStrokeStyle({ width: 2, color: satisfied ? 0x10B981 : 0xF59E0B });
      g.moveTo(cx, cy - sz).lineTo(cx + sz, cy).lineTo(cx, cy + sz).lineTo(cx - sz, cy);
      g.closePath().stroke();
      g.circle(cx, cy, sz * 0.45).fill(color);
      g.circle(cx, cy, sz * 0.8).fill({ color: satisfied ? 0x10B981 : 0xF59E0B, alpha: 0.15 });
      this.targetsContainer.addChild(g);
    }
  }

  /* ========== hover 预览 ========== */

  private showPreview(sourceId: string): void {
    if (!this.board) return;
    const result = previewFlood(this.board, sourceId);
    this.previewContainer.removeChildren();

    const cs = this.cellSize;
    for (const { row, col, color } of result.cells) {
      const hex = parseInt(color.replace('#', ''), 16);
      const g = new Graphics();
      const x = this.offsetX + col * cs + 2;
      const y = this.offsetY + row * cs + 2;
      const s = cs - 4;
      g.rect(x, y, s, s).fill({ color: hex, alpha: 0.35 });
      this.previewContainer.addChild(g);
    }
  }

  private hidePreview(): void {
    this.previewContainer.removeChildren();
  }

  /* ========== 脉动动画 ========== */

  private updateSources(): void {
    if (!this.board) return;
    const now = performance.now();
    const t = (now - this.startTime) % PULSE_MS;
    const pulse = 1 + 0.06 * Math.sin((t / PULSE_MS) * Math.PI * 2);

    for (const src of this.board.sources) {
      const sprite = this.sourceSprites.get(src.id);
      if (!sprite) continue;
      sprite.scale.set(src.activated ? 0.4 : pulse);
    }
  }

  /* ========== 生命周期 ========== */

  refresh(): void {
    if (!this.board) return;
    const canvas = this.app.canvas as HTMLCanvasElement;
    const parent = canvas.parentElement;
    if (parent) {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w > 0 && h > 0) {
        this.app.renderer.resize(w, h);
      }
    }
    this.layoutAndDraw();
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
    this.board = null;
  }
}
