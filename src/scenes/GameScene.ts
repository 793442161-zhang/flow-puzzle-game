import Phaser from 'phaser';
import { LEVELS } from '../data/levels';
import type { LevelData } from '../data/levels';
import { GameState } from '../game/GameState';
import { solvePuzzle } from '../game/solver';
import { completeLevel, loadProgress } from '../game/storage';
import { COLORS, GRID, ANIM } from '../game/design';

const CELL_COLORS = [
  0x4FC3F7, 0xFF7043, 0xAB47BC, 0x66BB6A,
  0xFFCA28, 0xFF5252, 0x26C6DA, 0xEC407A,
];

export class GameScene extends Phaser.Scene {
  private levelIndex = 0;
  private level!: LevelData;
  private state!: GameState;

  private cellSize = 72;
  private gridOffsetX = 0;
  private gridOffsetY = 0;

  // 格子 graphics 列表（最底层）
  private cellGraphics: Phaser.GameObjects.Graphics[] = [];
  // 路径 graphics（中间层）
  private pathGraphics!: Phaser.GameObjects.Graphics;
  // 起点/终点 graphics（最上层，不被路径覆盖）
  private dotsGraphics!: Phaser.GameObjects.Graphics;

  private winOverlay!: Phaser.GameObjects.Container;
  private hintSolution: [number, number][] | null = null;
  private btnNext!: Phaser.GameObjects.Container;
  private pathColor = CELL_COLORS[0];
  private hintTweens: Phaser.Time.TimerEvent[] = [];

  // 格子坐标缓存（避免每次重绘都重新遍历）
  private cellCoords: { row: number; col: number }[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { levelIndex?: number }) {
    this.levelIndex = data?.levelIndex ?? 0;
  }

  create() {
    this.drawBackground();

    this.level = LEVELS[this.levelIndex];
    this.state = new GameState(this.level);
    this.pathColor = CELL_COLORS[this.levelIndex % CELL_COLORS.length];

    this.calcCellSize();
    this.createTopBar();

    // ⚠️ 层级顺序非常重要：
    // 1. cellGraphics（格子底色，最低层）
    // 2. pathGraphics（路径连接线，中层）
    // 3. dotsGraphics（起终点标记，最高层，永远在路径上方）
    this.drawGrid();
    this.pathGraphics = this.add.graphics();
    this.dotsGraphics = this.add.graphics();
    this.drawStartEndDots();

    this.createBottomBar();
    this.hintSolution = solvePuzzle(this.level);
    this.setupInput();
    this.playEnterAnimation();
  }

  // ─── 背景 ───────────────────────────────────────────────────────────────────
  private drawBackground() {
    const { width, height } = this.scale;
    const bg = this.add.graphics();
    bg.fillGradientStyle(0xE8F5E9, 0xE8F5E9, 0xF1F8E9, 0xF1F8E9, 1);
    bg.fillRect(0, 0, width, height);

    const bubbleColors = [0xC8E6C9, 0xB2DFDB, 0xDCEDC8, 0xF0F4C3];
    const bubbles = [
      { x: -30, y: 80, r: 90, alpha: 0.35 },
      { x: width + 20, y: 200, r: 70, alpha: 0.28 },
      { x: width * 0.3, y: -20, r: 60, alpha: 0.3 },
      { x: width * 0.8, y: height * 0.15, r: 50, alpha: 0.22 },
      { x: 40, y: height - 100, r: 80, alpha: 0.28 },
      { x: width - 50, y: height - 150, r: 65, alpha: 0.25 },
    ];
    bubbles.forEach((b, i) => {
      bg.fillStyle(bubbleColors[i % bubbleColors.length], b.alpha);
      bg.fillCircle(b.x, b.y, b.r);
    });
  }

