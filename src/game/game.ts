import { LEVELS } from '../data/levels';
import type { LevelData } from '../data/levels';
import { GameState } from './GameState';
import { solvePuzzle } from './solver';
import { completeLevel } from './storage';

// 每关的主题色
const LEVEL_COLORS = [
  '#4FC3F7', '#FF7043', '#AB47BC', '#66BB6A',
  '#FFCA28', '#FF5252', '#26C6DA', '#EC407A',
  '#5C6BC0', '#26A69A',
];

// 设计常量
const CELL_GAP = 6;
const CELL_RADIUS_RATIO = 0.18;
const PATH_WIDTH_RATIO = 0.38;

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

  private cellSize = 60;
  private gridOffsetX = 0;
  private gridOffsetY = 0;

  private onLevelCompleteCallback?: (levelIndex: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = window.devicePixelRatio || 1;
    this.setupInput();
  }

  // ── 加载关卡 ────────────────────────────────────────────────────────────
  load(levelIndex: number) {
    this.levelIndex = levelIndex;
    this.level = LEVELS[levelIndex];
    this.state = new GameState(this.level);
    this.pathColor = LEVEL_COLORS[levelIndex % LEVEL_COLORS.length];
    this.hintSolution = solvePuzzle(this.level);
    this.clearHintTimers();

    this.resize();
    this.render();
    this.playEnterAnimation();
  }

  // ── 更新尺寸 ─────────────────────────────────────────────────────────────
  resize() {
    if (!this.level) return;
    const wrap = this.canvas.parentElement!;
    const wrapW = wrap.clientWidth;
    const wrapH = wrap.clientHeight;

    // 计算格子尺寸
    const { rows, cols } = this.level;
    const maxGridW = Math.min(wrapW - 40, 380);
    const maxGridH = Math.min(wrapH - 16, 440);
    const sizeByW = Math.floor((maxGridW - CELL_GAP * (cols - 1)) / cols);
    const sizeByH = Math.floor((maxGridH - CELL_GAP * (rows - 1)) / rows);
    this.cellSize = Math.min(sizeByW, sizeByH, 88);

    const gridW = cols * this.cellSize + (cols - 1) * CELL_GAP;
    const gridH = rows * this.cellSize + (rows - 1) * CELL_GAP;

    // 设置 canvas 物理/CSS 尺寸
    const cw = gridW;
    const ch = gridH;
    this.canvas.style.width = `${cw}px`;
    this.canvas.style.height = `${ch}px`;
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);

    this.gridOffsetX = 0;
    this.gridOffsetY = 0;
  }

  // ── 主渲染 ──────────────────────────────────────────────────────────────
  render() {
    if (!this.level) return;
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    this.drawGrid();
    this.drawPath();
    this.drawDots();
    ctx.restore();
  }

  // ── 格子底层 ─────────────────────────────────────────────────────────────
  private drawGrid() {
    const { rows, cols, grid } = this.level;
    const s = this.cellSize;
    const r = Math.min(s * CELL_RADIUS_RATIO, 14);
    const path = this.state.pathCells;
    const pathSet = new Set(path.map(p => `${p.row},${p.col}`));
    const color = this.pathColor;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (grid[row][col] !== 1) continue;
        const { px, py } = this.cellToPixel(row, col);
        const filled = pathSet.has(`${row},${col}`);

        if (filled) {
          // 填充色格子
          this.roundRect(px, py, s, s, r);
          this.ctx.fillStyle = color;
          this.ctx.fill();
          // 高光
          this.roundRect(px + 4, py + 4, s - 8, (s - 8) * 0.38, r * 0.6);
          this.ctx.fillStyle = 'rgba(255,255,255,0.22)';
          this.ctx.fill();
        } else {
          // 阴影
          this.roundRect(px + 3, py + 5, s, s, r);
          this.ctx.fillStyle = 'rgba(0,0,0,0.07)';
          this.ctx.fill();
          // 底色
          this.roundRect(px, py, s, s, r);
          this.ctx.fillStyle = '#E8F5E9';
          this.ctx.fill();
          // 高光
          this.roundRect(px + 4, py + 4, s - 8, (s - 8) * 0.32, r * 0.6);
          this.ctx.fillStyle = 'rgba(255,255,255,0.65)';
          this.ctx.fill();
          // 边框
          this.roundRect(px, py, s, s, r);
          this.ctx.strokeStyle = 'rgba(200,230,201,0.85)';
          this.ctx.lineWidth = 1.5;
          this.ctx.stroke();
        }
      }
    }
  }

  // ── 路径连接线 ───────────────────────────────────────────────────────────
  private drawPath() {
    const path = this.state.pathCells;
    if (path.length === 0) return;

    const ctx = this.ctx;
    const s = this.cellSize;
    const half = s / 2;
    const pw = s * PATH_WIDTH_RATIO;
    const hw = pw / 2;
    const color = this.pathColor;

    ctx.fillStyle = color;

    // 中心圆
    for (const cell of path) {
      const { px, py } = this.cellToPixel(cell.row, cell.col);
      ctx.beginPath();
      ctx.arc(px + half, py + half, hw, 0, Math.PI * 2);
      ctx.fill();
    }

    // 连接矩形
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const ap = this.cellToPixel(a.row, a.col);
      const bp = this.cellToPixel(b.row, b.col);
      const ax = ap.px + half, ay = ap.py + half;
      const bx = bp.px + half, by = bp.py + half;
      if (a.row === b.row) {
        ctx.fillRect(Math.min(ax, bx), ay - hw, Math.abs(bx - ax), pw);
      } else {
        ctx.fillRect(ax - hw, Math.min(ay, by), pw, Math.abs(by - ay));
      }
    }

    // 起点白心
    const fp = this.cellToPixel(path[0].row, path[0].col);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(fp.px + half, fp.py + half, hw * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 末端白点
    if (path.length > 1) {
      const last = path[path.length - 1];
      const lp = this.cellToPixel(last.row, last.col);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lp.px + half, lp.py + half, hw, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(lp.px + half, lp.py + half, hw * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── 起终点标记 ───────────────────────────────────────────────────────────
  private drawDots() {
    const ctx = this.ctx;
    const [sr, sc] = this.level.start;
    const [er, ec] = this.level.end;
    const s = this.cellSize;
    const half = s / 2;
    const dotR = s * 0.24;

    // 起点（珊瑚色 + 白心）
    const sp = this.cellToPixel(sr, sc);
    ctx.fillStyle = '#FF7043';
    ctx.beginPath();
    ctx.arc(sp.px + half, sp.py + half, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(sp.px + half, sp.py + half, dotR * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // 终点（暖黄色 + ★）
    const ep = this.cellToPixel(er, ec);
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(ep.px + half, ep.py + half, dotR, 0, Math.PI * 2);
    ctx.fill();
    // 终点星
    ctx.font = `bold ${Math.round(dotR * 1.5)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('★', ep.px + half, ep.py + half + 1);
  }

  // ── 提示路径渲染 ─────────────────────────────────────────────────────────
  private renderHintPath(path: [number, number][], color: string) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const { rows, cols, grid } = this.level;
    const s = this.cellSize;
    const r = Math.min(s * CELL_RADIUS_RATIO, 14);
    const half = s / 2;
    const pw = s * PATH_WIDTH_RATIO;
    const hw = pw / 2;
    const pathSet = new Set(path.map(([pr, pc]) => `${pr},${pc}`));

    // 格子
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (grid[row][col] !== 1) continue;
        const { px, py } = this.cellToPixel(row, col);
        const filled = pathSet.has(`${row},${col}`);
        if (filled) {
          this.roundRect(px, py, s, s, r);
          ctx.fillStyle = color;
          ctx.fill();
          this.roundRect(px + 4, py + 4, s - 8, (s - 8) * 0.38, r * 0.6);
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.fill();
        } else {
          this.roundRect(px + 3, py + 5, s, s, r);
          ctx.fillStyle = 'rgba(0,0,0,0.07)';
          ctx.fill();
          this.roundRect(px, py, s, s, r);
          ctx.fillStyle = '#E8F5E9';
          ctx.fill();
          this.roundRect(px + 4, py + 4, s - 8, (s - 8) * 0.32, r * 0.6);
          ctx.fillStyle = 'rgba(255,255,255,0.65)';
          ctx.fill();
          this.roundRect(px, py, s, s, r);
          ctx.strokeStyle = 'rgba(200,230,201,0.85)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    // 路径
    if (path.length > 0) {
      ctx.fillStyle = color;
      for (const [row, col] of path) {
        const { px, py } = this.cellToPixel(row, col);
        ctx.beginPath();
        ctx.arc(px + half, py + half, hw, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < path.length - 1; i++) {
        const [ar, ac] = path[i], [br, bc] = path[i + 1];
        const ap = this.cellToPixel(ar, ac), bp = this.cellToPixel(br, bc);
        const ax = ap.px + half, ay = ap.py + half;
        const bx = bp.px + half, by = bp.py + half;
        if (ar === br) {
          ctx.fillRect(Math.min(ax, bx), ay - hw, Math.abs(bx - ax), pw);
        } else {
          ctx.fillRect(ax - hw, Math.min(ay, by), pw, Math.abs(by - ay));
        }
      }
      const fp = this.cellToPixel(path[0][0], path[0][1]);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(fp.px + half, fp.py + half, hw * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    this.drawDots();
    ctx.restore();
  }

  // ── 输入处理 ─────────────────────────────────────────────────────────────
  private setupInput() {
    let isDragging = false;
    let lastCell: { row: number; col: number } | null = null;

    const getCell = (clientX: number, clientY: number) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
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
      }
    };

    const onMove = (clientX: number, clientY: number) => {
      if (!isDragging) return;
      const cell = getCell(clientX, clientY);
      if (!cell) return;
      if (lastCell && cell.row === lastCell.row && cell.col === lastCell.col) return;
      lastCell = cell;
      const result = this.state.moveTo(cell.row, cell.col);
      if (result !== 'invalid') {
        this.render();
        if (this.state.isComplete) {
          isDragging = false;
          this.handleComplete();
        }
      }
    };

    const onEnd = () => {
      isDragging = false;
      if (this.state) this.state.endDrag();
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
    return {
      px: this.gridOffsetX + col * (this.cellSize + CELL_GAP),
      py: this.gridOffsetY + row * (this.cellSize + CELL_GAP),
    };
  }

  private pixelToCell(x: number, y: number) {
    const col = Math.floor((x - this.gridOffsetX + CELL_GAP / 2) / (this.cellSize + CELL_GAP));
    const row = Math.floor((y - this.gridOffsetY + CELL_GAP / 2) / (this.cellSize + CELL_GAP));
    if (this.state.isValidCell(row, col)) return { row, col };
    return null;
  }

  // ── 工具方法 ─────────────────────────────────────────────────────────────
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

    const { grid } = this.level;
    const s = this.cellSize;
    const r = Math.min(s * CELL_RADIUS_RATIO, 14);

    cells.forEach((cell, i) => {
      if (!grid[cell.row][cell.col]) return;
      const { px, py } = this.cellToPixel(cell.row, cell.col);
      const cx = px + s / 2, cy = py + s / 2;
      const sc = i < untilIdx ? 1 : (i === untilIdx ? scale : 0);
      if (sc <= 0) return;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sc, sc);
      ctx.translate(-cx, -cy);

      this.roundRect(px + 3, py + 5, s, s, r);
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fill();
      this.roundRect(px, py, s, s, r);
      ctx.fillStyle = '#E8F5E9';
      ctx.fill();
      this.roundRect(px + 4, py + 4, s - 8, (s - 8) * 0.32, r * 0.6);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fill();
      this.roundRect(px, py, s, s, r);
      ctx.strokeStyle = 'rgba(200,230,201,0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
    });

    this.drawDots();
    ctx.restore();
  }

  // ── 过关处理 ─────────────────────────────────────────────────────────────
  private handleComplete() {
    completeLevel(this.level.id);
    this.render();
    this.onLevelCompleteCallback?.(this.levelIndex);
  }

  setOnComplete(cb: (levelIndex: number) => void) {
    this.onLevelCompleteCallback = cb;
  }

  // ── 公共操作 ─────────────────────────────────────────────────────────────
  resetLevel() {
    this.clearHintTimers();
    this.state.reset();
    this.render();
  }

  showHint() {
    if (!this.hintSolution) return;
    this.clearHintTimers();
    this.state.applyHint(this.hintSolution);
    const solution = this.hintSolution;
    const hintColor = '#AB47BC';

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
