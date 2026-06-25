/**
 * CanvasRenderer — Canvas 2D 渲染引擎
 *
 * 负责将 GameBoard 状态渲染到 Canvas 上：
 * - 棋盘网格线
 * - 空格 / 障碍物 / 源点 / 已填充格子的不同渲染
 * - 源点呼吸动画（脉动）
 * - 点击热区检测
 */
import { CellType, GameBoard } from '../engine/GameBoard';

/* ====================== 配色常量 ====================== */

const COLORS = {
  bg:            '#F5F0EB',   // 宣纸底色
  grid:          '#E6DFD3',   // 网格线
  empty:         '#FAF7F2',   // 空格底色
  obstacle:      '#94A3B8',   // 障碍物
  obstacleStroke:'#64748B',
  sourceRing:    'rgba(124, 58, 237, 0.5)', // 源点脉动环
  sourceInner:   'white',
  highlight:     'rgba(124, 58, 237, 0.18)', // hover 高亮
};

/** 动画时间 */
const PULSE_DURATION = 2000; // 脉动周期 ms

/* ====================== 主类 ====================== */

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private board: GameBoard | null = null;

  /** 布局参数 */
  private cellSize = 0;
  private offsetX = 0;
  private offsetY = 0;

  /** 动画状态 */
  private animFrameId = 0;
  private startTime = 0;

  /** 交互状态 */
  private hoveredCell: { row: number; col: number } | null = null;
  private previewCells: Map<string, string> = new Map(); // "r,c" → color hex

  /** 回调 */
  onSourceClick?: (sourceId: string) => void;

  /* ====================== 构造 / 挂载 ====================== */

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.bindEvents();
  }

  /** 绑定 canvas 交互事件 */
  private bindEvents(): void {
    // 点击
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    // 触摸
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleClick(e.touches[0]);
    }, { passive: false });
    // hover
    this.canvas.addEventListener('mousemove', (e) => this.handleHover(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredCell = null;
    });
  }

  /** Canvas 坐标 → 格子坐标 */
  private eventToCell(e: { clientX: number; clientY: number }): { row: number; col: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor((x - this.offsetX) / this.cellSize);
    const row = Math.floor((y - this.offsetY) / this.cellSize);

    if (!this.board) return null;
    if (row < 0 || row >= this.board.rows || col < 0 || col >= this.board.cols) return null;

    // 检查是否在格子内边距范围内
    const cx = this.offsetX + col * this.cellSize + this.cellSize / 2;
    const cy = this.offsetY + row * this.cellSize + this.cellSize / 2;
    const dx = x - cx;
    const dy = y - cy;
    const hitRadius = this.cellSize * 0.4;
    if (dx * dx + dy * dy > hitRadius * hitRadius) return null;

    return { row, col };
  }

  private handleClick(e: { clientX: number; clientY: number }): void {
    const cell = this.eventToCell(e);
    if (!cell || !this.board) return;

    const src = this.board.getSourceAt(cell.row, cell.col);
    if (src && !src.activated) {
      this.onSourceClick?.(src.id);
    }
  }

  private handleHover(e: MouseEvent): void {
    const cell = this.eventToCell(e);
    this.hoveredCell = cell;
  }

  /* ====================== 布局计算 ====================== */

  /** 根据棋盘大小计算 cellSize 和偏移量 */
  private layout(): void {
    if (!this.board) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    // Canvas 物理像素
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;

    // cellSize 取宽高中较小的那个
    const maxCellW = (w - 24) / this.board.cols;
    const maxCellH = (h - 24) / this.board.rows;
    this.cellSize = Math.floor(Math.min(maxCellW, maxCellH));

    // 居中偏移
    const boardW = this.cellSize * this.board.cols;
    const boardH = this.cellSize * this.board.rows;
    this.offsetX = Math.floor((w - boardW) / 2);
    this.offsetY = Math.floor((h - boardH) / 2);
  }

  /* ====================== 渲染主循环 ====================== */

  setBoard(board: GameBoard): void {
    this.board = board;
    this.layout();
  }

  startRendering(): void {
    this.startTime = performance.now();
    const loop = (now: number) => {
      this.render(now);
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  stopRendering(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  /** 清理预览（hover/长按后调用） */
  clearPreview(): void {
    this.previewCells.clear();
  }

  /** 设置预览格子 */
  setPreview(cells: Array<{ row: number; col: number; color: string }>): void {
    this.previewCells.clear();
    for (const { row, col, color } of cells) {
      this.previewCells.set(`${row},${col}`, color);
    }
  }

  /* ====================== 绘制 ====================== */

  private render(now: number): void {
    if (!this.board) return;
    this.layout();

    const ctx = this.ctx;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    // 清空
    ctx.clearRect(0, 0, w, h);

    // 背景
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    // 棋盘区域背景
    const bw = this.cellSize * this.board.cols;
    const bh = this.cellSize * this.board.rows;
    ctx.fillStyle = '#FAF7F2';
    ctx.fillRect(this.offsetX, this.offsetY, bw, bh);

    this.drawGrid(ctx);
    this.drawCells(ctx, now);
    this.drawTargets(ctx);
    this.drawPreview(ctx);
    this.drawSources(ctx, now);
  }

  /** 绘制网格线 */
  private drawGrid(ctx: CanvasRenderingContext2D): void {
    if (!this.board) return;
    const cs = this.cellSize;
    const ox = this.offsetX;
    const oy = this.offsetY;
    const bw = cs * this.board.cols;
    const bh = cs * this.board.rows;

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;

    for (let i = 0; i <= this.board.rows; i++) {
      const y = oy + i * cs;
      ctx.beginPath();
      ctx.moveTo(ox, y);
      ctx.lineTo(ox + bw, y);
      ctx.stroke();
    }
    for (let j = 0; j <= this.board.cols; j++) {
      const x = ox + j * cs;
      ctx.beginPath();
      ctx.moveTo(x, oy);
      ctx.lineTo(x, oy + bh);
      ctx.stroke();
    }
  }

  /** 绘制空格 + 障碍物 + 已填充 */
  private drawCells(ctx: CanvasRenderingContext2D, _now: number): void {
    if (!this.board) return;
    const cs = this.cellSize;
    const ox = this.offsetX;
    const oy = this.offsetY;

    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const cell = this.board.cells[r][c];
        const x = ox + c * cs;
        const y = oy + r * cs;

        switch (cell.type) {
          case CellType.Empty:
            this.drawEmptyCell(ctx, x, y, cs);
            break;
          case CellType.Filled:
            this.drawFilledCell(ctx, x, y, cs, cell.color!);
            break;
          case CellType.Obstacle:
            this.drawObstacle(ctx, x, y, cs);
            break;
          case CellType.Source:
            // 源点背景先画空格
            this.drawEmptyCell(ctx, x, y, cs);
            // 源点自身由 drawSources 完成
            break;
        }
      }
    }
  }

  /** 绘制目标格标记（叠加在格子上方） */
  private drawTargets(ctx: CanvasRenderingContext2D): void {
    if (!this.board || this.board.targets.length === 0) return;
    const cs = this.cellSize;
    const ox = this.offsetX;
    const oy = this.offsetY;

    for (const t of this.board.targets) {
      const cx = ox + t.col * cs + cs / 2;
      const cy = oy + t.row * cs + cs / 2;
      const cell = this.board.cells[t.row][t.col];

      // 目标色小标记：菱形外框 + 中心色点
      const sz = cs * 0.2;

      // 菱形外框
      ctx.strokeStyle = cell.type === 1 /* filled */ && cell.color === t.color
        ? '#10B981'  // 已满足 → 绿色
        : '#F59E0B'; // 未满足 → 琥珀色
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - sz);
      ctx.lineTo(cx + sz, cy);
      ctx.lineTo(cx, cy + sz);
      ctx.lineTo(cx - sz, cy);
      ctx.closePath();
      ctx.stroke();

      // 中心目标色点
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(cx, cy, sz * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // 高亮背景（半透明）
      ctx.fillStyle = cell.type === 1 && cell.color === t.color
        ? 'rgba(16, 185, 129, 0.12)'
        : 'rgba(245, 158, 11, 0.10)';
      ctx.beginPath();
      ctx.arc(cx, cy, sz * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawEmptyCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.fillStyle = COLORS.empty;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  }

  /* ====================== 水彩纹理缓存 ====================== */
  private textureCache: Map<string, HTMLCanvasElement> = new Map();
  private texturesGenerated = false;

  /** 预生成水彩噪点纹理（离屏 Canvas） */
  private generateTextures(_size: number): void {
    if (this.texturesGenerated) return;
    this.texturesGenerated = true;

    const dpr = window.devicePixelRatio || 1;
    const texSize = 64;

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

      this.textureCache.set(`tex_${t}`, offscreen);
    }
  }

  private drawFilledCell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
  ): void {
    const pad = 2;

    // 底色
    ctx.fillStyle = color;
    ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);

    // 水彩纹理叠加
    this.generateTextures(size);
    const tex = this.textureCache.get(`tex_${Math.abs((x * 31 + y * 17)) % 8}`);
    if (tex) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.35;
      ctx.drawImage(tex, x + pad, y + pad, size - pad * 2, size - pad * 2);
      ctx.restore();
    }

    // 边缘加深（模拟水彩晕染）
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    const edge = Math.max(1, size * 0.06);
    // 四边
    ctx.fillRect(x + pad, y + pad, size - pad * 2, edge);                      // top
    ctx.fillRect(x + pad, y + size - pad - edge, size - pad * 2, edge);        // bottom
    ctx.fillRect(x + pad, y + pad, edge, size - pad * 2);                      // left
    ctx.fillRect(x + size - pad - edge, y + pad, edge, size - pad * 2);        // right
    ctx.restore();
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const pad = 3;
    ctx.fillStyle = COLORS.obstacle;
    ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);

    // 交叉纹理
    ctx.strokeStyle = COLORS.obstacleStroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + pad, y + pad);
    ctx.lineTo(x + size - pad, y + size - pad);
    ctx.moveTo(x + size - pad, y + pad);
    ctx.lineTo(x + pad, y + size - pad);
    ctx.stroke();
  }

  /** 绘制源点（叠加在格子上方） */
  private drawSources(ctx: CanvasRenderingContext2D, now: number): void {
    if (!this.board) return;
    const cs = this.cellSize;
    const ox = this.offsetX;
    const oy = this.offsetY;

    // 脉动系数
    const t = (now - this.startTime) % PULSE_DURATION;
    const pulse = 1 + 0.06 * Math.sin((t / PULSE_DURATION) * Math.PI * 2);

    for (const src of this.board.sources) {
      const cx = ox + src.col * cs + cs / 2;
      const cy = oy + src.row * cs + cs / 2;
      const r = (cs * 0.3) * pulse;

      if (src.activated) {
        // 已激活 → 小圆点标记
        ctx.fillStyle = src.color;
        ctx.beginPath();
        ctx.arc(cx, cy, cs * 0.12, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 未激活 → 脉动大圆
        // 外环光晕
        ctx.fillStyle = COLORS.sourceRing;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
        ctx.fill();

        // 白色底圆
        ctx.fillStyle = COLORS.sourceInner;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // 颜色水滴
        ctx.fillStyle = src.color;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
        ctx.fill();

        // 高光
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** 绘制预览格子（hover/长按） */
  private drawPreview(ctx: CanvasRenderingContext2D): void {
    if (!this.board) return;
    const cs = this.cellSize;
    const ox = this.offsetX;
    const oy = this.offsetY;

    for (const [key, color] of this.previewCells.entries()) {
      const [r, c] = key.split(',').map(Number);
      const x = ox + c * cs;
      const y = oy + r * cs;

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x + 2, y + 2, cs - 4, cs - 4);
      ctx.globalAlpha = 1;
    }

    // 单个 hover 高亮
    if (this.hoveredCell && this.previewCells.size === 0) {
      const { row, col } = this.hoveredCell;
      const src = this.board.getSourceAt(row, col);
      if (src && !src.activated) {
        const x = ox + col * cs;
        const y = oy + row * cs;
        ctx.fillStyle = COLORS.highlight;
        ctx.fillRect(x, y, cs, cs);
      }
    }
  }

  /* ====================== 生命周期 ====================== */

  destroy(): void {
    this.stopRendering();
    this.board = null;
  }
}
