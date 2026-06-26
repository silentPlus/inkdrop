/**
 * 关卡自动修复脚本
 * 
 * 两类问题：
 * 1. target_mismatch — 目标颜色不可达，修正为实际可达到的颜色
 * 2. empty_cells — 路径不可达，尝试移除障碍物直到可解
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tutorialLevels = JSON.parse(readFileSync(join(__dirname, '../src/levels/tutorial.json'), 'utf-8'));
const basicLevels = JSON.parse(readFileSync(join(__dirname, '../src/levels/basic.json'), 'utf-8'));
const generatedLevels = JSON.parse(readFileSync(join(__dirname, '../src/levels/generated.json'), 'utf-8'));

// --- Color mixing (mirror of ColorMixer.ts) ---
const PALETTE = {
  red:     { r: 239, g:  68, b:  71 },
  yellow:  { r: 245, g: 158, b:  11 },
  blue:    { r:  59, g: 130, b: 246 },
  green:   { r:  16, g: 185, b: 129 },
  magenta: { r: 236, g:  72, b: 153 },
};
const COLOR_HEX = {
  red: '#EF4444', yellow: '#F59E0B', blue: '#3B82F6', green: '#10B981',
  magenta: '#EC4899', orange: '#F97316', purple: '#8B5CF6', cyan: '#06B6D4',
  'yellow-green': '#84CC16', coral: '#FB7185', 'deep-purple': '#7C3AEA', 'gray-brown': '#78716C',
};
const COLOR_NAME_FROM_HEX = {};
for (const [n, h] of Object.entries(COLOR_HEX)) COLOR_NAME_FROM_HEX[h] = n;

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  return { r: parseInt(c.substring(0,2),16), g: parseInt(c.substring(2,4),16), b: parseInt(c.substring(4,6),16) };
}
function rgbToHex({r,g,b}) {
  return '#' + [r,g,b].map(v => Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
}
function rgbDist(a,b) { return Math.sqrt((a.r-b.r)**2+(a.g-b.g)**2+(a.b-b.b)**2); }
function resolveColor(s) {
  if (PALETTE[s]) return PALETTE[s];
  if (COLOR_HEX[s]) return hexToRgb(COLOR_HEX[s]);
  if (s.startsWith('#')) return hexToRgb(s);
  return PALETTE.red;
}
function findClosestColorName(rgb) {
  let best = 'gray-brown', bestDist = Infinity;
  for (const [name, prgb] of Object.entries(PALETTE)) {
    const d = rgbDist(rgb, prgb);
    if (d < bestDist) { bestDist = d; best = name; }
  }
  for (const [name, hex] of Object.entries(COLOR_HEX)) {
    const d = rgbDist(rgb, hexToRgb(hex));
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best;
}
function mixColorNames(a, b) {
  const ra = resolveColor(a), rb = resolveColor(b);
  const mixed = { r: (ra.r+rb.r)/2, g: (ra.g+rb.g)/2, b: (ra.b+rb.b)/2 };
  const name = findClosestColorName(mixed);
  return { hex: COLOR_HEX[name] || rgbToHex(mixed), name };
}

// --- Game simulation ---
const DIRS = [[-1,0],[1,0],[0,1],[0,-1]];

function simulate(level, order) {
  const rows = level.board.rows, cols = level.board.cols;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    cells[r] = [];
    for (let c = 0; c < cols; c++) cells[r][c] = { type: 0, color: null, sourceId: null };
  }
  for (const obs of level.obstacles || []) cells[obs.row][obs.col].type = 2;
  const sources = {};
  for (const src of level.sources) {
    cells[src.row][src.col] = { type: 3, color: src.color, sourceId: src.id };
    sources[src.id] = { ...src, activated: false };
  }

  for (const sourceId of order) {
    const src = sources[sourceId];
    if (!src || src.activated) continue;
    src.activated = true;
    cells[src.row][src.col].type = 1;

    const queue = [];
    const visited = new Set();
    for (const [dr, dc] of DIRS) {
      const nr = src.row + dr, nc = src.col + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        visited.add(`${nr},${nc}`);
        queue.push({ row: nr, col: nc, color: src.color });
      }
    }

    let stopped = false;
    while (queue.length > 0 && !stopped) {
      const { row, col, color } = queue.shift();
      const cell = cells[row][col];

      if (cell.type === 0) {
        cell.type = 1;
        cell.color = color;
        for (const [dr, dc] of DIRS) {
          const nr = row + dr, nc = col + dc;
          const key = `${nr},${nc}`;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited.has(key)) {
            visited.add(key);
            queue.push({ row: nr, col: nc, color });
          }
        }
      } else if (cell.type === 3 && cell.sourceId) {
        const targetSrc = sources[cell.sourceId];
        if (targetSrc && !targetSrc.activated) {
          const mixed = mixColorNames(color, targetSrc.color);
          targetSrc.color = mixed.hex;
          cell.color = mixed.hex;
          stopped = true;
        }
      }
    }
  }

  const allActivated = Object.values(sources).every(s => s.activated);
  if (!allActivated) return { complete: false, reason: 'not_all_activated', cells };

  let hasEmpty = false;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (cells[r][c].type === 0) hasEmpty = true;

  if (hasEmpty) return { complete: false, reason: 'empty_cells', cells };

  const mismatches = [];
  for (const t of (level.targets || [])) {
    if (cells[t.row][t.col].color !== t.color)
      mismatches.push({ row: t.row, col: t.col, expected: t.color, actual: cells[t.row][t.col].color });
  }
  if (mismatches.length > 0) return { complete: false, reason: 'target_mismatch', cells, mismatches };

  return { complete: true, cells };
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) result.push([arr[i], ...perm]);
  }
  return result;
}

// --- Fix logic ---

function findBestOrder(level) {
  /** Try all permutations, return the one that fills the most cells */
  const sourceIds = level.sources.map(s => s.id);
  const perms = permutations(sourceIds);
  let best = null;
  let bestFilled = -1;

  for (const order of perms) {
    const result = simulate(level, order);
    if (result.complete) return { order, result };

    // Count filled cells
    let filled = 0;
    if (result.cells) {
      for (const row of result.cells) for (const cell of row) if (cell.type !== 0) filled++;
    }
    if (filled > bestFilled) { bestFilled = filled; best = { order, result }; }
  }
  return best;
}

