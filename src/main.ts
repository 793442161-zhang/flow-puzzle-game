import { LEVELS } from './data/levels';
import {
  claimHomeReward,
  feedCat,
  grantAdRewardBonus,
  getHomeActionTips,
  getHomeBuildItemState,
  getHomeGoals,
  getLevelRewardKind,
  getMilestoneUnlock,
  HOME_BUILD_ITEMS,
  loadProgress,
  loadSettings,
  purchaseHomeItem,
  resetProgress,
  saveSettings,
} from './game/storage';
import type { CompleteLevelResult } from './game/storage';
import { Game, spawnParticles } from './game/game';
import { showRewardedAd } from './monetization/rewardedAd';

// ─── DOM 引用 ─────────────────────────────────────────────────────────────
const viewMenu   = document.getElementById('view-menu')!;
const viewCatHome = document.getElementById('view-cat-home')!;
const viewGame   = document.getElementById('view-game')!;
const appRoot = document.getElementById('app')!;
const homeStage  = document.getElementById('home-stage')!;
const catHomeStage = document.getElementById('cat-home-stage')!;

// 菜单
const progressLabel = document.getElementById('progress-label')!;
const progressFill  = document.getElementById('progress-fill')!;
const btnStart      = document.getElementById('btn-start')!;
const btnStartLabel = document.getElementById('btn-start-label')!;
const btnSettings   = document.getElementById('btn-settings')!;
const btnCatHome    = document.getElementById('btn-cat-home')!;
const homeEntryTip = document.getElementById('home-entry-tip')!;
const btnResetProg  = document.getElementById('btn-reset')!;
const menuStarScore = document.getElementById('menu-star-score')!;
const homePreviewBoard = document.getElementById('home-preview-board')!;

// 猫咪家园
const catHomeBack = document.getElementById('cat-home-back')!;
const homeStarsCount = document.getElementById('home-stars-count')!;
const homeFoodCount = document.getElementById('home-food-count')!;
const homeCoinsCount = document.getElementById('home-coins-count')!;
const catSatietyFill = document.getElementById('cat-satiety-fill')!;
const catSatietyText = document.getElementById('cat-satiety-text')!;
const catAffectionFill = document.getElementById('cat-affection-fill')!;
const catAffectionText = document.getElementById('cat-affection-text')!;
const catOwnedItems = document.getElementById('cat-owned-items')!;
const catHomeSummary = document.getElementById('cat-home-summary')!;
const catFeedBtn = document.getElementById('cat-feed-btn')!;
const catBuildBtn = document.getElementById('cat-build-btn')!;
const catRewardBtn = document.getElementById('cat-reward-btn')!;
const catFeedLabel = document.getElementById('cat-feed-label')!;
const catBuildLabel = document.getElementById('cat-build-label')!;
const catRewardLabel = document.getElementById('cat-reward-label')!;
const catRoom = document.getElementById('cat-room')!;
const catCharacter = document.getElementById('cat-character')!;
const catHomeBowl = document.getElementById('cat-home-bowl')!;
const catHomeGoals = document.getElementById('cat-home-goals')!;
const homeBuildOverlay = document.getElementById('home-build-overlay')!;
const homeBuildClose = document.getElementById('home-build-close')!;
const homeBuildSummary = document.getElementById('home-build-summary')!;
const homeBuildList = document.getElementById('home-build-list')!;

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
const winRewards    = document.getElementById('win-rewards')!;
const winMilestone  = document.getElementById('win-milestone')!;
const winAdBonus    = document.getElementById('win-ad-bonus') as HTMLButtonElement;
const winBtnReplay  = document.getElementById('win-btn-replay')!;
const winBtnNext    = document.getElementById('win-btn-next')!;

// 激励广告弹窗
const rewardedAdOverlay = document.getElementById('rewarded-ad-overlay')!;
const rewardedAdCancel = document.getElementById('rewarded-ad-cancel') as HTMLButtonElement;
const rewardedAdWatch = document.getElementById('rewarded-ad-watch') as HTMLButtonElement;

// 粒子
const particleCanvas = document.getElementById('particle-canvas') as HTMLCanvasElement;

// ─── 游戏实例 ─────────────────────────────────────────────────────────────
const game = new Game(gameCanvas);
let currentLevelIndex = 0;

