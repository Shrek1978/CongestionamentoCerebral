import { createHash } from 'node:crypto';
import { DIFFICULTIES } from '../src/difficulties.js';
import { MODES, decodeCatalog, encodeLevel, normalRange } from '../src/catalog.js';
import { SIZE, TARGET, EXIT_ROW, limits, neighbors, signature, occupancy } from '../src/rules.js';
import { couldMatchReference } from './reference-check.mjs';
import { readCatalog, solveEntry, writeCatalog } from './catalog-file.mjs';

const catalog = await readCatalog();
const existing = decodeCatalog(catalog);
const target = { axis: 'h', lane: EXIT_ROW, length: 2 };
const palette = ['mint', 'sun', 'blue', 'lavender', 'coral', 'teal', 'orchid', 'lime', 'sand', 'sky', 'amber'];
const topology = pieces => pieces.slice(1).map(({ axis, lane, length }) =>
  `${axis}${lane}${length}`
).sort().join(':');
const seen = new Set(existing.map(level => topology(level.pieces)));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function shuffled(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const placements = [];
{
  for (const axis of ['h', 'v']) {
    for (const length of [2, 3]) {
      for (let lane = 0; lane < SIZE; lane++) {
        if (axis === 'h' && lane === EXIT_ROW) continue;
        for (let start = 0; start + length <= SIZE; start++) {
          const cells = Array.from({ length }, (_, step) =>
            axis === 'h' ? lane * SIZE + start + step : (start + step) * SIZE + lane
          );
          placements.push({ axis, lane, length, start, cells });
        }
      }
    }
  }
}

function buildSeed(tier, random) {
  const [from, to] = tier.others;
  const count = from + Math.floor(random() * (to - from + 1));
  const pieces = [target];
  const positions = [SIZE - target.length];
  const occupied = new Set([EXIT_ROW * SIZE + 4, EXIT_ROW * SIZE + 5]);
  const trucks = 1 + Math.floor(random() * (from < 7 ? 2 : 4));
  for (const length of [3, 2]) {
    const goal = length === 3 ? trucks + 1 : count + 1;
    for (const next of shuffled(placements.filter(piece => piece.length === length), random)) {
      if (pieces.length === goal) break;
      if (next.cells.some(cell => occupied.has(cell))) continue;
      pieces.push({ axis: next.axis, lane: next.lane, length });
      positions.push(next.start);
      next.cells.forEach(cell => occupied.add(cell));
    }
  }
  return pieces.length === count + 1 ? { pieces, positions } : null;
}

function mutate({ pieces: source, positions: starts }, random) {
  const pieces = [...source];
  const positions = [...starts];
  const index = 1 + Math.floor(random() * (source.length - 1));
  pieces.splice(index, 1);
  positions.splice(index, 1);
  const cells = occupancy(pieces, positions);
  const legal = placements.filter(next => next.cells.every(cell => cells[cell] === -1) &&
    (next.axis !== source[index].axis || next.lane !== source[index].lane || next.length !== source[index].length)
  );
  if (!legal.length) return null;
  const { axis, lane, length, start } = legal[Math.floor(random() * legal.length)];
  pieces.push({ axis, lane, length });
  positions.push(start);
  return { pieces, positions };
}

function measureComponent(pieces, initial) {
  const key = positions => positions.join('');
  const reachable = [initial];
  const seen = new Set([key(initial)]);
  const winning = [];
  for (let i = 0; i < reachable.length; i++) {
    if (reachable.length > 16000) return null;
    const positions = reachable[i];
    if (limits(pieces, positions, TARGET).canExit) winning.push(positions);
    neighbors(pieces, positions, next => {
      const code = key(next);
      if (seen.has(code)) return;
      seen.add(code);
      reachable.push(next);
    });
  }

  const depth = new Map(winning.map(state => [key(state), 1]));
  for (let i = 0; i < winning.length; i++) {
    const distance = depth.get(key(winning[i]));
    neighbors(pieces, winning[i], next => {
      const code = key(next);
      if (depth.has(code)) return;
      depth.set(code, distance + 1);
      winning.push(next);
    });
  }
  return { reachable, depth };
}

function selectLevels(tier, count, taken, { from, to }, stock = []) {
  if (!count) return [];
  if (from > to) throw new Error(`Faixa inválida para ${tier.name}: ${from}–${to}`);
  const random = rng(23281 + 26317 * (DIFFICULTIES.indexOf(tier) + 1));
  const selected = [];
  const parents = [];
  const explored = new Set();

  function rememberParent(pieces, { reachable, depth }) {
    const score = reachable.reduce((best, state) => Math.max(best, depth.get(state.join(''))), 0);
    const exits = reachable.filter(state => state[TARGET] === SIZE - target.length);
    if (!exits.length) return;
    parents.push({ pieces, positions: exits[Math.floor(random() * exits.length)], score });
    parents.sort((a, b) => b.score - a.score);
    if (parents.length > 24) parents.pop();
  }

  for (const level of [...stock].sort((a, b) => b.minimum - a.minimum).slice(0, 10)) {
    const measured = measureComponent(level.pieces, level.initial);
    if (measured) rememberParent(level.pieces, measured);
  }

  for (let attempt = 0; attempt < 30000 && selected.length < count; attempt++) {
    const parent = parents.length && random() < .8 ? parents[Math.floor(random() * parents.length)] : null;
    const seed = parent ? mutate(parent, random) : buildSeed(tier, random);
    if (!seed) continue;
    const { pieces, positions } = seed;
    const track = topology(pieces);
    if (seen.has(track) || explored.has(track)) continue;
    explored.add(track);
    const measured = measureComponent(pieces, positions);
    if (!measured) continue;
    const { reachable, depth } = measured;
    if (tier.from >= 13) rememberParent(pieces, measured);
    const sequence = taken + selected.length;
    const preferred = from + (sequence % Math.min(to - from + 1, 7));
    const possible = reachable.filter(state => {
      const minimum = depth.get(state.join(''));
      return state[0] <= 3 && minimum >= from && minimum <= to &&
        !couldMatchReference(pieces, state);
    });
    if (!possible.length) continue;
    const states = shuffled(possible, random).sort((a, b) =>
      Math.abs(preferred - depth.get(a.join(''))) - Math.abs(preferred - depth.get(b.join('')))
    );
    if (Math.abs(preferred - depth.get(states[0].join(''))) > 2 &&
        attempt < 70 && tier.id !== 'especialista') continue;
    const chosen = states[0];
    seen.add(track);
    const hash = createHash('sha256').update(signature(pieces, chosen)).digest('hex').slice(0, 12);
    const painted = pieces.map((piece, index) => ({
      ...piece,
      color: index === TARGET ? 'red' : palette[(index - 1 + sequence) % palette.length],
      facing: index === TARGET || random() < 0.5 ? 1 : -1
    }));
    selected.push({
      id: `${tier.id}-${hash}`,
      tier: tier.id,
      minimum: depth.get(chosen.join('')),
      pieces: painted,
      initial: chosen
    });
    if (process.env.LEVELS_VERBOSE) console.log(`${tier.name} ${selected.length}/${count}: ${depth.get(chosen.join(''))} em ${attempt + 1} tentativas`);
  }
  if (selected.length !== count) throw new Error(`Estoque insuficiente para ${tier.name}: ${selected.length}/${count}`);
  return selected;
}

const args = process.argv.slice(2);
if (args.length) {
  const [id, mode, quantity] = args;
  const tier = DIFFICULTIES.find(item => item.id === id);
  const count = Number(quantity);
  if (!tier || !MODES.includes(mode) || !Number.isSafeInteger(count) || count < 1 || args.length !== 3) {
    throw new Error('Uso: npm run generate -- DIFICULDADE normal|extra QUANTIDADE');
  }
  const stock = existing.filter(level => level.tier === id);
  const normal = stock.filter(level => level.mode === 'normal');
  const range = mode === 'extra' ? normalRange(normal) ?? tier : tier;
  const generated = selectLevels(tier, count, stock.length, range, stock)
    .map(level => ({ ...level, mode }));
  catalog.difficulties[id][mode].push(...generated.map(level => encodeLevel(level, solveEntry(level))));
  decodeCatalog(catalog);
  await writeCatalog(catalog);
}

for (const tier of DIFFICULTIES) {
  const group = catalog.difficulties[tier.id];
  console.log(`${tier.name}: ${group.normal.length} normais e ${group.extra.length} extras.`);
}
