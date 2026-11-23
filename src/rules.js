export const SIZE = 6;
export const EXIT_ROW = 2;
export const TARGET = 0;
export const EXIT = SIZE;

export function occupancy(pieces, positions) {
  const cells = new Int8Array(SIZE * SIZE).fill(-1);

  pieces.forEach(({ axis, lane, length }, index) => {
    const start = positions[index];
    if (index === TARGET && start === EXIT) return;
    for (let step = 0; step < length; step++) {
      const offset = start + step;
      cells[axis === 'h' ? lane * SIZE + offset : offset * SIZE + lane] = index;
    }
  });

  return cells;
}

export function limits(pieces, positions, index, cells = occupancy(pieces, positions)) {
  const { axis, lane, length } = pieces[index];
  let min = positions[index];
  let max = min;
  const at = offset => cells[axis === 'h' ? lane * SIZE + offset : offset * SIZE + lane];

  while (min > 0 && at(min - 1) === -1) min--;
  while (max + length < SIZE && at(max + length) === -1) max++;

  return { min, max, canExit: index === TARGET && max + length === SIZE };
}

export function move(pieces, positions, index, destination) {
  if (positions[TARGET] === EXIT || !pieces[index] || !Number.isInteger(destination)) return null;
  const { min, max, canExit } = limits(pieces, positions, index);
  const legal = destination === EXIT ? canExit : destination >= min && destination <= max;
  if (!legal || destination === positions[index]) return null;
  const next = positions.slice();
  next[index] = destination;
  return next;
}

export function neighbors(pieces, positions, visit) {
  const cells = occupancy(pieces, positions);
  pieces.forEach((piece, index) => {
    const { min, max } = limits(pieces, positions, index, cells);
    for (let destination = min; destination <= max; destination++) {
      if (destination === positions[index]) continue;
      const next = positions.slice();
      next[index] = destination;
      visit(next);
    }
  });
}

export function shortestSolution(pieces, positions) {
  if (positions[TARGET] === EXIT) return [];
  const queue = [positions];
  const seen = new Set([positions.join('')]);
  const previous = [-1];

  for (let index = 0; index < queue.length; index++) {
    const state = queue[index];
    if (limits(pieces, state, TARGET).canExit) {
      const steps = [{ index: TARGET, destination: EXIT }];
      for (let child = index; previous[child] !== -1; child = previous[child]) {
        const from = queue[previous[child]];
        const to = queue[child];
        const index = to.findIndex((position, piece) => position !== from[piece]);
        steps.push({ index, destination: to[index] });
      }
      return steps.reverse();
    }
    neighbors(pieces, state, next => {
      const key = next.join('');
      if (seen.has(key)) return;
      seen.add(key);
      queue.push(next);
      previous.push(index);
    });
  }

  return null;
}

export function minimumMoves(pieces, positions) {
  return shortestSolution(pieces, positions)?.length ?? null;
}

export function signature(pieces, positions) {
  const blocks = pieces.slice(1).map(({ axis, lane, length }, index) =>
    `${axis}${lane}${positions[index + 1]}${length}`
  ).sort();
  return [positions[TARGET], ...blocks].join(':');
}
