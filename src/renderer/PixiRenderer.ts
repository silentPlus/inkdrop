/**
 * PixiRenderer — PixiJS v8 渲染引擎
 */
import { Application, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { CellType, GameBoard } from '../engine/GameBoard';
import { previewFlood, type FloodAffected, type MixEvent, type ObstacleHit } from '../engine/InkFlooder';
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
  private gridContainer = new Container(); // 网格线独立容器，置顶
  private mixOverlayContainer = new Container(); // 颜色混合过渡叠加
  private particlesContainer = new Container(); // 粒子尾迹
  private mixPreviewContainer = new Container(); // 混合预览环（方案 C）
  private board: GameBoard | null = null;
  private colorblindMode = false;
  private theme: Theme = THEMES[0];
  private cellSize = 0;
  private offsetX = 0;
  private offsetY = 0;
  private startTime = 0;
  private sourceSprites = new Map<string, Container>();
  private cellContainerMap = new Map<string, Container>();
  private obstacleMap = new Map<string, Container>();     // 障碍物震动用
  private obstacleBasePos = new Map<string, { x: number; y: number }>(); // 原始坐标

  // 预览模式（手机端替代长按）
  previewMode = false;
  private activePreviewSourceId: string | null = null;

  // 水彩纹理
  private textures: Texture[] = [];
  private texturesGenerated = false;

  // 扩散动画状态
  private floodCells: FloodAffected[] | null = null;
  private floodMixes: MixEvent[] = [];
  private floodObstacles: ObstacleHit[] = [];
  private floodStartTime = 0;

  // 撤销动画状态
  private undoCells: FloodAffected[] | null = null;
  private undoStartTime = 0;

  // 粒子
  private particles: Array<{ x: number; y: number; vx: number; vy: number; color: number; alpha: number; size: number; life: number; maxLife: number }> = [];

  onSourceClick?: (sourceId: string) => void;
  onFloodComplete?: () => void;
  onUndoComplete?: () => void;

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
    r.app.stage.addChild(r.mixPreviewContainer); // 混合预览环：targets之上、source之下
    r.app.stage.addChild(r.mixOverlayContainer);
    r.app.stage.addChild(r.sourcesContainer);
    r.app.stage.addChild(r.particlesContainer);
    r.app.stage.addChild(r.gridContainer); // 网格线在最顶层，不被任何元素覆盖
    r.gridContainer.eventMode = 'none'; // 透传点击
    r.mixOverlayContainer.eventMode = 'none';
    r.mixPreviewContainer.eventMode = 'none';
    r.particlesContainer.eventMode = 'none';
    r.app.stage.eventMode = 'static';
    r.app.stage.hitArea = r.app.screen;
    // 预览模式下点击空白区域取消预览
    r.app.stage.on('pointertap', () => {
      if (r.previewMode && r.activePreviewSourceId) {
        r.clearActivePreview();
      }
    });
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
    this.gridContainer.removeChildren();
    this.mixOverlayContainer.removeChildren();
    this.particlesContainer.removeChildren();
    this.mixPreviewContainer.removeChildren();
    this.sourceSprites.clear();
    this.cellContainerMap.clear();
    this.obstacleMap.clear();
    this.obstacleBasePos.clear();
    this.activePreviewSourceId = null;

    this.drawCells();
    this.drawGrid();
    this.updatePreviewIndicator();
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

    // 网格线用细矩形逐条绘制，避免 PixiJS v8 moveTo/lineTo 与 fill 的路径冲突
    for (let i = 0; i <= this.board.rows; i++) {
      const y = oy + i * cs;
      g.rect(ox, y, bw, 0.5).fill(this.theme.gridLine);
    }
    for (let j = 0; j <= this.board.cols; j++) {
      const x = ox + j * cs;
      g.rect(x, oy, 0.5, bh).fill(this.theme.gridLine);
    }
    this.gridContainer.addChild(g);
  }

  /* ========== 水彩纹理 ========== */

  private generateTextures(): void {
    if (this.texturesGenerated) return;
    this.texturesGenerated = true;

    const texSize = 64;
    const dpr = window.devicePixelRatio || 1;

    for (let t = 0; t < 8; t++) {
      const offscreen = document.createElement('canvas');
      offscreen.width = texSize * dpr;
      offscreen.height = texSize * dpr;
      const tctx = offscreen.getContext('2d')!;
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 不规则透明斑点模拟水彩纹理
      const seed = t * 137;
      for (let i = 0; i < 30; i++) {
        const cx = ((seed + i * 73) % 100) / 100 * texSize;
        const cy = ((seed + i * 47) % 100) / 100 * texSize;
        const r = 2 + ((seed + i * 31) % 8);
        const alpha = 0.02 + ((seed + i * 19) % 10) / 100;

        tctx.fillStyle = `rgba(255,255,255,${alpha})`;
        tctx.beginPath();
        tctx.arc(cx, cy, r, 0, Math.PI * 2);
        tctx.fill();
      }

      this.textures.push(Texture.from(offscreen));
    }
  }

  /** 为格子添加水彩纹理叠加层 */
  private addWatercolorOverlay(ctr: Container, row: number, col: number, size: number): void {
    this.generateTextures();
    const tex = this.textures[Math.abs((row * 31 + col * 17)) % 8];
    const sprite = new Sprite(tex);
    sprite.width = size;
    sprite.height = size;
    sprite.alpha = 0.3;
    sprite.blendMode = 'screen';
    const h = size / 2;
    sprite.x = -h;
    sprite.y = -h;
    ctr.addChild(sprite);
  }

  /* ========== 格子 ========== */

  private drawCells(): void {
    if (!this.board) return;
    const cs = this.cellSize;
    const ox = this.offsetX;
    const oy = this.offsetY;
    const bw = cs * this.board.cols;
    const bh = cs * this.board.rows;

    // 棋盘底色（置于 boardContainer 最下层，不遮挡源点和目标）
    const bg = new Graphics();
    bg.rect(ox, oy, bw, bh).fill(this.theme.emptyCell);
    this.boardContainer.addChild(bg);

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
            fill.roundRect(-h, -h, s, s, 3).fill(color);
            fill.roundRect(-h, -h, s, s, 3).stroke({ width: 0.5, color: 0x000000, alpha: 0.06 });
            ctr.addChild(fill);
            // 水彩纹理叠加
            this.addWatercolorOverlay(ctr, r, c, s);
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
            // Container 会负责定位，Graphics 用相对坐标 (0,0)
            g.rect(0, 0, s, s).fill(C.obstacle);
            g.setStrokeStyle({ width: 1, color: C.obstacleStroke, alpha: 0.6 });
            g.moveTo(0, 0).lineTo(s, s);
            g.moveTo(s, 0).lineTo(0, s);
            g.stroke();
            const ctr = new Container();
            ctr.x = x;
            ctr.y = y;
            ctr.addChild(g);
            this.boardContainer.addChild(ctr);
            this.obstacleMap.set(`${r},${c}`, ctr);
            this.obstacleBasePos.set(`${r},${c}`, { x, y });
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
    // 点击处理：预览模式 vs 直接扩散
    ctr.on('pointertap', (e) => {
      e.stopPropagation();
      if (this.previewMode) {
        this.handlePreviewTap(sourceId);
      } else {
        this.onSourceClick?.(sourceId);
      }
    });

    // hover 预览（桌面端）
    ctr.on('pointerover', () => {
      if (!this.previewMode) this.showPreview(sourceId);
    });
    ctr.on('pointerout', () => {
      if (!this.previewMode) this.hidePreview();
    });

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
    this.mixPreviewContainer.removeChildren();

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

    // 方案 C：在会被混合的源点上绘制外圈，展示混合结果色
    for (const mix of result.mixes) {
      const srcSprite = this.sourceSprites.get(mix.sourceId);
      if (!srcSprite) continue;
      const hex = parseInt(mix.newColor.replace('#', ''), 16);
      // 外圈光环：混合后颜色
      const ring = new Graphics();
      ring.circle(0, 0, cs * 0.42).fill({ color: hex, alpha: 0.25 });
      ring.circle(0, 0, cs * 0.42).stroke({ width: 2.5, color: hex });
      ring.circle(0, 0, cs * 0.48).stroke({ width: 1, color: hex, alpha: 0.4 });
      ring.x = srcSprite.x;
      ring.y = srcSprite.y;
      this.mixPreviewContainer.addChild(ring);
    }
  }

  private hidePreview(): void {
    this.previewContainer.removeChildren();
    this.mixPreviewContainer.removeChildren();
  }

  /* ========== 预览模式（手机端） ========== */

  /** 开启/关闭预览模式 */
  setPreviewMode(enabled: boolean): void {
    this.previewMode = enabled;
    this.clearActivePreview();
    this.updatePreviewIndicator();
  }

  /** 预览模式下点击源点的处理 */
  private handlePreviewTap(sourceId: string): void {
    if (this.activePreviewSourceId === null) {
      // 首次点击：显示预览
      this.activePreviewSourceId = sourceId;
      this.showPreview(sourceId);
      this.updatePreviewIndicator();
    } else if (this.activePreviewSourceId === sourceId) {
      // 再次点击同一源点：确认扩散
      this.clearActivePreview();
      this.onSourceClick?.(sourceId);
    } else {
      // 切换到另一个源点
      this.activePreviewSourceId = sourceId;
      this.showPreview(sourceId);
      this.updatePreviewIndicator();
    }
  }

  /** 清除活动预览 */
  clearActivePreview(): void {
    this.activePreviewSourceId = null;
    this.hidePreview();
    this.updatePreviewIndicator();
  }

  /** 更新源点的预览模式视觉指示（虚线外环） */
  private updatePreviewIndicator(): void {
    // 清除所有源点的指示器
    for (const [, sprite] of this.sourceSprites) {
      // 移除已有的指示器（通过 label 识别）
      const existing = sprite.getChildByLabel('preview-indicator');
      if (existing) sprite.removeChild(existing);
    }

    if (!this.previewMode) return;

    const cs = this.cellSize;
    // 为所有可点击的源点添加虚线环
    for (const src of this.board?.sources ?? []) {
      if (src.activated) continue;
      const sprite = this.sourceSprites.get(src.id);
      if (!sprite) continue;

      const indicator = new Graphics();
      indicator.label = 'preview-indicator';
      const isActive = src.id === this.activePreviewSourceId;
      const color = isActive ? 0x7C3AED : 0x94A3B8;
      const alpha = isActive ? 0.6 : 0.3;

      // 虚线外环
      const r = cs * 0.35;
      // 用点线转描边
      indicator.setStrokeStyle({ width: 2, color, alpha });
      const segments = 16;
      for (let i = 0; i < segments; i++) {
        const a1 = (i / segments) * Math.PI * 2;
        const a2 = ((i + 0.5) / segments) * Math.PI * 2;
        indicator.moveTo(Math.cos(a1) * r, Math.sin(a1) * r);
        indicator.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
      }
      indicator.stroke();

      // 激活源点额外的高亮光晕
      if (isActive) {
        indicator.circle(0, 0, r + 2).stroke({ width: 1.5, color: 0x7C3AED, alpha: 0.4 });
      }

      sprite.addChildAt(indicator, 0);
    }
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
  animateFlood(affected: FloodAffected[], mixes: MixEvent[], obstaclesHit: ObstacleHit[]): void {
    this.floodCells = affected;
    this.floodMixes = mixes;
    this.floodObstacles = obstaclesHit;
    this.floodStartTime = performance.now();
    this.layoutAndDraw(); // 重绘，affected 格子初始 scale=0.15 / alpha=0
    this.app.ticker.add(this.updateFlood, this);
  }

  /** 每格独立动画时长 (ms) */
  private readonly ANIM_DURATION = 300;

  /** 颜色混合过渡时长 (ms) */
  private readonly MIX_DURATION = 400;

  /** 障碍物震动时长 (ms) */
  private readonly SHAKE_DURATION = 200;

  private updateFlood = (): void => {
    if (!this.floodCells || this.floodCells.length === 0) {
      this.finishFlood();
      return;
    }
    const elapsed = performance.now() - this.floodStartTime;
    let allDone = true;

    // 1. 墨滴膨胀动画
    for (const c of this.floodCells) {
      const ctr = this.cellContainerMap.get(`${c.row},${c.col}`);
      if (!ctr) continue;

      const localT = (elapsed - c.delay) / this.ANIM_DURATION;
      if (localT < 0) {
        allDone = false;
        continue;
      }

      const t = Math.min(localT, 1);
      const ease = 1 - Math.pow(1 - t, 3);

      ctr.scale.set(0.15 + 0.85 * ease);
      ctr.alpha = ease;

      // 粒子尾迹：格子开始可见时发射 2-3 个粒子
      if (localT >= 0 && localT < 0.2) {
        this.emitParticles(c.row, c.col, c.color);
      }

      if (t < 1) allDone = false;
    }

    // 2. 颜色混合涡旋过渡
    for (const mix of this.floodMixes) {
      this.animateMixOverlay(mix, elapsed);
    }

    // 3. 障碍物震动
    for (const ob of this.floodObstacles) {
      this.animateObstacleShake(ob, elapsed);
    }

    // 4. 粒子生命周期
    this.updateParticles();

    if (allDone) {
      this.finishFlood();
    }
  };

  /* -------- 颜色混合涡旋过渡 -------- */

  private animateMixOverlay(mix: MixEvent, elapsed: number): void {
    const key = `${mix.sourceRow},${mix.sourceCol}`;
    const ctr = this.cellContainerMap.get(key);
    if (!ctr) return;

    // 找到对应格子最后的 delay
    let delay = 0;
    if (this.floodCells) {
      for (const c of this.floodCells) {
        if (c.row === mix.sourceRow && c.col === mix.sourceCol) {
          delay = c.delay;
          break;
        }
      }
    }

    const localT = (elapsed - delay - 50) / this.MIX_DURATION; // 格子膨胀完成后 50ms 开始混合
    if (localT < 0) return;

    const t = Math.min(localT, 1);
    // easeInOutQuad
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    // 在叠加层绘制旧色圆环 → 逐渐缩小/透明，露出下方新色
    this.mixOverlayContainer.removeChildren();
    if (t >= 1) return;

    const cs = this.cellSize;
    const cx = this.offsetX + mix.sourceCol * cs + cs / 2;
    const cy = this.offsetY + mix.sourceRow * cs + cs / 2;
    const maxR = cs * 0.35;
    const r = maxR * (1 - ease);
    const alpha = 1 - ease;
    const oldColor = parseInt(mix.oldColor.replace('#', ''), 16);

    const g = new Graphics();
    g.circle(cx, cy, r).fill({ color: oldColor, alpha });
    g.circle(cx, cy, r).stroke({ width: 2, color: 0xFFFFFF, alpha: alpha * 0.5 });
    this.mixOverlayContainer.addChild(g);
  }

  /* -------- 障碍物震动 -------- */

  private animateObstacleShake(ob: ObstacleHit, elapsed: number): void {
    const key = `${ob.row},${ob.col}`;
    const ctr = this.obstacleMap.get(key);
    const base = this.obstacleBasePos.get(key);
    if (!ctr || !base) return;

    const localT = (elapsed - ob.delay) / this.SHAKE_DURATION;
    if (localT < 0 || localT > 1) {
      ctr.x = base.x;
      ctr.y = base.y;
      return;
    }

    // 快速衰减正弦震动（偏移叠加在原始位置上）
    const decay = 1 - localT;
    const freq = 30;
    const amp = 2 * decay;
    ctr.x = base.x + Math.sin(localT * freq) * amp;
    ctr.y = base.y + Math.cos(localT * freq * 1.3) * amp;
  }

  /* -------- 粒子尾迹 -------- */

  private emitParticles(row: number, col: number, colorHex: string): void {
    const cs = this.cellSize;
    const cx = this.offsetX + col * cs + cs / 2;
    const cy = this.offsetY + row * cs + cs / 2;
    const color = parseInt(colorHex.replace('#', ''), 16);
    const count = 2 + Math.floor(Math.random() * 2); // 2-3 个

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 0.8;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * cs * 0.3,
        y: cy + (Math.random() - 0.5) * cs * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 0.8,
        size: 1.5 + Math.random() * 2,
        life: 0,
        maxLife: 400 + Math.random() * 300,
      });
    }
  }

  private updateParticles(): void {
    this.particlesContainer.removeChildren();
    const alive: typeof this.particles = [];

    for (const p of this.particles) {
      p.life += this.app.ticker.deltaMS;
      if (p.life >= p.maxLife) continue;

      p.x += p.vx;
      p.y += p.vy;
      const progress = p.life / p.maxLife;
      p.alpha = 0.8 * (1 - progress);

      const g = new Graphics();
      g.circle(p.x, p.y, p.size * (1 - progress * 0.5)).fill({ color: p.color, alpha: p.alpha });
      this.particlesContainer.addChild(g);

      alive.push(p);
    }
    this.particles = alive;
  }

  private finishFlood(): void {
    this.floodCells = null;
    this.floodMixes = [];
    this.floodObstacles = [];
    this.mixOverlayContainer.removeChildren();
    this.app.ticker.remove(this.updateFlood, this);
    // 确保所有格子都归位 + 障碍物复位（兜底）
    for (const ctr of this.cellContainerMap.values()) {
      ctr.scale.set(1);
      ctr.alpha = 1;
    }
    for (const [key, ctr] of this.obstacleMap.entries()) {
      const base = this.obstacleBasePos.get(key);
      if (base) { ctr.x = base.x; ctr.y = base.y; }
    }
    // 粒子自然消散，不强制清除
    this.onFloodComplete?.();
  }

  /* ========== 撤销回缩动画 ========== */

  /** 反向播放扩散动画：已填充格子从 scale=1 → 0.15 收缩消失 */
  animateUndo(affected: FloodAffected[]): void {
    // 按 delay 降序排列（距离最远的先收缩，靠近源点的后收缩）
    const reversed = [...affected].sort((a, b) => b.delay - a.delay);
    // 重新计算 delay：最远的 delay=0，最近的 delay 最大
    const maxDelay = reversed.length > 0 ? reversed[0].delay : 0;
    for (const c of reversed) {
      c.delay = maxDelay - c.delay;
    }

    this.undoCells = reversed;
    this.undoStartTime = performance.now();
    this.app.ticker.add(this.updateUndo, this);
  }

  private updateUndo = (): void => {
    if (!this.undoCells || this.undoCells.length === 0) {
      this.finishUndo();
      return;
    }
    const elapsed = performance.now() - this.undoStartTime;
    let allDone = true;

    for (const c of this.undoCells) {
      const ctr = this.cellContainerMap.get(`${c.row},${c.col}`);
      if (!ctr) continue;

      const localT = (elapsed - c.delay) / this.ANIM_DURATION;
      if (localT < 0) {
        allDone = false;
        continue;
      }

      const t = Math.min(localT, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic

      ctr.scale.set(1 - 0.85 * ease);  // 1 → 0.15
      ctr.alpha = 1 - ease;            // 1 → 0

      // 收缩时也发射粒子（墨水回缩的尾迹感）
      if (localT >= 0 && localT < 0.15) {
        const cell = this.board?.cells[c.row]?.[c.col];
        if (cell?.color) this.emitParticles(c.row, c.col, cell.color);
      }

      if (t < 1) allDone = false;
    }

    this.updateParticles();

    if (allDone) {
      this.finishUndo();
    }
  };

  private finishUndo(): void {
    this.undoCells = null;
    this.app.ticker.remove(this.updateUndo, this);
    for (const ctr of this.cellContainerMap.values()) {
      ctr.scale.set(1);
      ctr.alpha = 1;
    }
    this.onUndoComplete?.();
  }

  /** 导出当前画布为 PNG data URL */
  captureImage(): string {
    return (this.app.canvas as HTMLCanvasElement).toDataURL('image/png');
  }

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
