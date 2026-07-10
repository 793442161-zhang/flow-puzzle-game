const STORAGE_KEY = 'flow_puzzle_progress';
const SETTINGS_KEY = 'flow_puzzle_settings';
const TUTORIAL_KEY = 'flow_puzzle_tutorial_seen';

export type HomeBuildKind = 'furniture' | 'room';
export type LevelRewardKind = 'food' | 'coin' | 'gift';

export interface LevelReward {
  stars: number;
  catFood: number;
  coins: number;
  kind: LevelRewardKind;
}

export interface MilestoneUnlock {
  title: string;
  description: string;
  icon: string;
}

export interface CompleteLevelResult {
  progress: GameProgress;
  reward: LevelReward;
  firstCompletion: boolean;
}

export interface CatHomeState {
  satiety: number;
  affection: number;
}

export interface HomeState {
  roomLevel: number;
  ownedItems: string[];
  dailyRewardDate: string | null;
}

export interface HomeBuildItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  kind: HomeBuildKind;
  icon: string;
}

export interface HomeBuildItemState {
  isOwned: boolean;
  canAfford: boolean;
  missingCoins: number;
  statusLabel: string;
  sortPriority: number;
}

export interface HomeGoal {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  completed: boolean;
  actionable: boolean;
  accent: 'food' | 'build' | 'reward' | 'room';
}

export interface HomeActionTips {
  canFeed: boolean;
  canBuild: boolean;
  canClaimReward: boolean;
  hasAny: boolean;
}

export interface GameProgress {
  unlockedLevel: number; // 最高解锁关卡（从1开始）
  completedLevels: number[]; // 已完成的关卡id列表
  stars: number; // 总星星数（每关最多1颗）
  catFood: number;
  coins: number;
  cat: CatHomeState;
  home: HomeState;
}

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
}

export const HOME_BUILD_ITEMS: HomeBuildItem[] = [
  {
    id: 'soft-bed',
    name: '软软猫窝',
    description: '给小猫一个舒服的休息角落',
    cost: 120,
    kind: 'furniture',
    icon: '窝',
  },
  {
    id: 'sun-window',
    name: '阳光窗台',
    description: '小猫会更爱待在家里晒太阳',
    cost: 180,
    kind: 'furniture',
    icon: '窗',
  },
  {
    id: 'toy-rug',
    name: '玩具地毯',
    description: '增加一点活泼的家园气氛',
    cost: 240,
    kind: 'furniture',
    icon: '毯',
  },
  {
    id: 'room-plus',
    name: '扩建房间',
    description: '打开更多家园空间和摆放位',
    cost: 360,
    kind: 'room',
    icon: '房',
  },
];

const DEFAULT_PROGRESS: GameProgress = {
  unlockedLevel: 1,
  completedLevels: [],
  stars: 0,
  catFood: 20,
  coins: 80,
  cat: {
    satiety: 45,
    affection: 10,
  },
  home: {
    roomLevel: 1,
    ownedItems: [],
    dailyRewardDate: null,
  },
};