  // ─── 尺寸计算 ────────────────────────────────────────────────────────────────
  private calcCellSize() {
    const { width, height } = this.scale;
    const { rows, cols } = this.level;
    const availW = Math.min(width - 60, GRID.MAX_GRID_WIDTH);
    const availH = Math.min(height * 0.55, GRID.MAX_GRID_HEIGHT);

    const sizeByW = Math.floor((availW - GRID.CELL_GAP * (cols - 1)) / cols);
    const sizeByH = Math.floor((availH - GRID.CELL_GAP * (rows - 1)) / rows);
    this.cellSize = Math.min(sizeByW, sizeByH, 90);

    const gridW = cols * this.cellSize + (cols - 1) * GRID.CELL_GAP;
    const gridH = rows * this.cellSize + (rows - 1) * GRID.CELL_GAP;
    this.gridOffsetX = (width - gridW) / 2;
    this.gridOffsetY = height * 0.19 + (availH - gridH) / 2;
  }

  // ─── 顶部栏 ──────────────────────────────────────────────────────────────────
  private createTopBar() {
    const { width } = this.scale;
    const progress = loadProgress();

    const barBg = this.add.graphics();
    const bx = width / 2, by = 44, bw = 200, bh = 42;
    barBg.fillStyle(0xFFFFFF, 0.85);
    barBg.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 21);

    this.add.text(bx, by, `关卡${this.level.id} · ${this.level.title}`, {
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#2E7D32',
    }).setOrigin(0.5);

    this.add.text(20, 44, `⭐ ${progress.stars}`, {
      fontFamily: '"PingFang SC", sans-serif',
      fontSize: '20px',
      color: '#F9A825',
    }).setOrigin(0, 0.5);