function fixLevel(level) {
  const sourceIds = level.sources.map(s => s.id);
  const perms = permutations(sourceIds);
  
  // 1. Check if already solvable
  for (const order of perms) {
    if (simulate(level, order).complete) return { fixed: false, level };
  }

  // 2. Try fixing: find the best order (fills all cells, maybe wrong targets)
  let bestOrder = null;
  let bestResult = null;
  for (const order of perms) {
    const result = simulate(level, order);
    if (result.reason === 'target_mismatch' && result.cells) {
      // All cells filled, just targets wrong
      bestOrder = order;
      bestResult = result;
      break;
    }
  }

  if (bestResult) {
    // Fix: update targets to match actual colors, update solution
    const newTargets = (level.targets || []).map(t => {
      const actual = bestResult.cells[t.row][t.col].color;
      const name = COLOR_NAME_FROM_HEX[actual] || 'unknown';
      return { row: t.row, col: t.col, color: actual, name };
    });
    return {
      fixed: true,
      level: { ...level, targets: newTargets, solution: bestOrder },
      fixType: 'target_color',
      oldTargets: level.targets,
      newTargets,
      newSolution: bestOrder,
    };
  }

  // 3. empty_cells: try removing obstacles one by one
  const obstacles = level.obstacles || [];
  for (let i = 0; i < obstacles.length; i++) {
    const newObstacles = obstacles.filter((_, idx) => idx !== i);
    const testLevel = { ...level, obstacles: newObstacles };
    
    // Check if removing this obstacle makes it solvable (all cells filled)
    for (const order of permutations(sourceIds)) {
      const result = simulate(testLevel, order);
      if (result.reason === 'target_mismatch') {
        // Cells filled now! Fix targets too.
        const newTargets = (level.targets || []).map(t => {
          const actual = result.cells[t.row][t.col].color;
          const name = COLOR_NAME_FROM_HEX[actual] || 'unknown';
          return { row: t.row, col: t.col, color: actual, name };
        });
        return {
          fixed: true,
          level: { ...testLevel, targets: newTargets, solution: order },
          fixType: 'remove_obstacle+target_color',
          removedObstacle: obstacles[i],
          newTargets,
          newSolution: order,
        };
      }
      if (result.complete) {
        return {
          fixed: true,
          level: { ...testLevel, solution: order },
          fixType: 'remove_obstacle',
          removedObstacle: obstacles[i],
          newSolution: order,
        };
      }
    }
  }

  // 4. Try removing 2 obstacles
  for (let i = 0; i < obstacles.length; i++) {
    for (let j = i + 1; j < obstacles.length; j++) {
      const newObstacles = obstacles.filter((_, idx) => idx !== i && idx !== j);
      const testLevel = { ...level, obstacles: newObstacles };
      for (const order of permutations(sourceIds)) {
        const result = simulate(testLevel, order);
        if (result.reason === 'target_mismatch') {
          const newTargets = (level.targets || []).map(t => {
            const actual = result.cells[t.row][t.col].color;
            const name = COLOR_NAME_FROM_HEX[actual] || 'unknown';
            return { row: t.row, col: t.col, color: actual, name };
          });
          return {
            fixed: true,
            level: { ...testLevel, targets: newTargets, solution: order },
            fixType: 'remove_2obstacles+target_color',
            removedObstacles: [obstacles[i], obstacles[j]],
            newTargets,
            newSolution: order,
          };
        }
        if (result.complete) {
          return {
            fixed: true,
            level: { ...testLevel, solution: order },
            fixType: 'remove_2obstacles',
            removedObstacles: [obstacles[i], obstacles[j]],
            newSolution: order,
          };
        }
      }
    }
  }

  return { fixed: false, level, reason: 'could_not_fix' };
}

