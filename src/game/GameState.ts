import type { LevelData } from '../data/levels';

export type Direction = 'up' | 'down' | 'left' | 'right' | null;

export interface PathCell {
  row: number;
  col: number;
}

export class GameState {
  private level: LevelData;
  private path: PathCell[] = [];
  private visitedSet: Set<string> = new Set();
  private _isDragging = false;
  private _isComplete = false;

  constructor(level: LevelData) {
    this.level = level;
  }

  get currentLevel(): LevelData {
    return this.level;
  }

  get pathCells(): PathCell[] {
    return this.path;
  }

  get isDragging(): boolean {
    return this._isDragging;
  }

  get isComplete(): boolean {
    return this._isComplete;
  }

  /** 判断格子是否有效 */
  isValidCell(row: number, col: number): boolean {
    const { rows, cols, grid } = this.level;
    return (
      row >= 0 && row < rows &&
      col >= 0 && col < cols &&
      grid[row][col] === 1
    );
  }

  /** 格子是否已在路径中 */
  isInPath(row: number, col: number): boolean {
    return this.visitedSet.has(`${row},${col}`);
  }

  /** 开始拖拽，必须从起点开始 */
  startDrag(row: number, col: number): boolean {
    const [sr, sc] = this.level.start;
    if (row !== sr || col !== sc) return false;
    this.path = [{ row, col }];
    this.visitedSet = new Set([`${row},${col}`]);
    this._isDragging = true;
    this._isComplete = false;
    return true;
  }

  /** 
   * 移动到相邻格子
   * 返回 'extend' | 'backtrack' | 'invalid'
   */
  moveTo(row: number, col: number): 'extend' | 'backtrack' | 'invalid' {
    if (!this._isDragging || this.path.length === 0) return 'invalid';
    if (!this.isValidCell(row, col)) return 'invalid';

    const head = this.path[this.path.length - 1];

    // 必须是相邻格子
    const dr = Math.abs(row - head.row);
    const dc = Math.abs(col - head.col);
    if (dr + dc !== 1) return 'invalid';

    // 回溯：新位置是路径倒数第二个格子
    if (this.path.length >= 2) {
      const prev = this.path[this.path.length - 2];
      if (prev.row === row && prev.col === col) {
        // 撤销最后一步
        const removed = this.path.pop()!;
        this.visitedSet.delete(`${removed.row},${removed.col}`);
        return 'backtrack';
      }
    }

    // 已访问过且不是回溯
    if (this.isInPath(row, col)) return 'invalid';

    // 正常扩展
    this.path.push({ row, col });
    this.visitedSet.add(`${row},${col}`);

    // 检查是否过关
    this._isComplete = this.checkComplete();
    return 'extend';
  }

  /** 结束拖拽 */
  endDrag(): void {
    this._isDragging = false;
  }

  /** 重置 */
  reset(): void {
    this.path = [];
    this.visitedSet = new Set();
    this._isDragging = false;
    this._isComplete = false;
  }

  /** 检查胜利：路径覆盖所有有效格子且最后一格是终点 */
  private checkComplete(): boolean {
    const { rows, cols, grid, end } = this.level;
    if (this.path.length === 0) return false;

    const last = this.path[this.path.length - 1];
    if (last.row !== end[0] || last.col !== end[1]) return false;

    let totalCells = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === 1) totalCells++;
      }
    }

    return this.path.length === totalCells;
  }

  /** 获取路径中某个格子的方向信息（用于绘制圆角） */
  getSegmentDirections(index: number): { from: Direction; to: Direction } {
    const prev = index > 0 ? this.path[index - 1] : null;
    const curr = this.path[index];
    const next = index < this.path.length - 1 ? this.path[index + 1] : null;

    const from: Direction = prev ? this.getDir(prev, curr) : null;
    const to: Direction = next ? this.getDir(curr, next) : null;

    return { from, to };
  }

  private getDir(from: PathCell, to: PathCell): Direction {
    if (to.row < from.row) return 'up';
    if (to.row > from.row) return 'down';
    if (to.col < from.col) return 'left';
    if (to.col > from.col) return 'right';
    return null;
  }

  /** 应用提示路径 */
  applyHint(hintPath: [number, number][]): void {
    this.path = hintPath.map(([row, col]) => ({ row, col }));
    this.visitedSet = new Set(hintPath.map(([r, c]) => `${r},${c}`));
    this._isDragging = false;
    this._isComplete = this.checkComplete();
  }

  /** 获取有效格子总数 */
  getTotalCells(): number {
    const { rows, cols, grid } = this.level;
    let count = 0;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (grid[r][c] === 1) count++;
    return count;
  }
}