    // 返回按钮 —— 用矩形热区包裹
    const backArea = this.add.rectangle(width - 36, 44, 52, 52, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    this.add.text(width - 36, 44, '🏠', { fontSize: '26px' }).setOrigin(0.5);
    backArea.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  // ─── 网格绘制 ────────────────────────────────────────────────────────────────
  private drawGrid() {
    this.cellGraphics.forEach(g => g.destroy());
    this.cellGraphics = [];
    this.cellCoords = [];

    const { rows, cols, grid } = this.level;
    const r = Math.min(GRID.CELL_RADIUS, this.cellSize * 0.18);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (grid[row][col] !== 1) continue;
        const { px, py } = this.cellToPixel(row, col);
        const g = this.add.graphics();
        this.cellGraphics.push(g);
        this.cellCoords.push({ row, col });
        this.drawCell(g, px, py, r, false);
      }
    }
  }

  private drawCell(
    g: Phaser.GameObjects.Graphics,
    px: number, py: number, r: number,
    filled: boolean, color?: number
  ) {
    const s = this.cellSize;
    g.clear();
    if (filled && color !== undefined) {
      g.fillStyle(color, 1);
      g.fillRoundedRect(px, py, s, s, r);
      g.fillStyle(0xFFFFFF, 0.2);
      g.fillRoundedRect(px + 4, py + 4, s - 8, (s - 8) * 0.38, r * 0.6);
    } else {
      g.fillStyle(0xBDBDBD, 0.15);
      g.fillRoundedRect(px + 3, py + 5, s, s, r);
      g.fillStyle(COLORS.CELL_BG, 1);
      g.fillRoundedRect(px, py, s, s, r);
      g.fillStyle(0xFFFFFF, 0.55);
      g.fillRoundedRect(px + 4, py + 4, s - 8, (s - 8) * 0.32, r * 0.6);
      g.lineStyle(2, COLORS.CELL_BORDER, 0.7);
      g.strokeRoundedRect(px, py, s, s, r);
    }
  }

  // ─── 起点/终点标记（始终在最上层）───────────────────────────────────────────
  private drawStartEndDots() {
    const g = this.dotsGraphics;
    g.clear();

    const [sr, sc] = this.level.start;
    const [er, ec] = this.level.end;
    const sPos = this.cellToPixel(sr, sc);
    const ePos = this.cellToPixel(er, ec);
    const half = this.cellSize / 2;
    const dotR = this.cellSize * 0.24;

    // 起点：珊瑚色实心圆 + 白色内圈
    g.fillStyle(COLORS.PATH_START, 1);
    g.fillCircle(sPos.px + half, sPos.py + half, dotR);
    g.fillStyle(0xFFFFFF, 0.95);
    g.fillCircle(sPos.px + half, sPos.py + half, dotR * 0.45);

    // 终点：暖黄色实心圆
    g.fillStyle(COLORS.PATH_END, 1);
    g.fillCircle(ePos.px + half, ePos.py + half, dotR);

    // 终点★ 文字（直接加到 scene，depth 设高）
    const starSize = Math.round(dotR * 1.5);
    this.add.text(ePos.px + half, ePos.py + half, '★', {
      fontSize: `${starSize}px`,
      color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(50);
  }

  // ─── 坐标转换 ────────────────────────────────────────────────────────────────
  private cellToPixel(row: number, col: number): { px: number; py: number } {
    return {
      px: this.gridOffsetX + col * (this.cellSize + GRID.CELL_GAP),
      py: this.gridOffsetY + row * (this.cellSize + GRID.CELL_GAP),
    };
  }

  private pixelToCell(x: number, y: number): { row: number; col: number } | null {
    // Phaser Scale.FIT 模式下，pointer 坐标已经是游戏逻辑坐标，无需手动除以缩放
    const col = Math.floor((x - this.gridOffsetX + GRID.CELL_GAP / 2) / (this.cellSize + GRID.CELL_GAP));
    const row = Math.floor((y - this.gridOffsetY + GRID.CELL_GAP / 2) / (this.cellSize + GRID.CELL_GAP));
    if (this.state.isValidCell(row, col)) return { row, col };
    return null;
  }

  // ─── 路径绘制 ────────────────────────────────────────────────────────────────
  private redrawPath() {
    this.pathGraphics.clear();
    const path = this.state.pathCells;

    const s = this.cellSize;
    const half = s / 2;
    const pw = s * GRID.PATH_RADIUS;
    const hw = pw / 2;
    const color = this.pathColor;
    const cr = Math.min(GRID.CELL_RADIUS, s * 0.18);
    const pathSet = new Set(path.map(p => `${p.row},${p.col}`));

    // 重绘格子（填充色 vs 未填充）— 使用缓存的坐标
    this.cellGraphics.forEach((g, idx) => {
      const { row, col } = this.cellCoords[idx];
      const { px, py } = this.cellToPixel(row, col);
      this.drawCell(g, px, py, cr, pathSet.has(`${row},${col}`), color);
    });

    if (path.length === 0) return;

    const g = this.pathGraphics;
    g.fillStyle(color, 1);

    // ① 节点圆（每个路径格子中心）
    for (const cell of path) {
      const { px, py } = this.cellToPixel(cell.row, cell.col);
      g.fillCircle(px + half, py + half, hw);
    }

    // ② 相邻格子间连接矩形
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const ap = this.cellToPixel(a.row, a.col);
      const bp = this.cellToPixel(b.row, b.col);
      const ax = ap.px + half, ay = ap.py + half;
      const bx = bp.px + half, by = bp.py + half;
      if (a.row === b.row) {
        g.fillRect(Math.min(ax, bx), ay - hw, Math.abs(bx - ax), pw);
      } else {
        g.fillRect(ax - hw, Math.min(ay, by), pw, Math.abs(by - ay));
      }
    }

    // ③ 起点白色内圈
    const fp = this.cellToPixel(path[0].row, path[0].col);
    g.fillStyle(0xFFFFFF, 0.65);
    g.fillCircle(fp.px + half, fp.py + half, hw * 0.5);
    g.fillStyle(color, 1);

    // ④ 末端圆头 + 白点
    if (path.length > 1) {
      const last = path[path.length - 1];
      const lp = this.cellToPixel(last.row, last.col);
      g.fillCircle(lp.px + half, lp.py + half, hw);
      g.fillStyle(0xFFFFFF, 0.45);
      g.fillCircle(lp.px + half, lp.py + half, hw * 0.4);
    }

    // ⑤ 确保 dotsGraphics 始终在路径上方（移到最顶层）
    this.dotsGraphics.setDepth(10);
  }

  // ─── 输入处理 ────────────────────────────────────────────────────────────────
  private setupInput() {
    let lastCell: { row: number; col: number } | null = null;
    let isDragging = false;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.state.isComplete) return;
      this.clearHint();
      const cell = this.pixelToCell(p.x, p.y);
      if (!cell) return;
      if (this.state.startDrag(cell.row, cell.col)) {
        lastCell = cell;
        isDragging = true;
        this.redrawPath();
      }
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!isDragging || !p.isDown) return;
      const cell = this.pixelToCell(p.x, p.y);
      if (!cell) return;
      if (lastCell && cell.row === lastCell.row && cell.col === lastCell.col) return;
      lastCell = cell;
      const result = this.state.moveTo(cell.row, cell.col);
      if (result !== 'invalid') {
        this.redrawPath();
        if (this.state.isComplete) {
          isDragging = false;
          this.onLevelComplete();
        }
      }
    });

    this.input.on('pointerup', () => {
      isDragging = false;
      this.state.endDrag();
    });
  }

  // ─── 底部工具栏 ──────────────────────────────────────────────────────────────
  private createBottomBar() {
    const { width, height } = this.scale;
    const btnY = height - 58;
    const btnSize = 60;
    const totalBtns = 3;
    const totalW = totalBtns * btnSize + (totalBtns - 1) * 24;
    const startX = (width - totalW) / 2 + btnSize / 2;

    this.createIconBtn(startX, btnY, '🔄', '重置', 0xFFB74D, () => this.resetLevel());
    this.createIconBtn(startX + btnSize + 24, btnY, '💡', '提示', 0xFFD54F, () => this.showHint());
    this.btnNext = this.createIconBtn(startX + (btnSize + 24) * 2, btnY, '⏭', '下关', 0x78C83D, () => this.nextLevel());

    if (this.levelIndex >= LEVELS.length - 1) {
      this.btnNext.setAlpha(0.4);
    }
  }

  private createIconBtn(
    x: number, y: number,
    icon: string, label: string,
    color: number, callback: () => void
  ): Phaser.GameObjects.Container {
    const size = 60;
    const container = this.add.container(x, y);

    // 阴影
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.1);
    shadow.fillRoundedRect(-size / 2 + 2, -size / 2 + 4, size, size, 16);

    // 按钮背景
    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-size / 2, -size / 2, size, size, 16);
    // 高光
    bg.fillStyle(0xFFFFFF, 0.22);
    bg.fillRoundedRect(-size / 2 + 4, -size / 2 + 4, size - 8, size * 0.42, 10);

    const iconText = this.add.text(0, -7, icon, { fontSize: '24px' }).setOrigin(0.5);
    const labelText = this.add.text(0, 17, label, {
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: '13px',
      color: '#FFFFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    container.add([shadow, bg, iconText, labelText]);
    container.setSize(size, size);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerdown', () => {
      this.tweens.add({
        targets: container,
        scaleX: 0.88, scaleY: 0.88,
        duration: 70, yoyo: true,
        onComplete: () => callback(),
      });
    });

    return container;
  }

  // ─── 关卡操作 ────────────────────────────────────────────────────────────────
  private resetLevel() {
    this.clearHint();
    this.state.reset();
    this.pathGraphics.clear();
    const cr = Math.min(GRID.CELL_RADIUS, this.cellSize * 0.18);
    this.cellGraphics.forEach((g, idx) => {
      const { row, col } = this.cellCoords[idx];
      const { px, py } = this.cellToPixel(row, col);
      this.drawCell(g, px, py, cr, false);
    });
  }

  private showHint() {
    if (!this.hintSolution) return;
    this.clearHint();
    this.state.applyHint(this.hintSolution);
    const solution = this.hintSolution;

    for (let i = 0; i <= solution.length; i++) {
      const timer = this.time.delayedCall(i * ANIM.HINT_STEP_DELAY, () => {
        if (i === solution.length) {
          if (this.state.isComplete) {
            this.time.delayedCall(400, () => this.onLevelComplete());
          }
          return;
        }
        this.renderPartialPath(solution.slice(0, i + 1), 0xAB47BC);
      });
      this.hintTweens.push(timer);
    }
  }

  private renderPartialPath(path: [number, number][], color: number) {
    const g = this.pathGraphics;
    g.clear();
    const s = this.cellSize;
    const half = s / 2;
    const pw = s * GRID.PATH_RADIUS;
    const hw = pw / 2;
    const cr = Math.min(GRID.CELL_RADIUS, s * 0.18);
    const pathSet = new Set(path.map(([r, c]) => `${r},${c}`));

    this.cellGraphics.forEach((cg, idx) => {
      const { row, col } = this.cellCoords[idx];
      const { px, py } = this.cellToPixel(row, col);
      this.drawCell(cg, px, py, cr, pathSet.has(`${row},${col}`), color);
    });

    if (path.length === 0) return;
    g.fillStyle(color, 1);

    for (const [row, col] of path) {
      const { px, py } = this.cellToPixel(row, col);
      g.fillCircle(px + half, py + half, hw);
    }
    for (let i = 0; i < path.length - 1; i++) {
      const [ar, ac] = path[i], [br, bc] = path[i + 1];
      const ap = this.cellToPixel(ar, ac), bp = this.cellToPixel(br, bc);
      const ax = ap.px + half, ay = ap.py + half;
      const bx = bp.px + half, by = bp.py + half;
      if (ar === br) {
        g.fillRect(Math.min(ax, bx), ay - hw, Math.abs(bx - ax), pw);
      } else {
        g.fillRect(ax - hw, Math.min(ay, by), pw, Math.abs(by - ay));
      }
    }
    const fp = this.cellToPixel(path[0][0], path[0][1]);
    g.fillStyle(0xFFFFFF, 0.65);
    g.fillCircle(fp.px + half, fp.py + half, hw * 0.5);

    this.dotsGraphics.setDepth(10);
  }

  private clearHint() {
    this.hintTweens.forEach(t => t.remove());
    this.hintTweens = [];
  }

  private nextLevel() {
    if (this.levelIndex >= LEVELS.length - 1) return;
    this.scene.restart({ levelIndex: this.levelIndex + 1 });
  }

  // ─── 过关 ────────────────────────────────────────────────────────────────────
  private onLevelComplete() {
    completeLevel(this.level.id);
    this.redrawPath();
    this.spawnParticles();
    this.time.delayedCall(ANIM.WIN_DELAY, () => this.showWinOverlay());
  }

  private spawnParticles() {
    const { width, height } = this.scale;
    const colors = [0xFF7043, 0xFFD54F, 0x4FC3F7, 0xAB47BC, 0x66BB6A, 0xFF5252, 0xFFCA28];
    for (let i = 0; i < 30; i++) {
      const g = this.add.graphics();
      const c = colors[i % colors.length];
      const sz = Phaser.Math.Between(7, 16);
      g.fillStyle(c, 1);
      if (i % 3 === 0) g.fillCircle(0, 0, sz / 2);
      else if (i % 3 === 1) g.fillRect(-sz / 2, -sz / 2, sz, sz);
      else g.fillTriangle(0, -sz / 2, sz / 2, sz / 2, -sz / 2, sz / 2);

      g.setPosition(width / 2, height * 0.45);
      g.setDepth(100);

      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(180, 420);
      this.tweens.add({
        targets: g,
        x: g.x + Math.cos(angle) * speed * 0.9,
        y: g.y + Math.sin(angle) * speed * 0.9 - 100 + 250,
        alpha: 0,
        scaleX: 0.1, scaleY: 0.1,
        duration: Phaser.Math.Between(550, 950),
        ease: 'Quad.easeOut',
        onComplete: () => g.destroy(),
      });
    }
  }

  private showWinOverlay() {
    const { width, height } = this.scale;
    if (this.winOverlay) this.winOverlay.destroy();

    const container = this.add.container(width / 2, height / 2);
    container.setDepth(200);

    const mask = this.add.graphics();
    mask.fillStyle(0x000000, 0.42);
    mask.fillRect(-width / 2, -height / 2, width, height);
    container.add(mask);

    const cardW = Math.min(width - 60, 320);
    const cardH = 300;
    const card = this.add.graphics();
    card.fillStyle(0xFFFFFF, 1);
    card.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 24);
    card.fillGradientStyle(0x66BB6A, 0x4FC3F7, 0x66BB6A, 0x4FC3F7, 1);
    card.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, 64, { tl: 24, tr: 24, bl: 0, br: 0 });
    container.add(card);

    const emoji = this.add.text(0, -cardH / 2 + 32, '🎉', { fontSize: '36px' }).setOrigin(0.5);
    const winText = this.add.text(0, -cardH / 2 + 98, '闯关成功！', {
      fontFamily: '"PingFang SC", sans-serif',
      fontSize: '28px', fontStyle: 'bold', color: '#2E7D32',
    }).setOrigin(0.5);
    const starText = this.add.text(0, -cardH / 2 + 150, '⭐', { fontSize: '44px' }).setOrigin(0.5);
    const subText = this.add.text(0, -cardH / 2 + 200, `第 ${this.level.id} 关 · ${this.level.title}`, {
      fontFamily: '"PingFang SC", sans-serif',
      fontSize: '16px', color: '#78909C',
    }).setOrigin(0.5);

    const isLast = this.levelIndex >= LEVELS.length - 1;
    const replayBtn = this.createWinBtn(-cardW / 4 - 8, cardH / 2 - 54, cardW / 2 - 20, '再来一次', 0xFF8A65);
    replayBtn.setInteractive({ useHandCursor: true });
    replayBtn.on('pointerdown', () => {
      container.destroy();
      this.resetLevel();
    });

    const nextBtn = this.createWinBtn(cardW / 4 + 8, cardH / 2 - 54, cardW / 2 - 20, isLast ? '返回菜单' : '下一关 ▶', 0x66BB6A);
    nextBtn.setInteractive({ useHandCursor: true });
    nextBtn.on('pointerdown', () => {
      if (isLast) this.scene.start('MenuScene');
      else this.nextLevel();
    });

    container.add([emoji, winText, starText, subText, replayBtn, nextBtn]);
    this.winOverlay = container;

    container.setScale(0.5);
    container.setAlpha(0);
    this.tweens.add({
      targets: container,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 320, ease: 'Back.easeOut',
    });
  }

  private createWinBtn(x: number, y: number, w: number, label: string, color: number): Phaser.GameObjects.Container {
    const h = 48;
    const btn = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    bg.fillStyle(0xFFFFFF, 0.2);
    bg.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.38, 8);
    const text = this.add.text(0, 0, label, {
      fontFamily: '"PingFang SC", sans-serif',
      fontSize: '15px', fontStyle: 'bold', color: '#FFFFFF',
    }).setOrigin(0.5);
    btn.add([bg, text]);
    btn.setSize(w, h);
    return btn;
  }

  // ─── 进场动画 ────────────────────────────────────────────────────────────────
  private playEnterAnimation() {
    this.cellGraphics.forEach((g, i) => {
      g.setScale(0);
      this.tweens.add({
        targets: g,
        scaleX: 1, scaleY: 1,
        duration: 200,
        delay: i * 28,
        ease: 'Back.easeOut',
      });
    });
  }
}