// --- Run fixes ---
const allLevels = [...tutorialLevels, ...basicLevels, ...generatedLevels];
const fixes = [];

for (const level of allLevels) {
  const sourceIds = level.sources.map(s => s.id);
  const solvable = permutations(sourceIds).some(order => simulate(level, order).complete);
  if (!solvable) {
    const fix = fixLevel(level);
    if (fix.fixed) {
      fixes.push({
        id: level.id,
        name: level.name,
        fixType: fix.fixType,
        removedObstacle: fix.removedObstacle,
        removedObstacles: fix.removedObstacles,
        oldTargets: fix.oldTargets,
        newTargets: fix.newTargets,
        oldSolution: level.solution,
        newSolution: fix.newSolution,
      });
      
      // Apply fix to the right array
      const target = generatedLevels.find(l => l.id === level.id) || basicLevels.find(l => l.id === level.id) || tutorialLevels.find(l => l.id === level.id);
      if (target) {
        Object.assign(target, fix.level);
      }
    } else {
      fixes.push({ id: level.id, name: level.name, fixType: 'FAILED', reason: fix.reason });
    }
  }
}

// Write fixed generated.json
writeFileSync(join(__dirname, '../src/levels/generated.json'), JSON.stringify(generatedLevels, null, 2) + '\n', 'utf-8');

console.log(`\n=== Fix Report ===`);
console.log(`Fixed ${fixes.length} levels:\n`);
for (const f of fixes) {
  console.log(`${f.fixType === 'FAILED' ? '❌' : '✅'} ${f.id} "${f.name}" — ${f.fixType}`);
  if (f.removedObstacle) console.log(`   Removed obstacle: (${f.removedObstacle.row},${f.removedObstacle.col})`);
  if (f.removedObstacles) console.log(`   Removed obstacles: ${f.removedObstacles.map(o => `(${o.row},${o.col})`).join(', ')}`);
  if (f.oldTargets && f.newTargets) {
    for (let i = 0; i < f.newTargets.length; i++) {
      const old = f.oldTargets[i];
      const nw = f.newTargets[i];
      if (old.color !== nw.color) {
        console.log(`   Target (${nw.row},${nw.col}): ${old.color} → ${nw.color}`);
      }
    }
  }
  if (f.oldSolution && f.newSolution && JSON.stringify(f.oldSolution) !== JSON.stringify(f.newSolution)) {
    console.log(`   Solution: ${f.oldSolution.join('→')} → ${f.newSolution.join('→')}`);
  }
  console.log();
}

// Re-validate
console.log(`\n=== Re-validation ===`);
let stillBroken = 0;
for (const level of [...tutorialLevels, ...basicLevels, ...generatedLevels]) {
  const sourceIds = level.sources.map(s => s.id);
  const solvable = permutations(sourceIds).some(order => simulate(level, order).complete);
  if (!solvable) {
    stillBroken++;
    console.log(`❌ Still broken: ${level.id} "${level.name}"`);
  }
}
console.log(`\nStill broken: ${stillBroken}`);
