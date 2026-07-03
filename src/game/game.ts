import { LEVELS } from '../data/levels';
import type { LevelData } from '../data/levels';
import { GameState } from './GameState';
import { solvePuzzle } from './solver';
import { completeLevel } from './storage';

// 每关的主题色
const LEVEL_COLORS = [
  '#FF6A3D', '#F72585', '#3F7CFF', '#B8FF00',
  '#B43CFF', '#FF9A3D', '#45D8FF', '#4BF0A6',
  '#D84CFF', '#5A7BFF',
];

// 设计常量
const CELL_GAP = 6;
const DISPLAY_GRID_SIZE = 7;
const EMPTY_CELL_RADIUS_RATIO = 0.16;
const PATH_CELL_RADIUS_RATIO = 0.34;
const BOARD_PADDING_RATIO = 0.25;
const BOARD_RADIUS_RATIO = 0.42;
const MERGE_PULSE_DURATION = 190;

type Cell = { row: number; col: number };
type MergePulse = { cell: Cell; from: Cell; startedAt: number; duration: number };

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;

  private levelIndex = 0;
  private level!: LevelData;
  private state!: GameState;
  private pathColor = '#4FC3F7';
  private hintSolution: [number, number][] | null = null;
  private hintTimers: ReturnType<typeof setTimeout>[] = [];
  private mergePulse: MergePulse | null = null;
  private mergeAnimationFrame: number | null = null;

  private cellSize = 60;
  private boardPadding = 12;
  private gridOffsetX = 0;
  private gridOffsetY = 0;

  private trackProgress = true;
  private onLevelCompleteCallback?: (levelIndex: number) => void;
  private onProgressCallback?: (progress: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = window.devicePixelRatio || 1;
    this.setupInput();
  }

  // ── 加载关卡 ────────────────────────────────────────────────────────────
  load(levelIndex: number, options: { animate?: boolean; trackProgress?: boolean } = {}) {
    this.levelIndex = levelIndex;
    this.level = LEVELS[levelIndex];
    this.state = new GameState(this.level);
    this.trackProgress = options.trackProgress !== false;
    this.pathColor = LEVEL_COLORS[levelIndex % LEVEL_COLORS.length];
    this.hintSolution = solvePuzzle(this.level);
    this.clearMergePulse();
    this.clearHintTimers();

    this.resize();
    this.render();
    this.emitProgress();
    if (options.animate !== false) {
      this.playEnterAnimation();
    }
  }

  // ── 更新尺寸 ─────────────────────────────────────────────────────────────
  resize() {
    if (!this.level) return;
    const wrap = this.canvas.parentElement!;
    const wrapW = wrap.clientWidth;
    const wrapH = wrap.clientHeight;

    const rows = this.getDisplayRows();
    const cols = this.getDisplayCols();
    const maxBoardW = Math.min(wrapW - 36, 394);
    const maxBoardH = Math.min(wrapH - 18, 454);
    const reservedPadding = 24;
    const sizeByW = Math.floor((maxBoardW - reservedPadding * 2 - CELL_GAP * (cols - 1)) / cols);
    const sizeByH = Math.floor((maxBoardH - reservedPadding * 2 - CELL_GAP * (rows - 1)) / rows);
    this.cellSize = Math.max(34, Math.min(sizeByW, sizeByH, 86));
    this.boardPadding = Math.max(14, Math.min(24, Math.round(this.cellSize * BOARD_PADDING_RATIO)));

    const gridW = cols * this.cellSize + (cols - 1) * CELL_GAP;
    const gridH = rows * this.cellSize + (rows - 1) * CELL_GAP;

    const cw = gridW + this.boardPadding * 2;
    const ch = gridH + this.boardPadding * 2;
    this.canvas.style.width = `${cw}px`;
    this.canvas.style.height = `${ch}px`;
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);

    this.gridOffsetX = this.boardPadding;
    this.gridOffsetY = this.boardPadding;
  }

  // ── 主渲染 ──────────────────────────────────────────────────────────────
  render() {
    if (!this.level) return;
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    const pathSet = this.createPathSet(this.state.pathCells);
    this.drawBoardBase();
    this.drawBoardContents(() => {
      this.drawGrid(pathSet);
      this.drawPath();
      this.drawDots();
    });
    ctx.restore();
  }

  // ── 格子底层 ─────────────────────────────────────────────────────────────
  private drawBoardBase() {
    const ctx = this.ctx;
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    const radius = this.getBoardRadius();

    ctx.save();
    ctx.shadowColor = 'rgba(42, 31, 22, 0.16)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 8;
    this.roundRect(0, 0, width, height, radius);
    ctx.fillStyle = '#d8cfc3';
    ctx.fill();
    ctx.restore();

    this.roundRect(1, 1, width - 2, height - 2, Math.max(4, radius - 1));
    ctx.strokeStyle = 'rgba(29,29,29,0.06)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private drawGrid(excludedCells = new Set<string>()) {
    const { rows, cols, grid } = this.level;
    const s = this.cellSize;
    const r = this.getEmptyCellRadius();
    const displayRows = this.getDisplayRows();
    const displayCols = this.getDisplayCols();
    const { rowOffset, colOffset } = this.getDisplayOffset();

    for (let displayRow = 0; displayRow < displayRows; displayRow++) {
      for (let displayCol = 0; displayCol < displayCols; displayCol++) {
        const row = displayRow - rowOffset;
        const col = displayCol - colOffset;
        const isInLevel = row >= 0 && row < rows && col >= 0 && col < cols;
        const isActive = isInLevel && grid[row][col] === 1;
        const { px, py } = this.displayCellToPixel(displayRow, displayCol);

        if (!isActive) {
          this.drawInactiveCellTile(px, py, s, r);
          continue;
        }

        if (excludedCells.has(this.cellKey(row, col))) continue;
        this.drawCellTile(px, py, s, r);
      }
    }
  }

  // ── 路径连接线 ───────────────────────────────────────────────────────────
  private drawPath() {
    this.drawPathCells(this.state.pathCells, this.pathColor);
  }

  private drawPathCells(path: Cell[], color: string) {
    if (path.length === 0) return;
    const ctx = this.ctx;
    const r = this.getPathCellRadius();
    const now = performance.now();

    ctx.save();
    ctx.fillStyle = color;

    for (let i = 0; i < path.length - 1; i++) {
      this.drawPathConnector(path[i], path[i + 1], r);
    }

    path.forEach(cell => {
      const transform = this.getMergeCellTransform(cell, now);
      this.drawPathCell(cell, r, transform.scaleX, transform.scaleY);
    });
    ctx.restore();
  }

  // ── 起终点标记 ───────────────────────────────────────────────────────────
  private drawDots() {
    const ctx = this.ctx;
    const [sr, sc] = this.level.start;
    const [er, ec] = this.level.end;
    const s = this.cellSize;
    const half = s / 2;
    const ringR = s * 0.28;
    const ringW = Math.max(5, s * 0.08);

    const sp = this.cellToPixel(sr, sc);
    const sx = sp.px + half;
    const sy = sp.py + half;

    ctx.save();
    ctx.shadowColor = 'rgba(42,31,22,0.16)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = ringW;
    ctx.beginPath();
    ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const ep = this.cellToPixel(er, ec);
    const ex = ep.px + half;
    const ey = ep.py + half;

    ctx.save();
    ctx.shadowColor = 'rgba(42,31,22,0.16)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = ringW;
    ctx.beginPath();
    ctx.arc(ex, ey, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    this.drawStar(ex, ey + s * 0.01, s * 0.2, s * 0.09);
    ctx.fill();
    ctx.restore();
  }

  // ── 提示路径渲染 ─────────────────────────────────────────────────────────
  private renderHintPath(path: [number, number][], color: string) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    const hintPath = path.map(([row, col]) => ({ row, col }));
    this.drawBoardBase();
    this.drawBoardContents(() => {
      this.drawGrid(this.createPathSet(hintPath));
      this.drawPathCells(hintPath, color);
      this.drawDots();
    });
    ctx.restore();
  }

  // ── 输入处理 ─────────────────────────────────────────────────────────────
  private setupInput() {
    let isDragging = false;
    let lastCell: { row: number; col: number } | null = null;

    const getPoint = (clientX: number, clientY: number) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    const getCell = (clientX: number, clientY: number) => {
      const { x, y } = getPoint(clientX, clientY);
      return this.pixelToCell(x, y);
    };

    const onStart = (clientX: number, clientY: number) => {
      if (!this.state || this.state.isComplete) return;
      this.clearHintTimers();
      const cell = getCell(clientX, clientY);
      if (!cell) return;
      if (this.state.startDrag(cell.row, cell.col)) {
        isDragging = true;
        lastCell = cell;
        this.render();
        this.emitProgress();
      }
    };

    const onMove = (clientX: number, clientY: number) => {
      if (!isDragging) return;
      const cell = getCell(clientX, clientY);
      if (!cell) {
        this.render();
        return;
      }
      if (lastCell && cell.row === lastCell.row && cell.col === lastCell.col) {
        this.render();
        return;
      }
      const previousCell = lastCell ? { ...lastCell } : null;
      const result = this.state.moveTo(cell.row, cell.col);
      if (result !== 'invalid') {
        if (result === 'extend' && previousCell) {
          this.playMergePulse(cell, previousCell);
        } else if (result === 'backtrack') {
          this.clearMergePulse();
        }
        lastCell = cell;
        this.render();
        this.emitProgress();
        if (this.state.isComplete) {
          isDragging = false;
          this.handleComplete();
        }
      } else {
        this.render();
      }
    };

    const onEnd = () => {
      isDragging = false;
      if (this.state) this.state.endDrag();
      if (this.state && !this.state.isComplete) this.render();
    };

    // Touch
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      onStart(t.clientX, t.clientY);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      onMove(t.clientX, t.clientY);
    }, { passive: false });

    this.canvas.addEventListener('touchend', e => {
      e.preventDefault();
      onEnd();
    }, { passive: false });

    // Mouse (桌面调试)
    this.canvas.addEventListener('mousedown', e => onStart(e.clientX, e.clientY));
    this.canvas.addEventListener('mousemove', e => { if (e.buttons === 1) onMove(e.clientX, e.clientY); });
    this.canvas.addEventListener('mouseup', onEnd);
  }

  // ── 坐标转换 ─────────────────────────────────────────────────────────────
  private cellToPixel(row: number, col: number) {
    const { rowOffset, colOffset } = this.getDisplayOffset();
    return this.displayCellToPixel(row + rowOffset, col + colOffset);
  }

  private displayCellToPixel(row: number, col: number) {
    return {
      px: this.gridOffsetX + col * (this.cellSize + CELL_GAP),
      py: this.gridOffsetY + row * (this.cellSize + CELL_GAP),
    };
  }

  private pixelToCell(x: number, y: number) {
    const col = Math.floor((x - this.gridOffsetX + CELL_GAP / 2) / (this.cellSize + CELL_GAP));
    const row = Math.floor((y - this.gridOffsetY + CELL_GAP / 2) / (this.cellSize + CELL_GAP));
    const { rowOffset, colOffset } = this.getDisplayOffset();
    const levelRow = row - rowOffset;
    const levelCol = col - colOffset;
    if (this.state.isValidCell(levelRow, levelCol)) return { row: levelRow, col: levelCol };
    return null;
  }

  // ── 工具方法 ─────────────────────────────────────────────────────────────
  private drawCellTile(x: number, y: number, size: number, radius: number) {
    const ctx = this.ctx;
    this.roundRect(x, y, size, size, radius);
    ctx.fillStyle = '#F7F1EA';
    ctx.fill();
  }

  private drawInactiveCellTile(x: number, y: number, size: number, radius: number) {
    const ctx = this.ctx;
    this.roundRect(x, y, size, size, radius);
    ctx.fillStyle = '#D0C5B7';
    ctx.fill();
  }

  private drawStar(cx: number, cy: number, outerRadius: number, innerRadius: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  private drawPathConnector(a: Cell, b: Cell, radius: number) {
    const ctx = this.ctx;
    const s = this.cellSize;
    const ap = this.cellToPixel(a.row, a.col);
    const bp = this.cellToPixel(b.row, b.col);

    if (a.row === b.row) {
      const left = Math.min(ap.px, bp.px);
      ctx.fillRect(left + s - radius, ap.py, CELL_GAP + radius * 2, s);
    } else if (a.col === b.col) {
      const top = Math.min(ap.py, bp.py);
      ctx.fillRect(ap.px, top + s - radius, s, CELL_GAP + radius * 2);
    }
  }

  private drawPathCell(cell: Cell, radius: number, scaleX = 1, scaleY = scaleX) {
    const ctx = this.ctx;
    const s = this.cellSize;
    const { px, py } = this.cellToPixel(cell.row, cell.col);
    const cx = px + s / 2;
    const cy = py + s / 2;

    ctx.save();
    if (scaleX !== 1 || scaleY !== 1) {
      ctx.translate(cx, cy);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-cx, -cy);
    }
    this.roundRect(px, py, s, s, radius);
    ctx.fill();
    ctx.restore();
  }

  private createPathSet(path: Cell[]) {
    return new Set(path.map(cell => this.cellKey(cell.row, cell.col)));
  }

  private cellKey(row: number, col: number) {
    return `${row},${col}`;
  }

  private getEmptyCellRadius() {
    return Math.min(this.cellSize * EMPTY_CELL_RADIUS_RATIO, 18);
  }

  private getPathCellRadius() {
    return Math.min(this.cellSize * PATH_CELL_RADIUS_RATIO, 30);
  }

  private getBoardRadius() {
    return Math.min(this.cellSize * BOARD_RADIUS_RATIO, this.boardPadding + 14, 36);
  }

  private getDisplayRows() {
    return Math.max(DISPLAY_GRID_SIZE, this.level.rows);
  }

  private getDisplayCols() {
    return Math.max(DISPLAY_GRID_SIZE, this.level.cols);
  }

  private getDisplayOffset() {
    return {
      rowOffset: Math.floor((this.getDisplayRows() - this.level.rows) / 2),
      colOffset: Math.floor((this.getDisplayCols() - this.level.cols) / 2),
    };
  }

  private drawBoardContents(draw: () => void) {
    const ctx = this.ctx;
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;

    ctx.save();
    this.roundRect(0, 0, width, height, this.getBoardRadius());
    ctx.clip();
    draw();
    ctx.restore();
  }

  private getMergeCellTransform(cell: Cell, now: number) {
    if (!this.mergePulse || !this.isSameCell(cell, this.mergePulse.cell)) {
      return { scaleX: 1, scaleY: 1 };
    }

    const t = this.clamp((now - this.mergePulse.startedAt) / this.mergePulse.duration, 0, 1);
    const grow = 0.88 + this.easeOutCubic(t) * 0.12;
    const jelly = Math.sin(t * Math.PI) * 0.12;
    const base = grow + jelly;
    const directionStretch = (1 - t) * 0.1 + Math.sin(t * Math.PI) * 0.04;
    const dx = cell.col - this.mergePulse.from.col;
    const dy = cell.row - this.mergePulse.from.row;

    if (dx !== 0) {
      return {
        scaleX: base + directionStretch,
        scaleY: base - directionStretch * 0.36,
      };
    }

    if (dy !== 0) {
      return {
        scaleX: base - directionStretch * 0.36,
        scaleY: base + directionStretch,
      };
    }

    return { scaleX: base, scaleY: base };
  }

  private playMergePulse(cell: Cell, from: Cell) {
    this.mergePulse = {
      cell,
      from,
      startedAt: performance.now(),
      duration: MERGE_PULSE_DURATION,
    };
    this.startMergeAnimationLoop();
  }

  private startMergeAnimationLoop() {
    if (this.mergeAnimationFrame !== null) return;

    const tick = () => {
      this.mergeAnimationFrame = null;
      if (!this.mergePulse) return;

      const elapsed = performance.now() - this.mergePulse.startedAt;
      this.render();

      if (elapsed < this.mergePulse.duration) {
        this.startMergeAnimationLoop();
      } else {
        this.mergePulse = null;
        this.render();
      }
    };

    this.mergeAnimationFrame = requestAnimationFrame(tick);
  }

  private clearMergePulse() {
    this.mergePulse = null;
    if (this.mergeAnimationFrame !== null) {
      cancelAnimationFrame(this.mergeAnimationFrame);
      this.mergeAnimationFrame = null;
    }
  }

  private isSameCell(a: Cell, b: Cell) {
    return a.row === b.row && a.col === b.col;
  }

  private easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      // 兼容旧版
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }

  // ── 进场动画 ─────────────────────────────────────────────────────────────
  private playEnterAnimation() {
    const { rows, cols, grid } = this.level;
    const cells: { row: number; col: number }[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (grid[r][c] === 1) cells.push({ row: r, col: c });

    const stepDelay = 28; // ms between each cell appearing

    const scheduleCell = (idx: number) => {
      setTimeout(() => {
        // 每个格子用一个小动画：scale 0→1
        const startTime = performance.now();
        const animDuration = 200;
        const animate = (now: number) => {
          const t = Math.min((now - startTime) / animDuration, 1);
          // Back ease out
          const eased = 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
          const scale = Math.max(0, Math.min(eased, 1));

          this.renderWithCellScale(idx, scale, cells);
          if (t < 1) requestAnimationFrame(animate);
          else this.render(); // 最终渲染
        };
        requestAnimationFrame(animate);
      }, idx * stepDelay);
    };

    // 逐个触发
    cells.forEach((_, i) => scheduleCell(i));
  }

  private renderWithCellScale(untilIdx: number, scale: number, cells: { row: number; col: number }[]) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    this.drawBoardBase();

    const s = this.cellSize;
    const r = this.getEmptyCellRadius();

    this.drawBoardContents(() => {
      this.drawGrid(this.createPathSet(cells));

      cells.forEach((cell, i) => {
        const { px, py } = this.cellToPixel(cell.row, cell.col);
        const cx = px + s / 2, cy = py + s / 2;
        const sc = i < untilIdx ? 1 : (i === untilIdx ? scale : 0);
        if (sc <= 0) return;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(sc, sc);
        ctx.translate(-cx, -cy);

        this.drawCellTile(px, py, s, r);

        ctx.restore();
      });

      this.drawDots();
    });
    ctx.restore();
  }

  // ── 过关处理 ─────────────────────────────────────────────────────────────
  private handleComplete() {
    if (this.trackProgress) {
      completeLevel(this.level.id);
    }
    this.render();
    this.onLevelCompleteCallback?.(this.levelIndex);
  }

  setOnComplete(cb: (levelIndex: number) => void) {
    this.onLevelCompleteCallback = cb;
  }

  setOnProgress(cb: (progress: number) => void) {
    this.onProgressCallback = cb;
    this.emitProgress();
  }

  // ── 公共操作 ─────────────────────────────────────────────────────────────
  resetLevel() {
    this.clearHintTimers();
    this.clearMergePulse();
    this.state.reset();
    this.render();
    this.emitProgress();
  }

  showHint() {
    if (!this.hintSolution) return;
    this.clearHintTimers();
    this.clearMergePulse();
    this.state.applyHint(this.hintSolution);
    this.emitProgress();
    const solution = this.hintSolution;
    const hintColor = this.pathColor;

    for (let i = 0; i <= solution.length; i++) {
      const t = setTimeout(() => {
        if (i === solution.length) {
          if (this.state.isComplete) {
            setTimeout(() => this.handleComplete(), 400);
          }
          return;
        }
        this.renderHintPath(solution.slice(0, i + 1), hintColor);
      }, i * 150);
      this.hintTimers.push(t);
    }
  }

  nextLevel(): number {
    return this.levelIndex + 1;
  }

  getLevelIndex() { return this.levelIndex; }
  getTotalLevels() { return LEVELS.length; }

  private clearHintTimers() {
    this.hintTimers.forEach(t => clearTimeout(t));
    this.hintTimers = [];
  }

  private emitProgress() {
    if (!this.state) return;
    const total = this.state.getTotalCells();
    const progress = total > 0 ? this.state.pathCells.length / total : 0;
    this.onProgressCallback?.(this.clamp(progress, 0, 1));
  }
}