const HOME_DESIGN_WIDTH = 375;
const HOME_DESIGN_HEIGHT = 812;
const HOME_PREVIEW_GRID_SIZE = 7;
const HOME_TO_GAME_TRANSITION_MS = 680;
const CAT_FEED_COST = 6;
let isHomeToGameTransitioning = false;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let currentLevelTracksProgress = true;
let isRewardedAdPending = false;
let isWinRewardAdPending = false;
let chipId = 0;
let hasRenderedHomeGoals = false;
const previousHomeGoalCompletion = new Map<string, boolean>();

type GameLoadOptions = {
  animate?: boolean;
  trackProgress?: boolean;
};

function updateViewportSize() {
  const viewport = window.visualViewport;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-viewport-width', `${width}px`);
  document.documentElement.style.setProperty('--app-viewport-height', `${height}px`);
}

function updateHomeStageScale() {
  updateViewportSize();
  const rect = appRoot.getBoundingClientRect();
  const scale = Math.min(
    rect.width / HOME_DESIGN_WIDTH,
    rect.height / HOME_DESIGN_HEIGHT,
  );
  homeStage.style.setProperty('--home-scale', `${scale}`);
  catHomeStage.style.setProperty('--home-scale', `${scale}`);
}

// ─── 工具：页面切换 ───────────────────────────────────────────────────────
function showMenu() {
  currentLevelTracksProgress = true;
  closeRewardedAdPrompt();
  closeHomeBuildPanel();
  game.dismissTutorial(false);
  viewGame.classList.remove('transition-prep', 'transition-enter');
  viewMenu.classList.remove('home-exiting');
  viewGame.classList.add('hidden');
  viewCatHome.classList.add('hidden');
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
  viewCatHome.classList.add('hidden');
  closeHomeBuildPanel();
  setTimeout(() => {
    viewGame.classList.remove('hidden');
    updateGameTopBar();
    updateGameProgress(0);
    game.load(levelIndex, options);
  }, 50);
  hideWinOverlay();
}

