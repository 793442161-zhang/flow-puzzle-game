import { LEVELS } from './data/levels';
import { loadProgress, resetProgress } from './game/storage';
import { Game, spawnParticles } from './game/game';
import { solvePuzzle } from './game/solver';

// ─── DOM 引用 ─────────────────────────────────────────────────────────────
const viewMenu   = document.getElementById('view-menu')!;
const viewGame   = document.getElementById('view-game')!;
const homeStage  = document.getElementById('home-stage')!;

// 菜单
const progressLabel = document.getElementById('progress-label')!;
const progressFill  = document.getElementById('progress-fill')!;
const btnStart      = document.getElementById('btn-start')!;
const btnStartLabel = document.getElementById('btn-start-label')!;
const btnSelect     = document.getElementById('btn-select')!;
const btnResetProg  = document.getElementById('btn-reset')!;
const menuStarScore = document.getElementById('menu-star-score')!;
const homePreviewBoard = document.getElementById('home-preview-board')!;

// 关卡面板
const panelOverlay  = document.getElementById('panel-overlay')!;
const levelGrid     = document.getElementById('level-grid')!;

// 游戏页
const gameStarCount = document.getElementById('game-star-count')!;
const gameLevelBadge = document.getElementById('game-level-badge')!;
const gameProgressFill = document.getElementById('game-progress-fill')!;
const gameProgressPercent = document.getElementById('game-progress-percent')!;
const btnHome       = document.getElementById('btn-home')!;
const gameBtnReset  = document.getElementById('game-btn-reset')!;
const gameBtnHint   = document.getElementById('game-btn-hint')!;
const gameBtnNext   = document.getElementById('game-btn-next')!;
const gameCanvas    = document.getElementById('game-canvas') as HTMLCanvasElement;

// 过关弹窗
const winOverlay    = document.getElementById('win-overlay')!;
const winSub        = document.getElementById('win-sub')!;
const winBtnReplay  = document.getElementById('win-btn-replay')!;
const winBtnNext    = document.getElementById('win-btn-next')!;

// 粒子
const particleCanvas = document.getElementById('particle-canvas') as HTMLCanvasElement;

// ─── 游戏实例 ─────────────────────────────────────────────────────────────
const game = new Game(gameCanvas);
let currentLevelIndex = 0;

const HOME_LEVEL_COLORS = [
  '#FF6A3D', '#F72585', '#3F7CFF', '#B8FF00',
  '#B43CFF', '#FF9A3D', '#45D8FF', '#4BF0A6',
  '#D84CFF', '#5A7BFF',
];
const HOME_DESIGN_WIDTH = 375;
const HOME_DESIGN_HEIGHT = 812;

function updateHomeStageScale() {
  const scale = Math.min(
    window.innerWidth / HOME_DESIGN_WIDTH,
    window.innerHeight / HOME_DESIGN_HEIGHT,
  );
  homeStage.style.setProperty('--home-scale', `${scale}`);
}

// ─── 工具：页面切换 ───────────────────────────────────────────────────────
function showMenu() {
  viewGame.classList.add('hidden');
  setTimeout(() => {
    viewMenu.classList.remove('hidden');
    updateHomeStageScale();
    updateMenuUI();
  }, 50);
  hideWinOverlay();
}

function showGame(levelIndex: number) {
  currentLevelIndex = levelIndex;
  viewMenu.classList.add('hidden');
  setTimeout(() => {
    viewGame.classList.remove('hidden');
    updateGameTopBar();
    updateGameProgress(0);
    game.load(levelIndex);
  }, 50);
  hideWinOverlay();
}

// ─── 菜单 UI ─────────────────────────────────────────────────────────────
function getNextLevelIndex() {
  const progress = loadProgress();
  return Math.max(0, Math.min(progress.unlockedLevel - 1, LEVELS.length - 1));
}