// ── 粒子爆炸 ─────────────────────────────────────────────────────────────
export function spawnParticles(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;

  const colors = ['#FF7043', '#FFD54F', '#4FC3F7', '#AB47BC', '#66BB6A', '#FF5252', '#FFCA28'];
  interface Particle {
    x: number; y: number;
    vx: number; vy: number;
    size: number; color: string;
    alpha: number; type: number;
    life: number;
  }
  const particles: Particle[] = [];

  const cx = canvas.width / 2;
  const cy = canvas.height * 0.45;

  for (let i = 0; i < 32; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (180 + Math.random() * 260) * dpr;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 100 * dpr,
      size: (7 + Math.random() * 10) * dpr,
      color: colors[i % colors.length],
      alpha: 1,
      type: i % 3,
      life: 1,
    });
  }

  let lastTime = performance.now();
  const animate = (now: number) => {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dpr * dt; // gravity
      p.life -= dt * 1.2;
      p.alpha = Math.max(0, p.life);

      if (p.alpha <= 0) continue;
      alive = true;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * 8);
      ctx.beginPath();
      if (p.type === 0) {
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      } else if (p.type === 1) {
        ctx.rect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.moveTo(0, -p.size / 2);
        ctx.lineTo(p.size / 2, p.size / 2);
        ctx.lineTo(-p.size / 2, p.size / 2);
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
    }

    if (alive) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  requestAnimationFrame(animate);
}
