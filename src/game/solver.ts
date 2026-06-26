import type { LevelData } from '../data/levels';

/**
 * DFS 哈密顿路径求解器
 * 从起点出发，找到一条经过所有有效格子、最终到达终点的路径
 */
export function solvePuzzle(level: LevelData): [number, number][] | null {
  const { rows, cols, grid, start, end } = level;

  // 统计有效格子总数
  let totalCells = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 1) totalCells++;
    }
  }

  const visited: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false)
  );

  const path: [number, number][] = [];
  const directions: [number, number][] = [
    [-1, 0], // 上
    [1, 0],  // 下
    [0, -1], // 左
    [0, 1],  // 右
  ];

  function dfs(r: number, c: number): boolean {
    visited[r][c] = true;
    path.push([r, c]);

    // 到达终点
    if (r === end[0] && c === end[1]) {
      if (path.length === totalCells) {
        return true; // 填满了所有格子
      }
      // 还没填满，继续
      visited[r][c] = false;
      path.pop();
      return false;
    }

    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (
        nr >= 0 && nr < rows &&
        nc >= 0 && nc < cols &&
        grid[nr][nc] === 1 &&
        !visited[nr][nc]
      ) {
        if (dfs(nr, nc)) return true;
      }
    }

    visited[r][c] = false;
    path.pop();
    return false;
  }

  if (dfs(start[0], start[1])) {
    return path;
  }
  return null;
}

/**
 * 连通性剪枝检查：从某点出发，未访问的有效格子是否都连通（包含终点）
 * 用于加速DFS剪枝（可选优化）
 */
export function isConnected(
  r: number,
  c: number,
  rows: number,
  cols: number,
  grid: number[][],
  visited: boolean[][]
): boolean {
  let count = 0;
  const stack: [number, number][] = [[r, c]];
  const seen = new Set<string>();
  seen.add(`${r},${c}`);
  const directions: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];

  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!;
    count++;
    for (const [dr, dc] of directions) {
      const nr = cr + dr;
      const nc = cc + dc;
      const key = `${nr},${nc}`;
      if (
        nr >= 0 && nr < rows &&
        nc >= 0 && nc < cols &&
        grid[nr][nc] === 1 &&
        !visited[nr][nc] &&
        !seen.has(key)
      ) {
        seen.add(key);
        stack.push([nr, nc]);
      }
    }
  }

  // 计算所有未访问的有效格子数
  let total = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (grid[i][j] === 1 && !visited[i][j]) total++;
    }
  }

  return count === total;
}
