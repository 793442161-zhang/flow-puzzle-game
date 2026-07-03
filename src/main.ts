import { LEVELS } from './data/levels';
import { loadProgress, loadSettings, resetProgress, saveSettings } from './game/storage';
import { Game, spawnParticles } from './game/game';

// ─── DOM 引用 ─────────────────────────────────────────────────────────────
const viewMenu   = document.getElementById('view-menu')!;
const viewGame   = document.getElementById('view-game')!;
const homeStage  = document.getElementById('home-stage')!;

// 菜单
const progressLabel = document.getElementById('progress-label')!;
const progressFill  = document.getElementById('progress-fill')!;
const btnStart      = document.getElementById('btn-start')!;
const btnStartLabel = document.getElementById('btn-start-label')!;
const btnSettings   = document.getElementById('btn-settings')!;
const btnResetProg  = document.getElementById('btn-reset')!;
const menuStarScore = document.getElementById('menu-star-score')!;
const homePreviewBoard = document.getElementById('home-preview-board')!;

// 设置弹窗
const settingsOverlay = document.getElementById('settings-overlay')!;
const settingsClose = document.getElementById('settings-close')!;
const settingSoundToggle = document.getElementById('setting-sound-toggle')!;
const settingMusicToggle = document.getElementById('setting-music-toggle')!;
const settingsResetLevelsBtn = document.getElementById('settings-reset-levels-btn')!;
const settingsDevPanel = document.getElementById('settings-dev-panel')!;
const settingsDevLevel = document.getElementById('settings-dev-level') as HTMLInputElement;
const settingsDevJump = document.getElementById('settings-dev-jump')!;
const appToast = document.getElementById('app-toast')!;

// 关卡面板
const panelOverlay  = document.getElementById('panel-overlay')!;

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

const HOME_DESIGN_WIDTH = 375;
const HOME_DESIGN_HEIGHT = 812;
const HOME_PREVIEW_GRID_SIZE = 7;
const HOME_TO_GAME_TRANSITION_MS = 680;
let isHomeToGameTransitioning = false;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let currentLevelTracksProgress = true;

type GameLoadOptions = {
  animate?: boolean;
  trackProgress?: boolean;
};

function updateHomeStageScale() {
  const scale = Math.min(
    window.innerWidth / HOME_DESIGN_WIDTH,
    window.innerHeight / HOME_DESIGN_HEIGHT,
  );
  homeStage.style.setProperty('--home-scale', `${scale}`);
}

// ─── 工具：页面切换 ───────────────────────────────────────────────────────
function showMenu() {
  currentLevelTracksProgress = true;
  viewGame.classList.remove('transition-prep', 'transition-enter');
  viewMenu.classList.remove('home-exiting');
  viewGame.classList.add('hidden');
  setTimeout(() => {
    viewMenu.classList.remove('hidden');
    updateHomeStageScale();
    updateMenuUI();
  }, 50);
  hideWinOverlay();
}

function showGame(levelIndex: number, options: GameLoadOptions = {}) {
  currentLevelTracksProgress = options.trackProgress !== false;
  currentLevelIndex = levelIndex;
  viewMenu.classList.add('hidden');
  setTimeout(() => {
    viewGame.classList.remove('hidden');
    updateGameTopBar();
    updateGameProgress(0);
    game.load(levelIndex, options);
  }, 50);
  hideWinOverlay();
}

function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

