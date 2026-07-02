#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const levelsPath = path.resolve(process.cwd(), 'src/data/levels.ts');
const source = fs.readFileSync(levelsPath, 'utf8');
const levels = readLevels(source);
const rows = [];
const errors = [];

for (const level of levels) {
  const validationErrors = validateLevelShape(level);
  errors.push(...validationErrors.map(message => `Level ${level.id}: ${message}`));

  if (validationErrors.length > 0) {
    continue;
  }

  const solution = countSolutions(level, 5);
  if (solution.count === 0) {
    errors.push(`Level ${level.id}: 无解`);
  }

  rows.push(buildReportRow(level, solution));
}

printReport(rows);

if (errors.length > 0) {
  console.error('\n发现问题：');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`\n已校验 ${levels.length} 关，全部可解。`);

function readLevels(fileSource) {
  const marker = 'export const LEVELS';
  const markerIndex = fileSource.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error('没有找到 export const LEVELS');
  }

  const equalsIndex = fileSource.indexOf('=', markerIndex);
  const arrayStart = fileSource.indexOf('[', equalsIndex);
  const arrayEnd = findMatchingBracket(fileSource, arrayStart);
  const arrayText = fileSource.slice(arrayStart, arrayEnd + 1);

  return Function(`"use strict"; return (${arrayText});`)();
}

function findMatchingBracket(text, startIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      lineComment = true;
      i++;
      continue;
    }

    if (char === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '[') depth++;
    if (char === ']') depth--;
    if (depth === 0) return i;
  }

  throw new Error('LEVELS 数组括号没有闭合');
}

function validateLevelShape(level) {
  const issues = [];
  if (!Number.isInteger(level.id)) issues.push('id 不是整数');
  if (!Number.isInteger(level.rows) || !Number.isInteger(level.cols)) issues.push('rows/cols 不是整数');
  if (!Array.isArray(level.grid) || level.grid.length !== level.rows) issues.push('grid 行数不匹配');

  if (Array.isArray(level.grid)) {
    level.grid.forEach((row, rowIndex) => {
      if (!Array.isArray(row) || row.length !== level.cols) {
        issues.push(`第 ${rowIndex} 行列数不匹配`);
      }
      if (Array.isArray(row) && row.some(cell => cell !== 0 && cell !== 1)) {
        issues.push(`第 ${rowIndex} 行包含非 0/1 格子`);
      }
    });
  }

  if (!isValidCell(level, level.start?.[0], level.start?.[1])) issues.push('起点不是有效格子');
  if (!isValidCell(level, level.end?.[0], level.end?.[1])) issues.push('终点不是有效格子');

  return issues;
}

function buildReportRow(level, solution) {
  const validCells = countValidCells(level);
  const obstacles = level.rows * level.cols - validCells;
  const branchCells = countBranchCells(level);
  const turns = solution.firstPath ? countTurns(solution.firstPath) : 0;
  const solvedText = solution.count >= 5 ? '5+' : `${solution.count}`;

  return {
    id: level.id,
    title: level.title,
    rank: level.rankLabel ?? '-',
    tempo: level.tempo ?? '-',
    size: `${level.rows}x${level.cols}`,
    validCells,
    obstacles,
    branchCells,
    turns,
    solutions: solvedText,
    difficulty: level.difficulty ?? '-',
  };
}

function printReport(reportRows) {
  console.log('| 关卡 | 名称 | 段位 | 节奏 | 尺寸 | 有效格 | 空洞 | 分岔 | 转弯 | 解法 | 标注难度 |');
  console.log('|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of reportRows) {
    console.log(
      `| ${row.id} | ${row.title} | ${row.rank} | ${row.tempo} | ${row.size} | ${row.validCells} | ${row.obstacles} | ${row.branchCells} | ${row.turns} | ${row.solutions} | ${row.difficulty} |`,
    );
  }
}

function countSolutions(level, cap) {
  const totalCells = countValidCells(level);
  const visited = new Set();
  const path = [];
  let count = 0;
  let firstPath = null;

  dfs(level.start[0], level.start[1]);
  return { count, firstPath };

  function dfs(row, col) {
    if (count >= cap) return;

    visited.add(cellKey(row, col));
    path.push([row, col]);

    if (row === level.end[0] && col === level.end[1]) {
      if (path.length === totalCells) {
        count++;
        firstPath ??= path.map(cell => [...cell]);
      }
      visited.delete(cellKey(row, col));
      path.pop();
      return;
    }

    if (path.length < totalCells && isRemainingAreaConnected(level, visited)) {
      const nextCells = getUnvisitedNeighbors(level, row, col, visited)
        .sort((a, b) => getUnvisitedNeighbors(level, a[0], a[1], visited).length - getUnvisitedNeighbors(level, b[0], b[1], visited).length);

      for (const [nextRow, nextCol] of nextCells) {
        dfs(nextRow, nextCol);
      }
    }

    visited.delete(cellKey(row, col));
    path.pop();
  }
}

function countValidCells(level) {
  let count = 0;
  for (let row = 0; row < level.rows; row++) {
    for (let col = 0; col < level.cols; col++) {
      if (level.grid[row][col] === 1) count++;
    }
  }
  return count;
}

function countBranchCells(level) {
  let count = 0;
  for (let row = 0; row < level.rows; row++) {
    for (let col = 0; col < level.cols; col++) {
      if (level.grid[row][col] !== 1) continue;
      if (getValidNeighbors(level, row, col).length >= 3) count++;
    }
  }
  return count;
}

function countTurns(pathCells) {
  let turns = 0;
  for (let i = 1; i < pathCells.length - 1; i++) {
    const [prevRow, prevCol] = pathCells[i - 1];
    const [row, col] = pathCells[i];
    const [nextRow, nextCol] = pathCells[i + 1];
    const inDir = [row - prevRow, col - prevCol].join(',');
    const outDir = [nextRow - row, nextCol - col].join(',');
    if (inDir !== outDir) turns++;
  }
  return turns;
}

function isRemainingAreaConnected(level, visited) {
  let first = null;
  let total = 0;

  for (let row = 0; row < level.rows; row++) {
    for (let col = 0; col < level.cols; col++) {
      if (level.grid[row][col] === 1 && !visited.has(cellKey(row, col))) {
        first ??= [row, col];
        total++;
      }
    }
  }

  if (total === 0) return true;

  const seen = new Set([cellKey(first[0], first[1])]);
  const stack = [first];

  while (stack.length > 0) {
    const [row, col] = stack.pop();
    for (const [nextRow, nextCol] of getUnvisitedNeighbors(level, row, col, visited)) {
      const key = cellKey(nextRow, nextCol);
      if (seen.has(key)) continue;
      seen.add(key);
      stack.push([nextRow, nextCol]);
    }
  }

  return seen.size === total;
}

function getValidNeighbors(level, row, col) {
  return DIRECTIONS
    .map(([dr, dc]) => [row + dr, col + dc])
    .filter(([nextRow, nextCol]) => isValidCell(level, nextRow, nextCol));
}

function getUnvisitedNeighbors(level, row, col, visited) {
  return getValidNeighbors(level, row, col)
    .filter(([nextRow, nextCol]) => !visited.has(cellKey(nextRow, nextCol)));
}

function isValidCell(level, row, col) {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row < level.rows &&
    col >= 0 &&
    col < level.cols &&
    level.grid[row]?.[col] === 1
  );
}

function cellKey(row, col) {
  return `${row},${col}`;
}