function showCatHome() {
  closeRewardedAdPrompt();
  hideWinOverlay();
  closeLevelPanel();
  closeSettings();
  viewMenu.classList.add('hidden');
  viewGame.classList.add('hidden');
  viewCatHome.classList.remove('hidden');
  updateHomeStageScale();
  updateCatHomeUI();
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

function renderPreviewRewardIcon(cx: number, cy: number, size: number, levelId: number) {
  const kind = getLevelRewardKind(levelId);
  if (kind === 'coin') {
    return `
      <ellipse cx="${cx}" cy="${cy}" rx="${size * 0.13}" ry="${size * 0.18}" fill="#fff" />
      <path d="M${cx} ${cy - size * 0.11}V${cy + size * 0.11}" stroke="#d8cfc3" stroke-width="${Math.max(2, size * 0.05)}" stroke-linecap="round" />
    `;
  }

  if (kind === 'gift') {
    const w = size * 0.34;
    const h = size * 0.28;
    return `
      <rect x="${cx - w / 2}" y="${cy - h / 2 + size * 0.03}" width="${w}" height="${h}" rx="${size * 0.06}" fill="#fff" />
      <rect x="${cx - size * 0.025}" y="${cy - h / 2 + size * 0.03}" width="${size * 0.05}" height="${h}" fill="#d8cfc3" opacity="0.8" />
      <rect x="${cx - w / 2}" y="${cy - size * 0.04}" width="${w}" height="${size * 0.06}" fill="#d8cfc3" opacity="0.8" />
      <circle cx="${cx - size * 0.07}" cy="${cy - size * 0.17}" r="${size * 0.07}" fill="#fff" />
      <circle cx="${cx + size * 0.07}" cy="${cy - size * 0.17}" r="${size * 0.07}" fill="#fff" />
    `;
  }

  return `
    <path d="M${cx - size * 0.18} ${cy + size * 0.03} Q${cx} ${cy + size * 0.24} ${cx + size * 0.18} ${cy + size * 0.03}Z" fill="#fff" />
    <ellipse cx="${cx}" cy="${cy - size * 0.08}" rx="${size * 0.1}" ry="${size * 0.06}" fill="#fff" />
  `;
}

function getCatAffectionLevel(affection: number) {
  return Math.max(1, Math.min(5, Math.floor(affection / 25) + 1));
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

  homePreviewBoard.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="第 ${level.id} 关缩略图">
      <rect x="${boardX - boardPad}" y="${boardY - boardPad}" width="${gridW + boardPad * 2}" height="${gridH + boardPad * 2}" rx="${boardRadius}" fill="#d8cfc3" />
      ${cells.join('')}
      <circle cx="${start.x}" cy="${start.y}" r="${ringRadius}" fill="none" stroke="#fff" stroke-width="${Math.max(5, cellSize * 0.08)}" />
      <circle cx="${end.x}" cy="${end.y}" r="${ringRadius}" fill="none" stroke="#fff" stroke-width="${Math.max(5, cellSize * 0.08)}" />
      ${renderPreviewRewardIcon(end.x, end.y, cellSize, level.id)}
    </svg>
  `;
}

function updateMenuUI() {
  btnResetProg.hidden = !import.meta.env.DEV;

  const progress = loadProgress();
  const tips = getHomeActionTips(progress);
  const readyBuildCount = HOME_BUILD_ITEMS.filter(item => {
    const state = getHomeBuildItemState(progress, item);
    return !state.isOwned && state.canAfford;
  }).length;
  const homeEntryLabel = tips.canClaimReward
    ? '可领奖'
    : (readyBuildCount > 0 ? `可建${readyBuildCount}` : (tips.canFeed ? '可喂猫' : ''));
  const completed = progress.completedLevels.length;
  const total = LEVELS.length;
  const fillPct = total > 0 ? (completed / total) * 100 : 0;

  progressLabel.textContent = `⭐ ${progress.stars} 星 · 猫粮 ${progress.catFood} · 金币 ${progress.coins}`;
  progressFill.style.width = `${fillPct}%`;
  menuStarScore.textContent = `${progress.stars}`;

  const nextLevelIndex = getNextLevelIndex();
  const startText = `第 ${LEVELS[nextLevelIndex].id} 关`;
  btnStartLabel.textContent = startText;
  btnStart.setAttribute('aria-label', startText);
  btnCatHome.classList.toggle('has-red-dot', tips.hasAny);
  homeEntryTip.textContent = homeEntryLabel;
  btnCatHome.setAttribute('aria-label', homeEntryLabel ? `进入猫咪家园，${homeEntryLabel}` : '进入猫咪家园');
  renderHomePreview(nextLevelIndex);
}

function replayClassAnimation(element: Element, className: string) {
  element.classList.remove(className);
  void (element as HTMLElement).offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), 900);
}

function spawnHomeChip(text: string, color: string, x: string, y: string) {
  const chip = document.createElement('div');
  chip.className = 'cat-floating-chip';
  chip.textContent = text;
  chip.style.setProperty('--chip-color', color);
  chip.style.setProperty('--chip-x', x);
  chip.style.setProperty('--chip-y', y);
  chip.dataset.chipId = `${chipId++}`;
  catHomeStage.appendChild(chip);
  chip.addEventListener('animationend', () => chip.remove(), { once: true });
}

function renderCatFurniture(ownedItemIds: string[]) {
  const ownedFurniture = HOME_BUILD_ITEMS.filter(item =>
    item.kind === 'furniture' && ownedItemIds.includes(item.id)
  );

  catOwnedItems.innerHTML = ownedFurniture.length > 0
    ? ownedFurniture.map(item => `
        <div class="cat-owned-item home-item-${item.id}" title="${item.name}">
          <span>${item.icon}</span>
        </div>
      `).join('')
    : '<div class="cat-owned-empty">等待建造</div>';

  const slots = [
    document.querySelector('.cat-build-slot.slot-1'),
    document.querySelector('.cat-build-slot.slot-2'),
  ];
  slots.forEach((slot, index) => {
    slot?.classList.toggle('is-hidden', ownedFurniture.length > index);
  });
}

function getReadyHomeBuildItems() {
  const progress = loadProgress();
  return HOME_BUILD_ITEMS.filter(item => {
    const state = getHomeBuildItemState(progress, item);
    return !state.isOwned && state.canAfford;
  });
}

function renderHomeGoals() {
  const goals = getHomeGoals();
  const nextGoal = goals.find(goal => goal.actionable);
  catHomeGoals.innerHTML = goals.map(goal => {
    const percent = goal.target > 0
      ? Math.max(0, Math.min(100, Math.round((goal.current / goal.target) * 100)))
      : 0;
    const stateClass = [
      goal.completed ? 'is-complete' : '',
      goal.actionable ? 'is-actionable' : '',
      nextGoal?.id === goal.id ? 'is-next' : '',
      hasRenderedHomeGoals && goal.completed && !previousHomeGoalCompletion.get(goal.id) ? 'is-just-completed' : '',
    ].filter(Boolean).join(' ');
    const label = goal.completed ? '完成' : `${goal.current}/${goal.target}`;
    previousHomeGoalCompletion.set(goal.id, goal.completed);

    return `
      <button class="cat-home-goal ${stateClass}" type="button" data-goal-id="${goal.id}" style="--goal-progress:${percent}%; --goal-accent:var(--goal-${goal.accent})">
        <span class="cat-home-goal-title">${goal.title}</span>
        <span class="cat-home-goal-state">${label}</span>
        <span class="cat-home-goal-desc">${goal.description}</span>
      </button>
    `;
  }).join('');
  hasRenderedHomeGoals = true;
}

function updateHomeActionDots() {
  const progress = loadProgress();
  const tips = getHomeActionTips(progress);
  const readyBuildCount = getReadyHomeBuildItems().length;
  catFeedBtn.classList.toggle('has-red-dot', tips.canFeed);
  catBuildBtn.classList.toggle('has-red-dot', tips.canBuild);
  catRewardBtn.classList.toggle('has-red-dot', tips.canClaimReward);
  catFeedBtn.classList.toggle('is-muted', progress.catFood < CAT_FEED_COST || progress.cat.satiety >= 100);
  catBuildBtn.classList.toggle('is-muted', readyBuildCount === 0);
  catRewardBtn.classList.toggle('is-muted', !tips.canClaimReward);
  btnCatHome.classList.toggle('has-red-dot', tips.hasAny);

  catFeedLabel.textContent = progress.cat.satiety >= 100
    ? '已吃饱'
    : (progress.catFood >= CAT_FEED_COST ? `消耗${CAT_FEED_COST}` : '猫粮不足');
  catBuildLabel.textContent = readyBuildCount > 0 ? `可建 ${readyBuildCount}` : '查看列表';
  catRewardLabel.textContent = tips.canClaimReward ? '今日可领' : '已领取';
}

function updateCatHomeUI() {
  const progress = loadProgress();
  const ownedFurnitureCount = HOME_BUILD_ITEMS.filter(item =>
    item.kind === 'furniture' && progress.home.ownedItems.includes(item.id)
  ).length;
  const totalFurnitureCount = HOME_BUILD_ITEMS.filter(item => item.kind === 'furniture').length;
  const readyBuildCount = getReadyHomeBuildItems().length;

  homeStarsCount.textContent = `${progress.stars}`;
  homeFoodCount.textContent = `${progress.catFood}`;
  homeCoinsCount.textContent = `${progress.coins}`;
  catHomeSummary.innerHTML = `
    <span class="cat-home-summary-pill"><span>亲密</span><strong>Lv.${getCatAffectionLevel(progress.cat.affection)}</strong></span>
    <span class="cat-home-summary-pill"><span>家具</span><strong>${ownedFurnitureCount}/${totalFurnitureCount}</strong></span>
    <span class="cat-home-summary-pill"><span>房间</span><strong>Lv.${progress.home.roomLevel}</strong></span>
    <span class="cat-home-summary-pill ${readyBuildCount > 0 ? 'is-ready' : ''}"><span>可建</span><strong>${readyBuildCount}</strong></span>
  `;

  catSatietyFill.style.width = `${progress.cat.satiety}%`;
  catSatietyText.textContent = `${progress.cat.satiety}%`;
  catAffectionFill.style.width = `${progress.cat.affection}%`;
  catAffectionText.textContent = `${progress.cat.affection}%`;

  renderCatFurniture(progress.home.ownedItems);
  renderHomeGoals();
  updateHomeActionDots();
  catRoom.classList.toggle('is-expanded', progress.home.roomLevel >= 2);
}

function updateHomeBuildList() {
  const progress = loadProgress();
  const readyBuildCount = HOME_BUILD_ITEMS.filter(item => {
    const state = getHomeBuildItemState(progress, item);
    return !state.isOwned && state.canAfford;
  }).length;
  const ownedBuildCount = HOME_BUILD_ITEMS.filter(item => getHomeBuildItemState(progress, item).isOwned).length;
  const sortedItems = [...HOME_BUILD_ITEMS].sort((a, b) => {
    const stateA = getHomeBuildItemState(progress, a);
    const stateB = getHomeBuildItemState(progress, b);
    return stateA.sortPriority - stateB.sortPriority || a.cost - b.cost;
  });

  homeBuildSummary.innerHTML = `
    <span>金币 <strong>${progress.coins}</strong></span>
    <span>可建造 <strong>${readyBuildCount}</strong></span>
    <span>已完成 <strong>${ownedBuildCount}/${HOME_BUILD_ITEMS.length}</strong></span>
  `;

  homeBuildList.innerHTML = sortedItems.map(item => {
    const state = getHomeBuildItemState(progress, item);
    const stateClass = state.isOwned ? 'is-owned' : (state.canAfford ? 'is-ready' : 'is-locked');
    const costLabel = state.isOwned ? state.statusLabel : `${item.cost}币`;
    const hintLabel = state.isOwned
      ? '已完成'
      : (state.canAfford ? '现在可建造' : `还差 ${state.missingCoins} 金币`);

    return `
      <button class="home-build-card ${stateClass}" type="button" data-build-id="${item.id}" ${state.isOwned ? 'disabled' : ''}>
        <span class="home-build-icon">${item.icon}</span>
        <span class="home-build-copy">
          <span class="home-build-name">${item.name}</span>
          <span class="home-build-desc">${item.description}</span>
          <span class="home-build-hint">${hintLabel}</span>
        </span>
        <span class="home-build-side">
          <span class="home-build-state">${state.statusLabel}</span>
          <span class="home-build-cost">${costLabel}</span>
        </span>
      </button>
    `;
  }).join('');
}

function openHomeBuildPanel() {
  updateHomeBuildList();
  homeBuildOverlay.classList.add('open');
  homeBuildOverlay.setAttribute('aria-hidden', 'false');
}

function closeHomeBuildPanel() {
  homeBuildOverlay.classList.remove('open');
  homeBuildOverlay.setAttribute('aria-hidden', 'true');
}

function handleFeedCat() {
  const result = feedCat();
  updateCatHomeUI();
  updateMenuUI();
  if (result.success) {
    replayClassAnimation(catCharacter, 'is-fed');
    replayClassAnimation(catHomeBowl, 'is-active');
    spawnHomeChip('+饱腹', '#ff9a3d', '50%', '43%');
    spawnHomeChip('+亲密', '#ff4f79', '60%', '38%');
  }
  showToast(result.message);
}

function handleHomeReward() {
  const result = claimHomeReward();
  updateCatHomeUI();
  updateMenuUI();
  if (result.success) {
    replayClassAnimation(catRoom, 'is-rewarding');
    replayClassAnimation(catCharacter, 'is-happy');
    spawnHomeChip('+12 猫粮', '#ff9a3d', '38%', '23%');
    spawnHomeChip('+60 金币', '#4bf0a6', '63%', '25%');
  }
  showToast(result.message);
}

function handlePurchaseHomeItem(itemId: string) {
  const result = purchaseHomeItem(itemId);
  updateCatHomeUI();
  updateHomeBuildList();
  updateMenuUI();
  if (result.success) {
    replayClassAnimation(catRoom, 'is-built');
    replayClassAnimation(catCharacter, 'is-happy');
    spawnHomeChip('建造完成', '#45d8ff', '50%', '31%');
  }
  showToast(result.message);
}

function handleHomeGoal(goalId: string) {
  const goal = getHomeGoals().find(item => item.id === goalId);
  if (!goal) return;

  if (goal.completed && !goal.actionable) {
    showToast(`${goal.title}已完成`);
    return;
  }

  if (goal.id === 'daily-reward' && goal.actionable) {
    handleHomeReward();
    return;
  }

  if (goal.id === 'feed-cat' && goal.actionable) {
    handleFeedCat();
    return;
  }

  if (goal.id === 'feed-cat') {
    showToast(loadProgress().catFood < CAT_FEED_COST ? '猫粮不足，先通关或领奖' : '小猫现在状态很好');
    return;
  }

  if (!goal.actionable && (goal.id === 'build-furniture' || goal.id === 'expand-room')) {
    showToast('金币不足，先通关或领取奖励');
  }

  openHomeBuildPanel();
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
function renderWinRewards(result: CompleteLevelResult | null) {
  const reward = result?.reward;
  if (!reward || (reward.stars === 0 && reward.catFood === 0 && reward.coins === 0)) {
    winRewards.hidden = true;
    winRewards.innerHTML = '';
    return;
  }

  winRewards.hidden = false;
  winRewards.innerHTML = `
    <div class="win-reward-chip"><span class="win-reward-icon star">★</span>+${reward.stars}</div>
    <div class="win-reward-chip"><span class="win-reward-icon food">粮</span>+${reward.catFood}</div>
    <div class="win-reward-chip"><span class="win-reward-icon coin">币</span>+${reward.coins}</div>
  `;
}

function renderWinMilestone(levelIndex: number, result: CompleteLevelResult | null) {
  const reward = result?.reward;
  const level = LEVELS[levelIndex];
  const unlock = getMilestoneUnlock(level.id);
  const shouldShow = Boolean(
    unlock &&
    reward?.kind === 'gift' &&
    result?.firstCompletion &&
    currentLevelTracksProgress
  );

  if (!shouldShow || !unlock) {
    winMilestone.hidden = true;
    winMilestone.innerHTML = '';
    return;
  }

  winMilestone.hidden = false;
  winMilestone.innerHTML = `
    <span class="win-milestone-icon">${unlock.icon}</span>
    <span class="win-milestone-copy">
      <span class="win-milestone-title">${unlock.title}</span>
      <span class="win-milestone-desc">${unlock.description}</span>
    </span>
  `;
}

function updateWinAdBonus(result: CompleteLevelResult | null, claimed = false) {
  const reward = result?.reward;
  const canDoubleReward = Boolean(
    result?.firstCompletion &&
    currentLevelTracksProgress &&
    reward &&
    (reward.catFood > 0 || reward.coins > 0)
  );

  winAdBonus.hidden = !canDoubleReward;
  winAdBonus.disabled = claimed || isWinRewardAdPending;
  winAdBonus.classList.toggle('is-claimed', claimed);

  if (!canDoubleReward) {
    winAdBonus.textContent = '看广告奖励 x2';
    return;
  }

  if (claimed) {
    winAdBonus.textContent = '翻倍奖励已领取';
    return;
  }

  winAdBonus.textContent = `看广告再得 粮+${reward?.catFood ?? 0} 币+${reward?.coins ?? 0}`;
}

async function handleWinAdBonus(result: CompleteLevelResult | null) {
  if (!result || isWinRewardAdPending || winAdBonus.disabled) return;

  isWinRewardAdPending = true;
  updateWinAdBonus(result);

  try {
    const adResult = await showRewardedAd('double-reward');
    if (!adResult.rewardGranted) {
      showToast('完整观看广告后可翻倍奖励');
      return;
    }

    grantAdRewardBonus(result.reward);
    updateGameTopBar();
    updateMenuUI();
    updateCatHomeUI();
    updateWinAdBonus(result, true);
    showToast(`额外获得猫粮 +${result.reward.catFood}、金币 +${result.reward.coins}`);
  } catch (_) {
    showToast('广告暂不可用，请稍后再试');
  } finally {
    isWinRewardAdPending = false;
    if (!winAdBonus.classList.contains('is-claimed')) {
      updateWinAdBonus(result);
    }
  }
}

function showWinOverlay(levelIndex: number, result: CompleteLevelResult | null) {
  const level = LEVELS[levelIndex];
  const isLast = levelIndex >= LEVELS.length - 1;

  winSub.textContent = `第 ${level.id} 关`;
  winBtnNext.textContent = isLast ? '回主页' : '下一关';
  renderWinRewards(result);
  renderWinMilestone(levelIndex, result);
  updateWinAdBonus(result);
  updateGameTopBar();

  setTimeout(() => {
    winOverlay.classList.add('show');
    requestAnimationFrame(() => {
      spawnParticles(particleCanvas);
    });
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
  winAdBonus.onclick = () => {
    void handleWinAdBonus(result);
  };
}

function hideWinOverlay() {
  winOverlay.classList.remove('show');
  winMilestone.hidden = true;
  winMilestone.innerHTML = '';
  winAdBonus.hidden = true;
  winAdBonus.disabled = false;
  winAdBonus.classList.remove('is-claimed');
  winAdBonus.textContent = '看广告奖励 x2';
}

// ─── 激励广告提示 ─────────────────────────────────────────────────────────
function openRewardedAdPrompt() {
  if (!game.canUseHint()) {
    showToast('当前无法使用提示');
    return;
  }

  closeLevelPanel();
  closeSettings();
  hideWinOverlay();
  rewardedAdOverlay.classList.add('open');
  rewardedAdOverlay.setAttribute('aria-hidden', 'false');
}

function closeRewardedAdPrompt(force = false) {
  if (isRewardedAdPending && !force) return;
  rewardedAdOverlay.classList.remove('open');
  rewardedAdOverlay.setAttribute('aria-hidden', 'true');
}

async function confirmRewardedAdPrompt() {
  if (isRewardedAdPending) return;

  isRewardedAdPending = true;
  rewardedAdWatch.disabled = true;
  gameBtnHint.classList.add('disabled');

  try {
    const result = await showRewardedAd('hint');
    if (result.rewardGranted) {
      closeRewardedAdPrompt(true);
      game.showHint();
      return;
    }

    showToast('完整观看广告后可获得提示');
  } catch (_) {
    showToast('广告暂不可用，请稍后再试');
  } finally {
    isRewardedAdPending = false;
    rewardedAdWatch.disabled = false;
    gameBtnHint.classList.remove('disabled');
    if (!rewardedAdOverlay.classList.contains('open')) {
      rewardedAdOverlay.setAttribute('aria-hidden', 'true');
    }
  }
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
  updateCatHomeUI();
  updateSettingsUI();
  closeSettings();
  showToast('关卡进度已重置');
}

// ─── 绑定事件 ─────────────────────────────────────────────────────────────

// 菜单按钮
btnStart.addEventListener('click', () => {
  showGameFromHome(getNextLevelIndex());
});

btnCatHome.addEventListener('click', () => showCatHome());
btnSettings.addEventListener('click', () => openSettings());
btnResetProg.addEventListener('click', () => {
  resetProgress();
  updateMenuUI();
  updateCatHomeUI();
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
  if (e.key !== 'Escape') return;
  if (homeBuildOverlay.classList.contains('open')) {
    closeHomeBuildPanel();
    return;
  }
  if (rewardedAdOverlay.classList.contains('open')) {
    closeRewardedAdPrompt();
    return;
  }
  if (settingsOverlay.classList.contains('open')) closeSettings();
});

rewardedAdOverlay.addEventListener('click', (e) => {
  if (e.target === rewardedAdOverlay) closeRewardedAdPrompt();
});
rewardedAdCancel.addEventListener('click', () => closeRewardedAdPrompt());
rewardedAdWatch.addEventListener('click', () => {
  void confirmRewardedAdPrompt();
});

catHomeBack.addEventListener('click', () => showMenu());
catFeedBtn.addEventListener('click', () => handleFeedCat());
catBuildBtn.addEventListener('click', () => openHomeBuildPanel());
catRewardBtn.addEventListener('click', () => handleHomeReward());
catHomeGoals.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>('[data-goal-id]');
  if (!button) return;
  handleHomeGoal(button.dataset.goalId ?? '');
});
homeBuildClose.addEventListener('click', () => closeHomeBuildPanel());
homeBuildOverlay.addEventListener('click', (e) => {
  if (e.target === homeBuildOverlay) closeHomeBuildPanel();
});
homeBuildList.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>('[data-build-id]');
  if (!button || button.disabled) return;
  handlePurchaseHomeItem(button.dataset.buildId ?? '');
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

gameBtnHint.addEventListener('click', () => openRewardedAdPrompt());

gameBtnNext.addEventListener('click', () => {
  if (currentLevelIndex < LEVELS.length - 1) {
    showGame(currentLevelIndex + 1, { trackProgress: currentLevelTracksProgress });
  }
});

// 游戏过关回调
game.setOnComplete((levelIndex, result) => {
  showWinOverlay(levelIndex, result);
});

game.setOnProgress((progress) => {
  updateGameProgress(progress);
});

// ─── 窗口 resize ─────────────────────────────────────────────────────────
function handleViewportResize() {
  updateHomeStageScale();
  game.resize();
  game.render();
}

window.addEventListener('resize', handleViewportResize);
window.visualViewport?.addEventListener('resize', handleViewportResize);
window.visualViewport?.addEventListener('scroll', handleViewportResize);

// ─── 启动 ─────────────────────────────────────────────────────────────────
updateHomeStageScale();
updateMenuUI();
updateCatHomeUI();