async function showGameFromHome(levelIndex: number) {
  if (isHomeToGameTransitioning) return;
  isHomeToGameTransitioning = true;
  btnStart.classList.add('is-transitioning');
  hideWinOverlay();

  try {
    currentLevelTracksProgress = true;
    currentLevelIndex = levelIndex;
    updateGameTopBar();
    updateGameProgress(0);

    viewGame.classList.add('transition-prep');
    viewGame.classList.remove('hidden');
    game.load(levelIndex, { animate: false, trackProgress: true });

    await nextFrame();
    await nextFrame();

    viewMenu.classList.add('home-exiting');
    await wait(180);

    viewGame.classList.remove('transition-prep');
    viewGame.classList.add('transition-enter');

    await wait(HOME_TO_GAME_TRANSITION_MS);
    viewMenu.classList.add('hidden');
    viewMenu.classList.remove('home-exiting');
    viewGame.classList.remove('transition-prep', 'transition-enter');
  } finally {
    btnStart.classList.remove('is-transitioning');
    isHomeToGameTransitioning = false;
  }
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
  const width = 324;
  const height = 324;
  const gap = 6;
  const padding = 18;
  const displayRows = Math.max(HOME_PREVIEW_GRID_SIZE, level.rows);
  const displayCols = Math.max(HOME_PREVIEW_GRID_SIZE, level.cols);
  const rowOffset = Math.floor((displayRows - level.rows) / 2);
  const colOffset = Math.floor((displayCols - level.cols) / 2);
  const cellSize = Math.min(
    (width - padding * 2 - gap * (displayCols - 1)) / displayCols,
    (height - padding * 2 - gap * (displayRows - 1)) / displayRows,
  );
  const gridW = displayCols * cellSize + (displayCols - 1) * gap;
  const gridH = displayRows * cellSize + (displayRows - 1) * gap;
  const boardX = (width - gridW) / 2;
  const boardY = (height - gridH) / 2;
  const boardPad = Math.max(8, cellSize * 0.14);
  const radius = Math.max(12, cellSize * 0.22);
  const boardRadius = Math.max(18, cellSize * 0.28);
  const center = ([row, col]: [number, number]) => ({
    x: boardX + (col + colOffset) * (cellSize + gap) + cellSize / 2,
    y: boardY + (row + rowOffset) * (cellSize + gap) + cellSize / 2,
  });

  const cells: string[] = [];
  for (let displayRow = 0; displayRow < displayRows; displayRow++) {
    for (let displayCol = 0; displayCol < displayCols; displayCol++) {
      const row = displayRow - rowOffset;
      const col = displayCol - colOffset;
      const isInLevel = row >= 0 && row < level.rows && col >= 0 && col < level.cols;
      const isActive = isInLevel && level.grid[row][col] === 1;
      const x = boardX + displayCol * (cellSize + gap);
      const y = boardY + displayRow * (cellSize + gap);
      const fill = isActive ? '#F7F1EA' : '#D0C5B7';
      cells.push(`<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="${radius}" fill="${fill}" />`);
    }
  }

  const start = center(level.start);
  const end = center(level.end);
  const ringRadius = cellSize * 0.25;
  const star = getStarPoints(end.x, end.y, cellSize * 0.17, cellSize * 0.08);

  homePreviewBoard.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="第 ${level.id} 关缩略图">
      <rect x="${boardX - boardPad}" y="${boardY - boardPad}" width="${gridW + boardPad * 2}" height="${gridH + boardPad * 2}" rx="${boardRadius}" fill="#d8cfc3" />
      ${cells.join('')}
      <circle cx="${start.x}" cy="${start.y}" r="${ringRadius}" fill="none" stroke="#fff" stroke-width="${Math.max(5, cellSize * 0.08)}" />
      <circle cx="${end.x}" cy="${end.y}" r="${ringRadius}" fill="none" stroke="#fff" stroke-width="${Math.max(5, cellSize * 0.08)}" />
      <polygon points="${star}" fill="#fff" />
    </svg>
  `;
}

function updateMenuUI() {
  btnResetProg.hidden = !import.meta.env.DEV;

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
      showGame(levelIndex + 1, { trackProgress: currentLevelTracksProgress });
    }
  };
}

function hideWinOverlay() {
  winOverlay.classList.remove('show');
}

// ─── 设置弹窗 ─────────────────────────────────────────────────────────────
function showToast(message: string) {
  appToast.textContent = message;
  appToast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    appToast.classList.remove('show');
    toastTimer = null;
  }, 1800);
}

function updateToggle(button: Element, enabled: boolean) {
  button.classList.toggle('is-on', enabled);
  button.setAttribute('aria-pressed', `${enabled}`);
}

function updateSettingsUI() {
  const settings = loadSettings();
  updateToggle(settingSoundToggle, settings.soundEnabled);
  updateToggle(settingMusicToggle, settings.musicEnabled);

  const showDeveloperTools = import.meta.env.DEV;
  settingsResetLevelsBtn.hidden = !showDeveloperTools;
  settingsDevPanel.hidden = !showDeveloperTools;
  settingsDevLevel.max = `${LEVELS.length}`;
  settingsDevLevel.value = `${getNextLevelIndex() + 1}`;
}

function openSettings() {
  closeLevelPanel();
  updateSettingsUI();
  settingsOverlay.classList.add('open');
  settingsOverlay.setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  settingsOverlay.classList.remove('open');
  settingsOverlay.setAttribute('aria-hidden', 'true');
}

function toggleSetting(key: 'soundEnabled' | 'musicEnabled') {
  const settings = loadSettings();
  const nextSettings = { ...settings, [key]: !settings[key] };
  saveSettings(nextSettings);
  updateSettingsUI();
}

function jumpToDevLevel() {
  const levelId = Number.parseInt(settingsDevLevel.value, 10);
  if (Number.isNaN(levelId)) {
    showToast('请输入有效关卡编号');
    return;
  }

  const safeLevelId = Math.max(1, Math.min(LEVELS.length, levelId));
  settingsDevLevel.value = `${safeLevelId}`;
  closeSettings();
  hideWinOverlay();
  showGame(safeLevelId - 1, { trackProgress: false });
  showToast(`已跳转到第 ${safeLevelId} 关，仅本次调试`);
}

function resetLevelsForDevelopment() {
  resetProgress();
  currentLevelTracksProgress = true;
  updateMenuUI();
  updateSettingsUI();
  closeSettings();
  showToast('关卡进度已重置');
}

// ─── 绑定事件 ─────────────────────────────────────────────────────────────

// 菜单按钮
btnStart.addEventListener('click', () => {
  showGameFromHome(getNextLevelIndex());
});

btnSettings.addEventListener('click', () => openSettings());
btnResetProg.addEventListener('click', () => {
  resetProgress();
  updateMenuUI();
});

settingsClose.addEventListener('click', () => closeSettings());
settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) closeSettings();
});
settingSoundToggle.addEventListener('click', () => toggleSetting('soundEnabled'));
settingMusicToggle.addEventListener('click', () => toggleSetting('musicEnabled'));
settingsResetLevelsBtn.addEventListener('click', () => resetLevelsForDevelopment());
settingsDevJump.addEventListener('click', () => jumpToDevLevel());
settingsDevLevel.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') jumpToDevLevel();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && settingsOverlay.classList.contains('open')) closeSettings();
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
    showGame(currentLevelIndex + 1, { trackProgress: currentLevelTracksProgress });
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
