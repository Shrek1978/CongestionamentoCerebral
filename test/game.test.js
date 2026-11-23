import test from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES } from '../src/difficulties.js';
import { CATALOG_SNAPSHOT, LEVELS } from '../src/levels.js';
import { EXIT, EXIT_ROW, SIZE, limits, minimumMoves, move, occupancy, signature } from '../src/rules.js';
import {
  applyMove, createProgress, drawExtra, isOpen, levelsIn, newRun, restoreProgress, serializeProgress,
  tierComplete, undo, won
} from '../src/progress.js';

test('toda fase é única, válida e tem o mínimo publicado na faixa da dificuldade', () => {
  const ids = new Set();
  const layouts = new Set();
  for (const tier of DIFFICULTIES) {
    const normal = levelsIn(tier.id, 'normal');
    const extra = levelsIn(tier.id, 'extra');
    const counts = normal.map(level => level.minimum);
    if (tier.sortByMinimum) assert.deepEqual(counts, counts.slice().sort((a, b) => a - b));
    if (counts.length) {
      for (const level of extra) {
        assert.ok(level.minimum >= Math.min(...counts) && level.minimum <= Math.max(...counts), level.id);
      }
    }
    for (const level of [...normal, ...extra]) {
      assert.ok(!ids.has(level.id), level.id);
      ids.add(level.id);
      const { pieces, initial, minimum } = level;
      const topology = signature(pieces, initial);
      assert.ok(!layouts.has(topology), level.id);
      layouts.add(topology);
      assert.deepEqual(pieces[0], { axis: 'h', lane: EXIT_ROW, length: 2, color: 'red', facing: 1 });
      assert.equal(pieces.length, initial.length);
      pieces.forEach((piece, index) => {
        assert.ok(['h', 'v'].includes(piece.axis));
        assert.ok([2, 3].includes(piece.length));
        assert.ok(piece.lane >= 0 && piece.lane < SIZE);
        assert.ok(initial[index] >= 0 && initial[index] + piece.length <= SIZE);
      });
      const grid = occupancy(pieces, initial);
      assert.equal(grid.filter(cell => cell !== -1).length, pieces.reduce((sum, piece) => sum + piece.length, 0));
      assert.equal(limits(pieces, initial, 0).canExit, false);
      assert.equal(minimumMoves(pieces, initial), minimum, level.id);
    }
  }
  assert.equal(ids.size, LEVELS.length);
});

test('colisão, deslocamento de várias casas e saída usam a mesma regra do resolvedor', () => {
  const pieces = [
    { axis: 'h', lane: EXIT_ROW, length: 2 },
    { axis: 'v', lane: 3, length: 2 },
    { axis: 'h', lane: 4, length: 3 }
  ];
  const initial = [0, 1, 3];
  assert.equal(move(pieces, initial, 0, 4), null);
  assert.equal(move(pieces, initial, 0, EXIT), null);
  assert.equal(move(pieces, initial, 2, EXIT), null);
  assert.equal(minimumMoves(pieces, initial), 2);
  const cleared = move(pieces, initial, 1, 0);
  assert.deepEqual(move(pieces, cleared, 0, EXIT), [EXIT, 0, 3]);
  assert.equal(move(pieces, [EXIT, 0, 3], 1, 1), null);
});

test('desfazer restaura posições mantendo o total; reiniciar abre tentativa com zero', { skip: !LEVELS.length }, () => {
  const level = LEVELS[0];
  const run = newRun(level);
  const index = level.pieces.findIndex((_, i) => {
    const { min, max } = limits(level.pieces, run.positions, i);
    return min < max;
  });
  const start = run.positions[index];
  const { min, max } = limits(level.pieces, run.positions, index);
  const destination = min === start ? max : min;
  assert.equal(applyMove(level, run, index, destination), true);
  const restored = JSON.parse(JSON.stringify(run));
  assert.equal(undo(restored), true);
  assert.deepEqual(restored.positions, level.initial);
  assert.equal(restored.moves, 1);
  assert.equal(applyMove(level, restored, index, destination), true);
  assert.equal(restored.moves, 2);
  assert.equal(newRun(level).moves, 0);
});

test('vitórias liberam a próxima fase e os extras apenas da dificuldade concluída', t => {
  const state = createProgress();
  const [first, second] = DIFFICULTIES;
  const normal = levelsIn(first.id, 'normal');
  const extra = levelsIn(first.id, 'extra');
  const next = levelsIn(second.id, 'normal')[0];
  if (normal.length < 3 || extra.length < 3 || !next || !levelsIn(second.id, 'extra').length) {
    t.skip('O catálogo não tem os grupos necessários para esta sequência.');
    return;
  }
  assert.equal(state.sequence, 'sequential');
  assert.equal(isOpen(state, normal[0]), true);
  assert.equal(isOpen(state, normal[1]), false);
  assert.equal(drawExtra(state, first.id), null);
  state.wins[normal[0].id] = true;
  assert.ok(isOpen(state, normal[1]));
  assert.ok(!isOpen(state, normal[2]));
  state.sequence = 'free';
  assert.ok(isOpen(state, normal.at(-1)));
  assert.ok(!isOpen(state, next));
  normal.forEach(level => { state.wins[level.id] = true; });
  assert.ok(tierComplete(state, first.id));
  assert.ok(isOpen(state, next));
  assert.ok(!isOpen(state, levelsIn(second.id, 'extra')[0]));
  assert.equal(drawExtra(state, first.id, () => 0), extra[0]);
  state.wins[extra[0].id] = true;
  assert.ok(won(state, extra[0]));
  assert.equal(drawExtra(state, first.id, () => 0), extra[1]);
  assert.equal(drawExtra(state, first.id, () => 0, extra[1].id), extra[2]);
  extra.forEach(level => { state.wins[level.id] = true; });
  assert.equal(drawExtra(state, first.id), null);
});

test('progresso depende da cópia exata do arquivo e preserva a preferência ao reiniciar', () => {
  const state = createProgress({ sequence: 'free', wins: { teste: true }, runs: { teste: { moves: 3 } }, celebrated: 'teste' });
  const saved = JSON.parse(serializeProgress(state));
  assert.equal(saved.catalogSnapshot, CATALOG_SNAPSHOT);
  assert.deepEqual(restoreProgress(saved), { state, catalogChanged: false });
  for (const different of [undefined, saved.catalogSnapshot + ' ']) {
    const restored = restoreProgress({ ...saved, catalogSnapshot: different });
    assert.equal(restored.catalogChanged, true);
    assert.deepEqual(restored.state, createProgress({ sequence: 'free' }));
  }
});