function normalizeProgress(raw: Partial<GameProgress> = {}): GameProgress {
  const cat = raw.cat ?? DEFAULT_PROGRESS.cat;
  const home = raw.home ?? DEFAULT_PROGRESS.home;

  return {
    unlockedLevel: Number.isFinite(raw.unlockedLevel) ? raw.unlockedLevel! : DEFAULT_PROGRESS.unlockedLevel,
    completedLevels: Array.isArray(raw.completedLevels) ? raw.completedLevels : [],
    stars: Number.isFinite(raw.stars) ? raw.stars! : DEFAULT_PROGRESS.stars,
    catFood: Number.isFinite(raw.catFood) ? raw.catFood! : DEFAULT_PROGRESS.catFood,
    coins: Number.isFinite(raw.coins) ? raw.coins! : DEFAULT_PROGRESS.coins,
    cat: {
      satiety: Number.isFinite(cat.satiety) ? cat.satiety : DEFAULT_PROGRESS.cat.satiety,
      affection: Number.isFinite(cat.affection) ? cat.affection : DEFAULT_PROGRESS.cat.affection,
    },
    home: {
      roomLevel: Number.isFinite(home.roomLevel) ? home.roomLevel : DEFAULT_PROGRESS.home.roomLevel,
      ownedItems: Array.isArray(home.ownedItems) ? home.ownedItems : [],
      dailyRewardDate: typeof home.dailyRewardDate === 'string' ? home.dailyRewardDate : null,
    },
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isHomeItemOwned(progress: GameProgress, item: HomeBuildItem): boolean {
  return item.kind === 'furniture'
    ? progress.home.ownedItems.includes(item.id)
    : progress.home.roomLevel >= 2;
}

export function getHomeBuildItemState(progress: GameProgress, item: HomeBuildItem): HomeBuildItemState {
  const isOwned = isHomeItemOwned(progress, item);
  const canAfford = progress.coins >= item.cost;
  const missingCoins = Math.max(0, item.cost - progress.coins);

  return {
    isOwned,
    canAfford,
    missingCoins,
    statusLabel: isOwned ? (item.kind === 'room' ? '已扩建' : '已拥有') : (canAfford ? '可建造' : `差 ${missingCoins}`),
    sortPriority: isOwned ? 3 : (canAfford ? 0 : 1),
  };
}

export function canClaimHomeReward(progress: GameProgress = loadProgress()): boolean {
  return progress.home.dailyRewardDate !== getTodayKey();
}

export function getHomeGoals(progress: GameProgress = loadProgress()): HomeGoal[] {
  const ownedFurnitureCount = HOME_BUILD_ITEMS.filter(item =>
    item.kind === 'furniture' && progress.home.ownedItems.includes(item.id)
  ).length;
  const affordableItems = HOME_BUILD_ITEMS.filter(item => {
    const state = getHomeBuildItemState(progress, item);
    return !state.isOwned && state.canAfford;
  });

  return [
    {
      id: 'daily-reward',
      title: '今日补给',
      description: canClaimHomeReward(progress) ? '领取猫粮和金币' : '明天再来领取',
      current: canClaimHomeReward(progress) ? 0 : 1,
      target: 1,
      completed: !canClaimHomeReward(progress),
      actionable: canClaimHomeReward(progress),
      accent: 'reward',
    },
    {
      id: 'feed-cat',
      title: '照顾小猫',
      description: progress.cat.satiety >= 80 ? '饱腹状态很好' : '把饱腹提升到 80%',
      current: Math.min(progress.cat.satiety, 80),
      target: 80,
      completed: progress.cat.satiety >= 80,
      actionable: progress.cat.satiety < 80 && progress.catFood >= 6,
      accent: 'food',
    },
    {
      id: 'build-furniture',
      title: '布置家园',
      description: ownedFurnitureCount >= 2 ? '家里更有样子了' : '建造 2 件家具',
      current: Math.min(ownedFurnitureCount, 2),
      target: 2,
      completed: ownedFurnitureCount >= 2,
      actionable: ownedFurnitureCount < 2 && affordableItems.some(item => item.kind === 'furniture'),
      accent: 'build',
    },
    {
      id: 'expand-room',
      title: '扩建空间',
      description: progress.home.roomLevel >= 2 ? '房间已经扩建' : '解锁更多摆放位',
      current: progress.home.roomLevel >= 2 ? 1 : 0,
      target: 1,
      completed: progress.home.roomLevel >= 2,
      actionable: progress.home.roomLevel < 2 && affordableItems.some(item => item.kind === 'room'),
      accent: 'room',
    },
  ];
}

export function getHomeActionTips(progress: GameProgress = loadProgress()): HomeActionTips {
  const canFeed = progress.cat.satiety < 80 && progress.catFood >= 6;
  const canBuild = HOME_BUILD_ITEMS.some(item => {
    const state = getHomeBuildItemState(progress, item);
    return !state.isOwned && state.canAfford;
  });
  const canClaimReward = canClaimHomeReward(progress);

  return {
    canFeed,
    canBuild,
    canClaimReward,
    hasAny: canFeed || canBuild || canClaimReward,
  };
}

export function getLevelReward(levelId: number): LevelReward {
  const kind = getLevelRewardKind(levelId);
  const milestoneBonus = levelId % 5 === 0 ? 8 : 0;
  const coinBias = kind === 'coin' ? 18 : 0;
  const foodBias = kind === 'food' ? 4 : 0;

  return {
    stars: 1,
    catFood: 8 + foodBias + Math.min(12, Math.floor(levelId / 3) * 2) + milestoneBonus,
    coins: 35 + coinBias + Math.min(55, Math.floor(levelId / 4) * 5) + milestoneBonus * 4,
    kind,
  };
}

export function getLevelRewardKind(levelId: number): LevelRewardKind {
  if (levelId % 5 === 0) return 'gift';
  if (levelId % 3 === 0) return 'coin';
  return 'food';
}

export function getMilestoneUnlock(levelId: number): MilestoneUnlock | null {
  if (levelId % 5 !== 0) return null;

  const unlocks: Record<number, MilestoneUnlock> = {
    5: {
      title: '软装图纸',
      description: '建造列表将继续扩展家具占位',
      icon: '图',
    },
    10: {
      title: '猫咪表情',
      description: '预留猫咪动作和表情替换位',
      icon: '喵',
    },
    15: {
      title: '窗台主题',
      description: '预留家园主题和背景替换位',
      icon: '窗',
    },
  };

  return unlocks[levelId] ?? {
    title: '阶段礼包',
    description: '预留长期收集奖励替换位',
    icon: '礼',
  };
}

export function loadProgress(): GameProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeProgress(JSON.parse(raw));
  } catch (_) {}
  return normalizeProgress();
}

