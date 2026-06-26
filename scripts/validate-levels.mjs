/**
 * 关卡可解性验证脚本
 * 模拟所有可能的源点激活顺序，检查是否存在至少一种顺序能通关
 */
import { readFileSync } from 'fs';
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
  // Build board
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

  function getSourceById(id) { return sources[id]; }

  for (const sourceId of order) {
    const src = sources[sourceId];
    if (!src || src.activated) continue;
    src.activated = true;
    cells[src.row][src.col].type = 1; // Filled

    // BFS flood
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

      if (cell.type === 0) { // Empty
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
      } else if (cell.type === 3 && cell.sourceId) { // Source
        const targetSrc = getSourceById(cell.sourceId);
        if (targetSrc && !targetSrc.activated) {
          const mixed = mixColorNames(color, targetSrc.color);
          targetSrc.color = mixed.hex;
          cell.color = mixed.hex;
          stopped = true; // BFS stops
        }
      }
      // Obstacle (2), Filled (1), activated source → skip
    }
  }

  // Check completion
  const allActivated = Object.values(sources).every(s => s.activated);
  if (!allActivated) return { complete: false, reason: 'not_all_activated' };

  let hasEmpty = false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells[r][c].type === 0) { hasEmpty = true; break; }
    }
    if (hasEmpty) break;
  }
  if (hasEmpty) return { complete: false, reason: 'empty_cells' };

  const mismatches = [];
  for (const t of (level.targets || [])) {
    if (cells[t.row][t.col].color !== t.color) {
      mismatches.push({ row: t.row, col: t.col, expected: t.color, actual: cells[t.row][t.col].color });
    }
  }
  if (mismatches.length > 0) return { complete: false, reason: 'target_mismatch', mismatches };

  return { complete: true };
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

// --- Validate all levels ---
const allLevels = [...tutorialLevels, ...basicLevels, ...generatedLevels];
const broken = [];

for (const level of allLevels) {
  const sourceIds = level.sources.map(s => s.id);
  const perms = permutations(sourceIds);
  let solvable = false;
  let lastResult = null;

  for (const order of perms) {
    const result = simulate(level, order);
    lastResult = result;
    if (result.complete) {
      solvable = true;
      break;
    }
  }

  if (!solvable) {
    broken.push({
      id: level.id,
      name: level.name,
      reason: lastResult?.reason,
      mismatches: lastResult?.mismatches,
      sources: level.sources.map(s => `${s.id}:${s.name}`),
      targets: level.targets?.map(t => `${t.color}:${t.name}`),
      solution: level.solution,
    });
  }
}

console.log(`\n=== Level Validation Report ===`);
console.log(`Total levels: ${allLevels.length}`);
console.log(`Broken levels: ${broken.length}\n`);

for (const b of broken) {
  console.log(`❌ ${b.id} "${b.name}"`);
  console.log(`   Sources: ${b.sources.join(', ')}`);
  console.log(`   Targets: ${b.targets?.join(', ')}`);
  console.log(`   Solution: ${b.solution?.join(' → ')}`);
  console.log(`   Failure: ${b.reason}`);
  if (b.mismatches) {
    for (const m of b.mismatches) {
      console.log(`   Target (${m.row},${m.col}): expected=${m.expected}, actual=${m.actual}`);
    }
  }
  console.log();
}
