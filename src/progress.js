import { DIFFICULTIES } from './difficulties.js';
import { CATALOG_SNAPSHOT, LEVELS } from './levels.js';
import { EXIT, move } from './rules.js';

export const STORAGE_KEY = 'saida-livre/progress';
export const levelsById = new Map(LEVELS.map(level => [level.id, level]));
export function levelsIn(tier, mode) {
  const group = LEVELS.filter(level => level.tier === tier && level.mode === mode);
  if (mode === 'normal' && DIFFICULTIES.find(item => item.id === tier)?.sortByMinimum) {
    group.sort((a, b) => a.minimum - b.minimum);
  }
  return group;
}
export const extras = LEVELS.filter(level => level.mode === 'extra');
export const celebrationKey = extras.map(level => level.id).sort().join(',');
const firstLevel = DIFFICULTIES.map(({ id }) => levelsIn(id, 'normal')[0]).find(Boolean) ?? LEVELS[0];

export function newRun(level) {
  return { positions: [...level.initial], history: [], moves: 0 };
}

export function createProgress(saved = {}) {
  return {
    version: 1,
    sequence: saved.sequence === 'free' ? 'free' : 'sequential',
    wins: saved.wins ?? {},
    runs: saved.runs ?? {},
    active: levelsById.has(saved.active) ? saved.active : firstLevel?.id ?? null,
    celebrated: saved.celebrated ?? ''
  };
}

export function restoreProgress(saved) {
  const matches = saved?.catalogSnapshot === CATALOG_SNAPSHOT;
  return {
    state: createProgress(matches ? saved : { sequence: saved?.sequence }),
    catalogChanged: Boolean(saved) && !matches
  };
}

export function serializeProgress(state) {
  return JSON.stringify({ ...state, catalogSnapshot: CATALOG_SNAPSHOT });
}

export const won = (state, level) => Object.hasOwn(state.wins, level.id);
export const tierComplete = (state, tier) => levelsIn(tier, 'normal').every(level => won(state, level));

export function tierOpen(state, tier) {
  const index = DIFFICULTIES.findIndex(item => item.id === tier);
  return index >= 0 && DIFFICULTIES.slice(0, index).every(item => tierComplete(state, item.id));
}

export function isOpen(state, level) {
  if (won(state, level)) return true;
  if (!tierOpen(state, level.tier)) return false;
  if (level.mode === 'extra') return tierComplete(state, level.tier);
  if (state.sequence === 'free') return true;
  const group = levelsIn(level.tier, 'normal');
  return group.slice(0, group.indexOf(level)).every(previous => won(state, previous));
}

export function drawExtra(state, tier, random = Math.random, except = null) {
  if (!tierOpen(state, tier) || !tierComplete(state, tier)) return null;
  const pending = levelsIn(tier, 'extra').filter(level => !won(state, level));
  const alternatives = pending.filter(level => level.id !== except);
  const pool = alternatives.length ? alternatives : pending;
  return pool[Math.floor(random() * pool.length)] ?? null;
}

export function applyMove(level, run, index, destination) {
  const positions = move(level.pieces, run.positions, index, destination);
  if (!positions) return false;
  run.history.push(run.positions);
  run.positions = positions;
  run.moves++;
  return true;
}

export function undo(run) {
  if (!run.history.length || run.positions[0] === EXIT) return false;
  run.positions = run.history.pop();
  return true;
}