function getStarPoints(cx: number, cy: number, outer: number, inner: number) {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 === 0 ? outer : inner;
    points.push(`${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`);
  }
  return points.join(' ');
}

function renderHomePreview(levelIndex: number) {
  const level = LEVELS[levelIndex];
  const solution = solvePuzzle(level);
  const path = solution ?? [level.start, level.end];
  const color = HOME_LEVEL_COLORS[levelIndex % HOME_LEVEL_COLORS.length];
  const width = 303;
  const height = 231;
  const gap = 6;
  const padding = 10;
  const cellSize = Math.min(
    (width - padding * 2 - gap * (level.cols - 1)) / level.cols,
    (height - padding * 2 - gap * (level.rows - 1)) / level.rows,
  );
  const gridW = level.cols * cellSize + (level.cols - 1) * gap;
  const gridH = level.rows * cellSize + (level.rows - 1) * gap;
  const boardX = (width - gridW) / 2;
  const boardY = (height - gridH) / 2;
  const boardPad = Math.max(8, cellSize * 0.14);
  const radius = Math.max(12, cellSize * 0.22);
  const boardRadius = Math.max(18, cellSize * 0.28);
  const center = ([row, col]: [number, number]) => ({
    x: boardX + col * (cellSize + gap) + cellSize / 2,
    y: boardY + row * (cellSize + gap) + cellSize / 2,
  });

  const cells: string[] = [];
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (level.grid[r][c] !== 1) continue;
      const x = boardX + c * (cellSize + gap);
      const y = boardY + r * (cellSize + gap);
      cells.push(`<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="${radius}" fill="#f7f1ea" stroke="#d1c4b8" stroke-width="1.2" />`);
    }
  }

  const pathPoints = path.map(point => {
    const { x, y } = center(point);
    return `${x},${y}`;
  }).join(' ');
  const start = center(level.start);
  const end = center(level.end);
  const ringRadius = cellSize * 0.25;
  const star = getStarPoints(end.x, end.y, cellSize * 0.17, cellSize * 0.08);

  homePreviewBoard.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="第 ${level.id} 关缩略图">
      <rect x="${boardX - boardPad}" y="${boardY - boardPad}" width="${gridW + boardPad * 2}" height="${gridH + boardPad * 2}" rx="${boardRadius}" fill="#d8cfc3" />
      ${cells.join('')}
      <polyline points="${pathPoints}" fill="none" stroke="${color}" stroke-width="${cellSize * 0.78}" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="${start.x}" cy="${start.y}" r="${ringRadius}" fill="none" stroke="#fff" stroke-width="${Math.max(5, cellSize * 0.08)}" />
      <circle cx="${end.x}" cy="${end.y}" r="${ringRadius}" fill="none" stroke="#fff" stroke-width="${Math.max(5, cellSize * 0.08)}" />
      <polygon points="${star}" fill="#fff" />
    </svg>
  `;
}

function updateMenuUI() {
  const progress = loadProgress();
  const completed = progress.completedLevels.length;
  const total = LEVELS.length;
  const fillPct = total > 0 ? (completed / total) * 100 : 0;

  progressLabel.textContent = `⭐ ${progress.stars} 星 · 已通关 ${completed} / ${total}`;
  progressFill.style.width = `${fillPct}%`;
  menuStarScore.textContent = `${progress.stars * 125}`;

  const nextLevelIndex = getNextLevelIndex();
  const startText = `第 ${LEVELS[nextLevelIndex].id} 关`;
  btnStartLabel.textContent = startText;
  btnStart.setAttribute('aria-label', startText);
  renderHomePreview(nextLevelIndex);
}

// ─── 关卡面板 ─────────────────────────────────────────────────────────────
function buildLevelPanel() {
  const progress = loadProgress();
  levelGrid.innerHTML = '';
  LEVELS.forEach((level, i) => {
    const isCompleted = progress.completedLevels.includes(level.id);
    const isUnlocked  = level.id <= progress.unlockedLevel;

    const cell = document.createElement('div');
    cell.className = `level-cell ${isCompleted ? 'completed' : isUnlocked ? 'unlocked' : 'locked'}`;

    const num = document.createElement('div');
    num.textContent = isCompleted ? '✓' : isUnlocked ? `${level.id}` : '🔒';
    cell.appendChild(num);

    if (isUnlocked) {
      const name = document.createElement('div');
      name.className = 'level-cell-name';
      name.textContent = level.title.slice(0, 4);
      cell.appendChild(name);
    }

    if (isUnlocked) {
      cell.addEventListener('click', () => {
        closeLevelPanel();
        setTimeout(() => showGame(i), 320);
      });
    }
    levelGrid.appendChild(cell);
  });
}

function openLevelPanel() {
  buildLevelPanel();
  panelOverlay.classList.add('open');
}

function closeLevelPanel() {
  panelOverlay.classList.remove('open');
}

// ─── 游戏顶部栏 ───────────────────────────────────────────────────────────
function updateGameTopBar() {
  const progress = loadProgress();
  gameStarCount.textContent = `${progress.stars}`;
  const level = LEVELS[currentLevelIndex];
  gameLevelBadge.textContent = `Level ${level.id}`;
  const isLast = currentLevelIndex >= LEVELS.length - 1;
  gameBtnNext.classList.toggle('disabled', isLast);
}

function updateGameProgress(progress: number) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  const percent = Math.round(safeProgress * 100);
  gameProgressFill.style.width = `${percent}%`;
  gameProgressFill.classList.toggle('is-empty', percent === 0);
  gameProgressPercent.textContent = `${percent}%`;
}

// ─── 过关弹窗 ─────────────────────────────────────────────────────────────
function showWinOverlay(levelIndex: number) {
  const level = LEVELS[levelIndex];
  const isLast = levelIndex >= LEVELS.length - 1;

  winSub.textContent = `第 ${level.id} 关 · ${level.title}`;
  winBtnNext.textContent = isLast ? '返回菜单' : '下一关 ▶';
  updateGameTopBar();

  // 粒子效果
  spawnParticles(particleCanvas);

  setTimeout(() => {
    winOverlay.classList.add('show');
  }, 400);

  winBtnReplay.onclick = () => {
    hideWinOverlay();
    game.resetLevel();
  };
  winBtnNext.onclick = () => {
    hideWinOverlay();
    if (isLast) {
      showMenu();
    } else {
      showGame(levelIndex + 1);
    }
  };
}

function hideWinOverlay() {
  winOverlay.classList.remove('show');
}

// ─── 绑定事件 ─────────────────────────────────────────────────────────────

// 菜单按钮
btnStart.addEventListener('click', () => {
  showGame(getNextLevelIndex());
});

btnSelect.addEventListener('click', () => openLevelPanel());
btnResetProg.addEventListener('click', () => {
  resetProgress();
  updateMenuUI();
});

// 关卡面板：点击遮罩关闭
panelOverlay.addEventListener('click', (e) => {
  if (e.target === panelOverlay) closeLevelPanel();
});

// 游戏页按钮
btnHome.addEventListener('click', () => showMenu());

gameBtnReset.addEventListener('click', () => {
  hideWinOverlay();
  game.resetLevel();
});

gameBtnHint.addEventListener('click', () => game.showHint());

gameBtnNext.addEventListener('click', () => {
  if (currentLevelIndex < LEVELS.length - 1) {
    showGame(currentLevelIndex + 1);
  }
});

// 游戏过关回调
game.setOnComplete((levelIndex) => {
  showWinOverlay(levelIndex);
});

game.setOnProgress((progress) => {
  updateGameProgress(progress);
});

// ─── 窗口 resize ─────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  updateHomeStageScale();
  game.resize();
  game.render();
});

// ─── 启动 ─────────────────────────────────────────────────────────────────
updateHomeStageScale();
updateMenuUI();
