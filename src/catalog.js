import { DIFFICULTIES } from './difficulties.js';
import { VEHICLE_COLORS } from './vehicle-colors.js';
import { EXIT, EXIT_ROW, SIZE, TARGET, limits, move, occupancy, signature } from './rules.js';

export const MODES = ['normal', 'extra'];
const validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value);
const cell = value => Number.isInteger(value) && value >= 1 && value <= SIZE;

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function catalogEntries(catalog) {
  const groups = catalog?.difficulties;
  requireValue(catalog?.schemaVersion === 1 && groups && typeof groups === 'object' && !Array.isArray(groups),
    'O catálogo precisa de schemaVersion 1 e do objeto difficulties.');
  for (const id of Object.keys(groups)) {
    requireValue(DIFFICULTIES.some(tier => tier.id === id), `Dificuldade desconhecida: ${id}.`);
  }
  return DIFFICULTIES.flatMap(({ id: tier }) => MODES.flatMap(mode => {
    const entries = groups[tier]?.[mode];
    requireValue(Array.isArray(entries), `O grupo difficulties.${tier}.${mode} precisa ser uma lista.`);
    return entries.map(entry => ({ entry, tier, mode }));
  }));
}

export function decodeLevel(entry, tier, mode, { verifySolution = true } = {}) {
  const id = entry?.id;
  requireValue(validId(id), `ID de fase inválido em ${tier}/${mode}: ${id}.`);
  const check = (ok, message) => requireValue(ok, `Fase ${id}: ${message}`);
  check(Array.isArray(entry.objects) && entry.objects[0]?.id === 'X',
    'objects deve começar com o carrinho vermelho, de ID X.');

  const pieces = [];
  const initial = [];
  const ids = new Map();
  for (const object of entry.objects) {
    const { id: name, axis, row, column, length, color, facing } = object ?? {};
    check(validId(name) && !ids.has(name), `ID de objeto inválido ou duplicado: ${name}.`);
    check(['h', 'v'].includes(axis) && cell(row) && cell(column) && [2, 3].includes(length) &&
      typeof color === 'string' && Object.hasOwn(VEHICLE_COLORS, color) && [1, -1].includes(facing),
      `Coordenadas ou atributos inválidos no objeto ${name}.`);
    const lane = (axis === 'h' ? row : column) - 1;
    const start = (axis === 'h' ? column : row) - 1;
    check(start + length <= SIZE, `O objeto ${name} ultrapassa o tabuleiro.`);
    if (name === 'X') {
      check(axis === 'h' && lane === EXIT_ROW && length === 2 && color === 'red' && facing === 1,
        'X deve ser o carro vermelho horizontal de duas casas, na linha 3, voltado para a direita.');
    }
    ids.set(name, pieces.length);
    pieces.push({ axis, lane, length, color, facing });
    initial.push(start);
  }
  const grid = occupancy(pieces, initial);
  check(grid.filter(index => index !== -1).length === pieces.reduce((sum, piece) => sum + piece.length, 0),
    'Há objetos sobrepostos na posição inicial.');
  check(!limits(pieces, initial, TARGET).canExit, 'A saída já está livre na posição inicial.');

  if (verifySolution) {
    check(Array.isArray(entry.solution) && entry.solution.length > 0, 'Informe a lista solution ou gere-a com npm run solve.');
    let positions = initial;
    entry.solution.forEach((instruction, step) => {
      const { object, row, column, exit } = instruction ?? {};
      const index = ids.get(object);
      const number = step + 1;
      check(index !== undefined, `Objeto desconhecido no movimento ${number}: ${object}.`);
      const { axis, lane } = pieces[index];
      const exits = exit === true;
      check(exits ? index === TARGET && row === undefined && column === undefined :
        exit === undefined && cell(row) && cell(column) && (axis === 'h' ? row : column) === lane + 1,
      `Destino inválido para ${object} no movimento ${number}.`);
      const destination = exits ? EXIT : (axis === 'h' ? column : row) - 1;
      positions = move(pieces, positions, index, destination);
      check(positions, `Movimento ${number} de ${object} impossível.`);
    });
    check(positions[TARGET] === EXIT, 'A solução precisa terminar com a saída de X.');
  }

  return { id, tier, mode, pieces, initial, minimum: verifySolution ? entry.solution.length : undefined };
}

export function normalRange(normal) {
  if (!normal.length) return null;
  return normal.reduce(({ from, to }, { minimum }) =>
    ({ from: Math.min(from, minimum), to: Math.max(to, minimum) }),
  { from: Infinity, to: -Infinity });
}

export function decodeCatalog(catalog) {
  const ids = new Set();
  const layouts = new Set();
  const levels = catalogEntries(catalog).map(({ entry, tier, mode }) => {
    const level = decodeLevel(entry, tier, mode);
    const layout = signature(level.pieces, level.initial);
    requireValue(!ids.has(level.id), `ID de fase duplicado: ${level.id}.`);
    requireValue(!layouts.has(layout), `Tabuleiro duplicado: ${level.id}.`);
    ids.add(level.id);
    layouts.add(layout);
    return level;
  });
  for (const { id } of DIFFICULTIES) {
    const range = normalRange(levels.filter(level => level.tier === id && level.mode === 'normal'));
    if (!range) continue;
    for (const level of levels.filter(level => level.tier === id && level.mode === 'extra')) {
      requireValue(level.minimum >= range.from && level.minimum <= range.to,
        `Fase ${level.id}: o extra precisa ter de ${range.from} a ${range.to} movimentos.`);
    }
  }
  return levels;
}

function coordinates(piece, position) {
  return piece.axis === 'h' ? { row: piece.lane + 1, column: position + 1 } :
    { row: position + 1, column: piece.lane + 1 };
}

export function encodeSolution(level, objects, steps) {
  return steps.map(({ index, destination }) => {
    const object = objects[index].id;
    return destination === EXIT ? { object, exit: true } :
      { object, ...coordinates(level.pieces[index], destination) };
  });
}

export function encodeLevel(level, steps) {
  const objects = level.pieces.map(({ axis, length, color, facing }, index) => ({
    id: index === TARGET ? 'X' : `V${index}`,
    axis, ...coordinates(level.pieces[index], level.initial[index]), length, color, facing
  }));
  return { id: level.id, objects, solution: encodeSolution(level, objects, steps) };
}
