import { LEVELS } from '../data/levels';
import type { LevelData } from '../data/levels';
import { GameState } from './GameState';
import { solvePuzzle } from './solver';
import { completeLevel, getLevelRewardKind, hasSeenTutorial, markTutorialSeen } from './storage';
import type { CompleteLevelResult, LevelRewardKind } from './storage';

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
type PathDrawOptions = { alpha?: number; useMergePulse?: boolean };

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
  private tutorialAnimationFrame: number | null = null;
  private tutorialDelayTimer: ReturnType<typeof setTimeout> | null = null;
  private tutorialActive = false;
  private tutorialStartedAt = 0;
  private tutorialPath: Cell[] = [];

  private cellSize = 60;
  private boardPadding = 12;
  private gridOffsetX = 0;
  private gridOffsetY = 0;

  private trackProgress = true;
  private onLevelCompleteCallback?: (levelIndex: number, result: CompleteLevelResult | null) => void;
  private onProgressCallback?: (progress: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = window.devicePixelRatio || 1;
    this.setupInput();
  }

  // ── 加载关卡 ────────────────────────────────────────────────────────────
  load(levelIndex: number, options: { animate?: boolean; trackProgress?: boolean } = {}) {
    this.clearTutorialGuide(false, false);
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
    if (this.shouldShowTutorial()) {
      this.scheduleTutorialGuide(options.animate === false ? 180 : 950);
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

  private drawPathCells(path: Cell[], color: string, options: PathDrawOptions = {}) {
    if (path.length === 0) return;
    const ctx = this.ctx;
    const r = this.getPathCellRadius();
    const now = performance.now();
    const useMergePulse = options.useMergePulse ?? true;

    if ((options.alpha ?? 1) < 1 && !useMergePulse) {
      this.drawPathCellsAsSingleOverlay(path, color, options.alpha ?? 1);
      return;
    }

    ctx.save();
    ctx.globalAlpha = options.alpha ?? 1;
    ctx.fillStyle = color;

    for (let i = 0; i < path.length - 1; i++) {
      this.drawPathConnector(path[i], path[i + 1], r);
    }

    path.forEach(cell => {
      const transform = useMergePulse
        ? this.getMergeCellTransform(cell, now)
        : { scaleX: 1, scaleY: 1 };
      this.drawPathCell(cell, r, transform.scaleX, transform.scaleY);
    });
    ctx.restore();
  }

  private drawPathCellsAsSingleOverlay(path: Cell[], color: string, alpha: number) {
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    const overlay = document.createElement('canvas');
    overlay.width = Math.round(width * this.dpr);
    overlay.height = Math.round(height * this.dpr);

    const overlayCtx = overlay.getContext('2d')!;
    overlayCtx.scale(this.dpr, this.dpr);
    overlayCtx.fillStyle = color;
    this.drawPathCellsToContext(overlayCtx, path, this.getPathCellRadius());

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(overlay, 0, 0, width, height);
    this.ctx.restore();
  }

  private drawPathCellsToContext(ctx: CanvasRenderingContext2D, path: Cell[], radius: number) {
    for (let i = 0; i < path.length - 1; i++) {
      this.drawPathConnectorToContext(ctx, path[i], path[i + 1], radius);
    }

    path.forEach(cell => {
      this.drawPathCellToContext(ctx, cell, radius);
    });
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
    this.drawRewardIcon(ex, ey, s, getLevelRewardKind(this.level.id));
    ctx.restore();
  }

  // ── 提示路径渲染 ─────────────────────────────────────────────────────────
  private renderHintPath(path: [number, number][], color: string, alpha = 0.78) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    const hintPath = path.map(([row, col]) => ({ row, col }));
    this.drawBoardBase();
    this.drawBoardContents(() => {
      this.drawGrid(this.createPathSet(this.state.pathCells));
      this.drawPath();
      this.drawPathCells(hintPath, color, { alpha, useMergePulse: false });
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
      if (this.tutorialActive || this.tutorialDelayTimer) {
        this.clearTutorialGuide(true, false);
      }
      this.clearHintTimers();
      this.render();
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

  private drawRewardIcon(cx: number, cy: number, size: number, kind: LevelRewardKind) {
    const ctx = this.ctx;
    const scale = size / 60;

    if (kind === 'coin') {
      ctx.beginPath();
      ctx.ellipse(cx, cy, 9 * scale, 12 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.strokeStyle = this.pathColor;
      ctx.lineWidth = Math.max(2, 4 * scale);
      ctx.beginPath();
      ctx.moveTo(cx, cy - 7 * scale);
      ctx.lineTo(cx, cy + 7 * scale);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (kind === 'gift') {
      const w = 24 * scale;
      const h = 18 * scale;
      this.roundRect(cx - w / 2, cy - h / 2 + 2 * scale, w, h, 5 * scale);
      ctx.fill();
      ctx.fillRect(cx - 2 * scale, cy - h / 2 + 2 * scale, 4 * scale, h);
      ctx.fillRect(cx - w / 2, cy - 2 * scale, w, 4 * scale);
      ctx.beginPath();
      ctx.arc(cx - 5 * scale, cy - 11 * scale, 5 * scale, 0, Math.PI * 2);
      ctx.arc(cx + 5 * scale, cy - 11 * scale, 5 * scale, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const bowlW = 25 * scale;
    const bowlH = 14 * scale;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3 * scale, bowlW / 2, bowlH / 2, 0, 0, Math.PI);
    ctx.lineTo(cx - bowlW / 2, cy + 3 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy - 4 * scale, 7 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  private drawPathConnector(a: Cell, b: Cell, radius: number) {
    this.drawPathConnectorToContext(this.ctx, a, b, radius);
  }

  private drawPathConnectorToContext(ctx: CanvasRenderingContext2D, a: Cell, b: Cell, radius: number) {
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
    this.drawPathCellToContext(this.ctx, cell, radius, scaleX, scaleY);
  }

  private drawPathCellToContext(
    ctx: CanvasRenderingContext2D,
    cell: Cell,
    radius: number,
    scaleX = 1,
    scaleY = scaleX,
  ) {
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
    this.roundRectForContext(ctx, px, py, s, s, radius);
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
    this.roundRectForContext(this.ctx, x, y, w, h, r);
  }

  private roundRectForContext(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
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
    let result: CompleteLevelResult | null = null;
    if (this.trackProgress) {
      result = completeLevel(this.level.id);
    }
    this.render();
    this.onLevelCompleteCallback?.(this.levelIndex, result);
  }

  setOnComplete(cb: (levelIndex: number, result: CompleteLevelResult | null) => void) {
    this.onLevelCompleteCallback = cb;
  }

  setOnProgress(cb: (progress: number) => void) {
    this.onProgressCallback = cb;
    this.emitProgress();
  }

  canUseHint() {
    return Boolean(this.hintSolution && this.state && !this.state.isComplete);
  }

  dismissTutorial(markSeen = false) {
    this.clearTutorialGuide(markSeen);
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
    if (this.tutorialActive || this.tutorialDelayTimer) {
      this.clearTutorialGuide(true, false);
    }
    if (!this.hintSolution || !this.state || this.state.isComplete) return;
    this.clearHintTimers();
    this.clearMergePulse();
    const solution = this.hintSolution;
    const hintColor = this.pathColor;
    const revealInterval = 28;
    const flashInterval = 130;

    for (let i = 0; i < solution.length; i++) {
      const t = setTimeout(() => {
        this.renderHintPath(solution.slice(0, i + 1), hintColor, 0.78);
      }, i * revealInterval);
      this.hintTimers.push(t);
    }

    const flashAlphas = [0.92, 0.24, 0.82, 0.22, 0.62, 0.38, 0.18];
    const flashStart = solution.length * revealInterval + 150;
    flashAlphas.forEach((alpha, index) => {
      const t = setTimeout(() => {
        this.renderHintPath(solution, hintColor, alpha);
      }, flashStart + index * flashInterval);
      this.hintTimers.push(t);
    });

    const finish = setTimeout(() => {
      this.render();
      this.hintTimers = [];
    }, flashStart + flashAlphas.length * flashInterval + 80);
    this.hintTimers.push(finish);
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

  private shouldShowTutorial() {
    return this.levelIndex === 0 && !hasSeenTutorial();
  }

  private scheduleTutorialGuide(delay: number) {
    if (this.tutorialDelayTimer) clearTimeout(this.tutorialDelayTimer);
    this.tutorialDelayTimer = setTimeout(() => {
      this.tutorialDelayTimer = null;
      this.startTutorialGuide();
    }, delay);
  }

  private startTutorialGuide() {
    if (!this.shouldShowTutorial() || !this.hintSolution || !this.state || this.state.pathCells.length > 0) {
      return;
    }

    const previewLength = Math.min(4, this.hintSolution.length);
    if (previewLength < 2) return;

    this.tutorialPath = this.hintSolution
      .slice(0, previewLength)
      .map(([row, col]) => ({ row, col }));
    this.tutorialStartedAt = performance.now();
    this.tutorialActive = true;
    this.startTutorialAnimationLoop();
  }

  private startTutorialAnimationLoop() {
    if (this.tutorialAnimationFrame !== null) return;

    const tick = (now: number) => {
      this.tutorialAnimationFrame = null;
      if (!this.tutorialActive) return;

      this.render();
      this.drawTutorialGuide(now);
      this.tutorialAnimationFrame = requestAnimationFrame(tick);
    };

    this.tutorialAnimationFrame = requestAnimationFrame(tick);
  }

  private clearTutorialGuide(markSeen = false, rerender = true) {
    if (markSeen) markTutorialSeen();

    const hadVisibleGuide = this.tutorialActive;
    this.tutorialActive = false;
    this.tutorialStartedAt = 0;
    this.tutorialPath = [];

    if (this.tutorialDelayTimer) {
      clearTimeout(this.tutorialDelayTimer);
      this.tutorialDelayTimer = null;
    }

    if (this.tutorialAnimationFrame !== null) {
      cancelAnimationFrame(this.tutorialAnimationFrame);
      this.tutorialAnimationFrame = null;
    }

    if (rerender && hadVisibleGuide && this.level && this.state) {
      this.render();
    }
  }

  private drawTutorialGuide(now: number) {
    if (this.tutorialPath.length < 2) return;

    const ctx = this.ctx;
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    const elapsed = now - this.tutorialStartedAt;
    const cycleDuration = 3400;
    const cycleProgress = (elapsed % cycleDuration) / cycleDuration;
    const travelProgress = this.clamp(cycleProgress / 0.68, 0, 1);
    const fade =
      cycleProgress < 0.74
        ? 1
        : this.clamp(1 - (cycleProgress - 0.74) / 0.2, 0, 1);
    const easedTravel = this.easeInOutCubic(travelProgress);
    const visibleCells = Math.max(
      1,
      Math.min(
        this.tutorialPath.length,
        Math.ceil(easedTravel * (this.tutorialPath.length - 1)) + 1,
      ),
    );
    const startCenter = this.getCellCenter(this.tutorialPath[0]);
    const touchPoint = this.getTutorialPoint(easedTravel);

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    this.drawBoardContents(() => {
      ctx.fillStyle = `rgba(29, 29, 29, ${0.11 * fade})`;
      ctx.fillRect(0, 0, width, height);
      this.drawPathCells(this.tutorialPath.slice(0, visibleCells), this.pathColor, {
        alpha: 0.44 * fade,
        useMergePulse: false,
      });
    });

    this.drawTutorialLabel(width, height, startCenter, fade);
    this.drawTutorialStartPulse(startCenter, elapsed, fade);
    this.drawTutorialTouchPoint(touchPoint, fade);

    ctx.restore();
  }

  private drawTutorialLabel(width: number, height: number, startCenter: { x: number; y: number }, alpha: number) {
    const ctx = this.ctx;
    const text = '按住圆点，拖满格子';
    const fontSize = Math.max(13, Math.min(16, Math.round(this.cellSize * 0.22)));
    ctx.save();
    ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
    const textWidth = ctx.measureText(text).width;
    const labelW = textWidth + 28;
    const labelH = fontSize + 18;
    const labelX = (width - labelW) / 2;
    const labelY = this.clamp(startCenter.y - this.cellSize * 1.2, 12, height - labelH - 12);

    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    this.roundRectForContext(ctx, labelX, labelY, labelW, labelH, labelH / 2);
    ctx.fillStyle = '#1D1D1D';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, labelY + labelH / 2 + 1);
    ctx.restore();
  }

  private drawTutorialStartPulse(center: { x: number; y: number }, elapsed: number, alpha: number) {
    const ctx = this.ctx;
    const pulse = (Math.sin((elapsed / 760) * Math.PI * 2) + 1) / 2;
    const radius = this.cellSize * (0.34 + pulse * 0.12);
    const lineWidth = Math.max(4, this.cellSize * 0.07);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.55)';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = this.pathColor;
    ctx.globalAlpha = alpha * (0.3 + pulse * 0.35);
    ctx.lineWidth = Math.max(2, lineWidth * 0.38);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius + this.cellSize * 0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawTutorialTouchPoint(point: { x: number; y: number }, alpha: number) {
    const ctx = this.ctx;
    const radius = this.cellSize * 0.13;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(255, 232, 91, 0.5)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = this.pathColor;
    ctx.lineWidth = Math.max(2, this.cellSize * 0.045);
    ctx.stroke();
    ctx.restore();
  }

  private getCellCenter(cell: Cell) {
    const { px, py } = this.cellToPixel(cell.row, cell.col);
    return {
      x: px + this.cellSize / 2,
      y: py + this.cellSize / 2,
    };
  }

  private getTutorialPoint(progress: number) {
    if (this.tutorialPath.length === 1) return this.getCellCenter(this.tutorialPath[0]);

    const segmentCount = this.tutorialPath.length - 1;
    const rawIndex = this.clamp(progress, 0, 1) * segmentCount;
    const index = Math.min(segmentCount - 1, Math.floor(rawIndex));
    const segmentProgress = rawIndex - index;
    const from = this.getCellCenter(this.tutorialPath[index]);
    const to = this.getCellCenter(this.tutorialPath[index + 1]);

    return {
      x: from.x + (to.x - from.x) * segmentProgress,
      y: from.y + (to.y - from.y) * segmentProgress,
    };
  }

  private easeInOutCubic(t: number) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
  const parentRect = canvas.parentElement?.getBoundingClientRect();
  const width = parentRect?.width || window.innerWidth;
  const height = parentRect?.height || window.innerHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = ['#FF7043', '#FFD54F', '#4FC3F7', '#AB47BC', '#66BB6A', '#FF5252', '#FFCA28'];
  interface Particle {
    x: number; y: number;
    vx: number; vy: number;
    size: number; color: string;
    alpha: number; type: number;
    life: number;
  }
  const particles: Particle[] = [];

  const cx = width / 2;
  const cy = height * 0.38;

  for (let i = 0; i < 32; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 180 + Math.random() * 260;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 100,
      size: 7 + Math.random() * 10,
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

    ctx.clearRect(0, 0, width, height);
    let alive = false;

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt; // gravity
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
    else ctx.clearRect(0, 0, width, height);
  };
  requestAnimationFrame(animate);
}