export function saveProgress(progress: GameProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (_) {}
}

export function completeLevel(levelId: number): CompleteLevelResult {
  const progress = loadProgress();
  const reward = getLevelReward(levelId);
  const grantedReward: LevelReward = { stars: 0, catFood: 0, coins: 0, kind: reward.kind };
  const firstCompletion = !progress.completedLevels.includes(levelId);

  if (firstCompletion) {
    progress.completedLevels.push(levelId);
    progress.stars += reward.stars;
    progress.catFood += reward.catFood;
    progress.coins += reward.coins;
    grantedReward.stars = reward.stars;
    grantedReward.catFood = reward.catFood;
    grantedReward.coins = reward.coins;
  }

  if (levelId >= progress.unlockedLevel) {
    progress.unlockedLevel = levelId + 1;
  }

  saveProgress(progress);
  return {
    progress,
    reward: grantedReward,
    firstCompletion,
  };
}

export function grantAdRewardBonus(reward: LevelReward): GameProgress {
  const progress = loadProgress();
  progress.catFood += reward.catFood;
  progress.coins += reward.coins;
  saveProgress(progress);
  return progress;
}

export function resetProgress(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TUTORIAL_KEY);
}

export function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch (_) {
    return true;
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1');
  } catch (_) {}
}

export function feedCat(): { success: boolean; progress: GameProgress; message: string } {
  const progress = loadProgress();
  const foodCost = 6;

  if (progress.catFood < foodCost) {
    return { success: false, progress, message: '猫粮不足' };
  }

  progress.catFood -= foodCost;
  progress.cat.satiety = clamp(progress.cat.satiety + 22, 0, 100);
  progress.cat.affection = clamp(progress.cat.affection + 7, 0, 100);
  saveProgress(progress);

  return { success: true, progress, message: '小猫吃饱啦' };
}

export function purchaseHomeItem(itemId: string): { success: boolean; progress: GameProgress; message: string } {
  const progress = loadProgress();
  const item = HOME_BUILD_ITEMS.find(buildItem => buildItem.id === itemId);

  if (!item) {
    return { success: false, progress, message: '建造项目不存在' };
  }

  if (item.kind === 'furniture' && progress.home.ownedItems.includes(item.id)) {
    return { success: false, progress, message: '已经拥有这个家具' };
  }

  if (item.kind === 'room' && progress.home.roomLevel >= 2) {
    return { success: false, progress, message: '房间已经扩建完成' };
  }

  if (progress.coins < item.cost) {
    return { success: false, progress, message: '金币不足' };
  }

  progress.coins -= item.cost;

  if (item.kind === 'room') {
    progress.home.roomLevel += 1;
  } else {
    progress.home.ownedItems.push(item.id);
    progress.cat.affection = clamp(progress.cat.affection + 3, 0, 100);
  }

  saveProgress(progress);
  return { success: true, progress, message: `${item.name}已完成` };
}

export function claimHomeReward(): { success: boolean; progress: GameProgress; message: string } {
  const progress = loadProgress();
  const today = getTodayKey();

  if (progress.home.dailyRewardDate === today) {
    return { success: false, progress, message: '今日奖励已领取' };
  }

  progress.home.dailyRewardDate = today;
  progress.catFood += 12;
  progress.coins += 60;
  saveProgress(progress);

  return { success: true, progress, message: '领取了猫粮 +12、金币 +60' };
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { soundEnabled: true, musicEnabled: true, ...JSON.parse(raw) };
    }
  } catch (_) {}
  return { soundEnabled: true, musicEnabled: true };
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (_) {}
}
