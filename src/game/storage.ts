const STORAGE_KEY = 'flow_puzzle_progress';

export interface GameProgress {
  unlockedLevel: number; // 最高解锁关卡（从1开始）
  completedLevels: number[]; // 已完成的关卡id列表
  stars: number; // 总星星数（每关最多1颗）
}

export function loadProgress(): GameProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { unlockedLevel: 1, completedLevels: [], stars: 0 };
}

export function saveProgress(progress: GameProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (_) {}
}

export function completeLevel(levelId: number): GameProgress {
  const progress = loadProgress();
  if (!progress.completedLevels.includes(levelId)) {
    progress.completedLevels.push(levelId);
    progress.stars += 1;
  }
  if (levelId >= progress.unlockedLevel) {
    progress.unlockedLevel = levelId + 1;
  }
  saveProgress(progress);
  return progress;
}

export function resetProgress(): void {
  localStorage.removeItem(STORAGE_KEY);
}
