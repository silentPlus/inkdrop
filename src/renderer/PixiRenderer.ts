/**
 * PixiRenderer — PixiJS v8 渲染引擎
 */
import { Application, Container, Graphics, Rectangle } from 'pixi.js';
import { CellType, GameBoard } from '../engine/GameBoard';
import { previewFlood, type FloodAffected } from '../engine/InkFlooder';
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
  private cellContainerMap = new Map<string, Container>();

  // 扩散动画状态
  private floodCells: FloodAffected[] | null = null;
  private floodStartTime = 0;

  onSourceClick?: (sourceId: string) => void;
  onFloodComplete?: () => void;

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
    this.refresh();
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
    this.cellContainerMap.clear();

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
            const cx = x + s / 2;
            const cy = y + s / 2;
            const h = s / 2;
            const ctr = new Container();
            ctr.x = cx;
            ctr.y = cy;
            const fill = new Graphics();
            fill.roundRect(-h, -h, s, s, s * 0.1).fill(color);
            fill.roundRect(-h, -h, s, s, s * 0.1).stroke({ width: 0.5, color: 0x000000, alpha: 0.06 });
            ctr.addChild(fill);
            // 扩散动画中未到时的格子：缩小+透明，随后从中心膨胀展开
            if (this.isFloodCell(r, c)) {
              ctr.scale.set(0.15);
              ctr.alpha = 0;
            }
            this.boardContainer.addChild(ctr);
            this.cellContainerMap.set(`${r},${c}`, ctr);
            // 色盲模式图案叠加
            if (this.colorblindMode) {
              ctr.addChild(this.buildPattern(s, cell.color!));
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

  /* ========== 色盲模式图案（相对坐标） ========== */

  private readonly COLOR_PATTERN: Record<string, number> = {
    '#EF4444': 0, '#3B82F6': 1, '#F59E0B': 2, '#10B981': 3, '#EC4899': 4,
    '#F97316': 2, '#8B5CF6': 1, '#06B6D4': 1, '#FB7185': 0, '#7C3AEA': 1, '#78716C': 3,
  };

  /** 返回绘制在相对坐标 (0,0) 处的色盲图案 Graphics */
  private buildPattern(size: number, colorHex: string): Graphics {
    const pattern = this.COLOR_PATTERN[colorHex] ?? 0;
    const g = new Graphics();
    const pad = 3;
    const alpha = 0.75;
    const h = size / 2;
    const x0 = -h + pad;
    const y0 = -h + pad;
    const x1 = h - pad;
    const y1 = h - pad;

    switch (pattern) {
      case 0: // 横线 — red系
        g.setStrokeStyle({ width: 1.5, color: 0xFFFFFF, alpha });
        for (let py = y0; py < y1; py += 4) {
          g.moveTo(x0, py).lineTo(x1, py);
        }
        g.stroke();
        break;
      case 1: { // 圆点 — blue系
        for (let py = y0 + 2; py < y1; py += 6) {
          for (let px = x0 + 2; px < x1; px += 6) {
            g.circle(px, py, 1.2).fill({ color: 0xFFFFFF, alpha });
          }
        }
        break;
      }
      case 2: // 斜线 — yellow系
        g.setStrokeStyle({ width: 1.5, color: 0xFFFFFF, alpha });
        for (let d = -size; d < size * 2; d += 5) {
          g.moveTo(x0, y0 + d).lineTo(x0 + d, y0);
        }
        g.stroke();
        break;
      case 3: // 交叉 — green系
        g.setStrokeStyle({ width: 1, color: 0xFFFFFF, alpha });
        for (let d = -size; d < size * 2; d += 6) {
          g.moveTo(x0, y0 + d).lineTo(x0 + d, y0);
          g.moveTo(x1, y0 + d).lineTo(x1 - d, y0);
        }
        g.stroke();
        break;
      case 4: // 网格 — magenta系
        g.setStrokeStyle({ width: 1, color: 0xFFFFFF, alpha });
        for (let py = y0; py < y1; py += 5) {
          g.moveTo(x0, py).lineTo(x1, py);
        }
        for (let px = x0; px < x1; px += 5) {
          g.moveTo(px, y0).lineTo(px, y1);
        }
        g.stroke();
        break;
    }
    return g;
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

  /* ========== 扩散动画 ========== */

  /** 检查某个格子是否属于当前扩散动画中尚未揭示的格子 */
  private isFloodCell(row: number, col: number): boolean {
    if (!this.floodCells) return false;
    for (const c of this.floodCells) {
      if (c.row === row && c.col === col) return true;
    }
    return false;
  }

  /** 启动逐格扩散动画（墨滴膨胀风格） */
  animateFlood(affected: FloodAffected[]): void {
    this.floodCells = affected;
    this.floodStartTime = performance.now();
    this.layoutAndDraw(); // 重绘，affected 格子初始 scale=0.15 / alpha=0
    this.app.ticker.add(this.updateFlood, this);
  }

  /** 每格独立动画时长 (ms) */
  private readonly ANIM_DURATION = 300;

  private updateFlood = (): void => {
    if (!this.floodCells || this.floodCells.length === 0) {
      this.finishFlood();
      return;
    }
    const elapsed = performance.now() - this.floodStartTime;
    let allDone = true;

    for (const c of this.floodCells) {
      const ctr = this.cellContainerMap.get(`${c.row},${c.col}`);
      if (!ctr) continue;

      const localT = (elapsed - c.delay) / this.ANIM_DURATION;
      if (localT < 0) {
        allDone = false;
        continue;
      }

      // easeOutCubic: 1 - (1-t)^3 —— 快速起势、缓慢收尾，像墨滴洇开
      const t = Math.min(localT, 1);
      const ease = 1 - Math.pow(1 - t, 3);

      ctr.scale.set(0.15 + 0.85 * ease);
      ctr.alpha = ease;

      if (t < 1) allDone = false;
    }

    if (allDone) {
      this.finishFlood();
    }
  };

  private finishFlood(): void {
    this.floodCells = null;
    this.app.ticker.remove(this.updateFlood, this);
    // 确保所有格子都归位（兜底）
    for (const ctr of this.cellContainerMap.values()) {
      ctr.scale.set(1);
      ctr.alpha = 1;
    }
    this.onFloodComplete?.();
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
