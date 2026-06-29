import { LEVELS } from './data/levels';
import { loadProgress, resetProgress } from './game/storage';
import { Game, spawnParticles } from './game/game';

// ─── DOM 引用 ─────────────────────────────────────────────────────────────
const viewMenu   = document.getElementById('view-menu')!;
const viewGame   = document.getElementById('view-game')!;

// 菜单
const progressLabel = document.getElementById('progress-label')!;
const progressFill  = document.getElementById('progress-fill')!;
const btnStart      = document.getElementById('btn-start')!;
const btnSelect     = document.getElementById('btn-select')!;
const btnResetProg  = document.getElementById('btn-reset')!;

// 关卡面板
const panelOverlay  = document.getElementById('panel-overlay')!;
const levelGrid     = document.getElementById('level-grid')!;

// 游戏页
const gameStars     = document.getElementById('game-stars')!;
const gameLevelBadge = document.getElementById('game-level-badge')!;
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

// ─── 工具：页面切换 ───────────────────────────────────────────────────────
function showMenu() {
  viewGame.classList.add('hidden');
  setTimeout(() => {
    viewMenu.classList.remove('hidden');
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
    game.load(levelIndex);
  }, 50);
  hideWinOverlay();
}

// ─── 菜单 UI ─────────────────────────────────────────────────────────────
function updateMenuUI() {
  const progress = loadProgress();
  const completed = progress.completedLevels.length;
  const total = LEVELS.length;
  const fillPct = total > 0 ? (completed / total) * 100 : 0;

  progressLabel.textContent = `⭐ ${progress.stars} 星 · 已通关 ${completed} / ${total}`;
  progressFill.style.width = `${fillPct}%`;

  const nextIdx = getNextLevelIndex(progress);
  if (completed > 0) {
    btnStart.textContent = `继续游戏  第 ${nextIdx + 1} 关  ▶`;
  } else {
    btnStart.textContent = '开始游戏  ▶';
  }
}

function getNextLevelIndex(progress: ReturnType<typeof loadProgress>): number {
  for (let i = 0; i < LEVELS.length; i++) {
    if (!progress.completedLevels.includes(LEVELS[i].id)) return i;
  }
  return LEVELS.length - 1;
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
  gameStars.textContent = `⭐ ${progress.stars}`;
  const level = LEVELS[currentLevelIndex];
  gameLevelBadge.textContent = `关卡${level.id} · ${level.title}`;
  const isLast = currentLevelIndex >= LEVELS.length - 1;
  gameBtnNext.classList.toggle('disabled', isLast);
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
  const progress = loadProgress();
  const nextIdx = getNextLevelIndex(progress);
  showGame(nextIdx);
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

// ─── 窗口 resize ─────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  game.resize();
  game.render();
});

// ─── 启动 ─────────────────────────────────────────────────────────────────
updateMenuUI();
