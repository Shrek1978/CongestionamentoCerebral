import { DIFFICULTIES } from './difficulties.js';
import { SIZE, EXIT_ROW, EXIT, TARGET, limits } from './rules.js';
import { VEHICLE_COLORS as palette } from './vehicle-colors.js';
import {
  STORAGE_KEY, levelsById, levelsIn, extras, celebrationKey, createProgress, newRun,
  won, tierComplete, tierOpen, isOpen, drawExtra, applyMove, undo, restoreProgress, serializeProgress
} from './progress.js';

const get = id => document.getElementById(id);
const board = get('board');
const settings = get('settings');
const victory = get('victory');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let saved = null;
try {
  saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
} catch {
  // A missing or unreadable save starts a new game.
}
const restored = restoreProgress(saved);
let state = restored.state;

let level = levelsById.get(state.active);
let run = level && (state.runs[level.id] ?? newRun(level));
let displayedTier = level?.tier ?? DIFFICULTIES[0].id;
let displayedMode = level?.mode ?? 'normal';
let vehicles = [];
let drag = null;
let victoryPending = false;

function save(progress = state) {
  try {
    localStorage.setItem(STORAGE_KEY, serializeProgress(progress));
    get('save-warning').hidden = true;
    return true;
  } catch {
    get('save-warning').hidden = false;
    return false;
  }
}

function element(tag, classes, content) {
  const node = document.createElement(tag);
  if (classes) node.className = classes;
  if (content !== undefined) node.textContent = content;
  return node;
}

function button(label, classes, action) {
  const node = element('button', classes, label);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

function vehicleArt(color, truck = false) {
  const art = element('span', truck ? 'vehicle-art truck' : 'vehicle-art');
  art.setAttribute('aria-hidden', 'true');
  art.style.setProperty('--paint', palette[color][0]);
  const shapes = ['tires', 'bodywork', 'rear-glass', 'roof', 'front-glass',
    'front-lamp', 'front-lamp low', 'rear-lamp', 'rear-lamp low'];
  if (truck) shapes.splice(2, 0, 'cargo');
  art.append(...shapes.map(shape => element('i', shape)));
  return art;
}

function makeBoard() {
  const cells = Array.from({ length: SIZE * SIZE }, (_, index) => {
    const cell = element('span', index === (EXIT_ROW + 1) * SIZE - 1 ? 'cell exit-cell' : 'cell');
    cell.setAttribute('aria-hidden', 'true');
    return cell;
  });
  vehicles = level.pieces.map(({ axis, length, facing, color }, index) => {
    const node = element('button', axis === 'v' ? 'vehicle vertical' : 'vehicle');
    node.type = 'button';
    node.dataset.vehicle = index;
    node.style.setProperty('--span-x', axis === 'h' ? length : 1);
    node.style.setProperty('--span-y', axis === 'v' ? length : 1);
    node.style.setProperty('--length', length);
    const heading = (axis === 'v' ? 90 : 0) + (facing < 0 ? 180 : 0);
    const art = vehicleArt(color, length === 3);
    art.style.setProperty('--heading', `${heading}deg`);
    node.append(art);
    return node;
  });
  board.replaceChildren(...cells, ...vehicles);
  placeVehicles();
}

function placeVehicles(keepTargetVisible = false) {
  vehicles.forEach((node, index) => {
    const { axis, lane, length, color } = level.pieces[index];
    const start = run.positions[index];
    const col = axis === 'h' ? start : lane;
    const row = axis === 'h' ? lane : start;
    node.style.setProperty('--row', row);
    node.style.setProperty('--col', col);
    node.hidden = start === EXIT && !keepTargetVisible;
    const name = index === TARGET ? 'Carro vermelho, carro alvo' :
      `${length === 3 ? 'Caminhão' : 'Carro'} ${palette[color][1]}`;
    const direction = axis === 'h' ? 'horizontal' : 'vertical';
    node.setAttribute('aria-label', `${name}, ${direction}, linha ${row + 1}, coluna ${col + 1}`);
  });
}

function updateControls() {
  get('move-count').textContent = run.moves;
  const finished = run.positions[TARGET] === EXIT;
  get('undo').disabled = !run.history.length || finished;
  get('result').hidden = !finished;
}

const tierInfo = id => DIFFICULTIES.find(tier => tier.id === id);
const levelNumber = item => levelsIn(item.tier, item.mode).indexOf(item) + 1;
const labelFor = item => `${item.mode === 'extra' ? 'Extra' : 'Desafio'} ${levelNumber(item)}`;

function showGame() {
  document.querySelector('.counter').hidden = !level;
  document.querySelector('.board-area').hidden = !level;
  document.querySelector('.game-footer').hidden = !level;
  get('instructions').hidden = !level;
  if (!level) {
    get('phase-label').textContent = '';
    get('phase-title').textContent = 'Nenhum desafio cadastrado';
    return;
  }
  const tier = tierInfo(level.tier);
  get('phase-label').textContent = level.mode === 'extra' ? `${tier.name} · Extra` : tier.name;
  get('phase-title').textContent = labelFor(level);
  makeBoard();
  updateControls();
}

const tierButtons = DIFFICULTIES.map(tier => {
  const node = button(tier.name, 'tier', () => {
    displayedTier = tier.id;
    renderChallenges();
  });
  get('tier-list').append(node);
  return node;
});

function progressIndicator(current, total) {
  const description = `${current} de ${total} concluídos`;
  const count = element('p', 'progress-text', description);
  if (!total) return [count];
  const track = element('progress', 'progress-track');
  track.value = current;
  track.max = total;
  track.setAttribute('aria-label', description);
  return [count, track];
}

function renderChallenges() {
  tierButtons.forEach((node, index) =>
    node.setAttribute('aria-pressed', displayedTier === DIFFICULTIES[index].id)
  );
  get('normal-tab').setAttribute('aria-pressed', displayedMode === 'normal');
  get('extra-tab').setAttribute('aria-pressed', displayedMode === 'extra');
  const group = levelsIn(displayedTier, displayedMode);
  const completed = group.filter(item => won(state, item)).length;
  const panel = get('mode-panel');
  panel.replaceChildren(...progressIndicator(completed, group.length));
  if (!group.length) {
    panel.append(element('p', 'panel-message', 'Nenhum desafio cadastrado neste grupo.'));
    return;
  }
  if (!tierOpen(state, displayedTier)) {
    const preceding = DIFFICULTIES.slice(0, DIFFICULTIES.indexOf(tierInfo(displayedTier)));
    const pending = preceding.find(tier => !tierComplete(state, tier.id));
    panel.append(element('p', 'panel-message', `Conclua as fases normais de ${pending.name} para liberar esta dificuldade.`));
    if (displayedMode === 'extra') return;
  }
  if (displayedMode === 'extra') {
    if (!tierComplete(state, displayedTier)) {
      panel.append(element('p', 'panel-message', 'Vença todas as fases normais desta dificuldade para liberar os extras.'));
    } else if (completed === group.length) {
      panel.append(element('p', 'panel-message', 'Todos os extras desta dificuldade foram concluídos.'));
      if (extras.every(item => won(state, item))) {
        panel.append(button('Ver celebração', 'secondary draw', () => showVictory({ finale: true, stats: false })));
      }
    } else {
      const activeExtra = level?.mode === 'extra' && level.tier === displayedTier &&
        run.positions[TARGET] !== EXIT && !won(state, level);
      panel.append(button(activeExtra ? 'Sortear outro extra' : 'Sortear desafio', 'primary draw',
        () => startExtra(displayedTier, activeExtra ? level.id : null)));
    }
    return;
  }

  const grid = element('div', 'level-list');
  grid.append(...group.map((item, index) => {
    const selected = level?.id === item.id;
    const completed = won(state, item);
    const node = button(String(index + 1), 'level-btn', () => openLevel(item, true));
    node.disabled = !isOpen(state, item);
    node.setAttribute('aria-label', `Desafio ${index + 1}${completed ? ', concluído' : node.disabled ? ', bloqueado' : ''}`);
    if (selected) node.setAttribute('aria-current', 'true');
    if (completed) {
      const mark = element('span', 'check', '✓');
      mark.setAttribute('aria-hidden', 'true');
      node.append(mark);
    }
    return node;
  }));
  panel.append(grid);
}

function focusPhase() {
  const title = get('phase-title');
  title.setAttribute('tabindex', '-1');
  title.focus();
}

function showLevel(item) {
  cancelDrag();
  level = item;
  run = item && (state.runs[item.id] ?? newRun(item));
  state.active = item?.id ?? null;
  displayedTier = item?.tier ?? DIFFICULTIES[0].id;
  displayedMode = item?.mode ?? 'normal';
  showGame();
  renderChallenges();
}

function openLevel(item, focus = false) {
  if (!item || !isOpen(state, item) || victoryPending) return;
  showLevel(item);
  save();
  if (focus) focusPhase();
}

function restartRun(focus = false) {
  if (!level || victoryPending) return;
  cancelDrag();
  run = newRun(level);
  state.runs[level.id] = run;
  showGame();
  get('announcement').textContent = 'Tentativa reiniciada.';
  save();
  if (focus) focusPhase();
}

function startExtra(tier, except = null) {
  openLevel(drawExtra(state, tier, Math.random, except), true);
}

function finishRun() {
  const firstWin = !won(state, level);
  const group = levelsIn(level.tier, 'normal');
  const completedTier = firstWin && level.mode === 'normal' && group.every(item =>
    item.id === level.id || won(state, item)
  );
  state.wins[level.id] = true;
  const finale = firstWin && level.mode === 'extra' &&
    extras.every(item => won(state, item)) && state.celebrated !== celebrationKey;
  save();
  renderChallenges();
  return { completedTier, finale };
}

function animatePiece(index, pixels, exiting) {
  if (!pixels || reducedMotion.matches) return null;
  const axis = level.pieces[index].axis === 'h' ? 'X' : 'Y';
  return vehicles[index].animate(
    [{ transform: `translate${axis}(${pixels}px)` }, { transform: 'translate(0, 0)' }],
    { duration: exiting ? 350 : 130, easing: exiting ? 'ease-in' : 'ease-out' }
  );
}

function performMove(index, destination, visualOffset = 0) {
  const piece = vehicles[index];
  const origin = run.positions[index];
  piece.getAnimations().forEach(animation => animation.cancel());
  const moved = applyMove(level, run, index, destination);
  const exiting = moved && destination === EXIT;
  piece.classList.toggle('exiting', exiting);
  const pixelPerCell = board.getBoundingClientRect().width / SIZE;
  const offset = moved ? visualOffset - (destination - origin) * pixelPerCell : visualOffset;
  placeVehicles(exiting);
  const animation = animatePiece(index, offset, exiting);
  if (!moved) return;
  state.runs[level.id] = run;
  updateControls();
  if (exiting) {
    victoryPending = true;
    const outcome = finishRun();
    Promise.resolve(animation?.finished).catch(() => {}).then(() => {
      piece.hidden = true;
      victoryPending = false;
      showVictory(outcome);
    });
  } else {
    save();
  }
}

function victoryAction(label, classes, action) {
  function activate() {
    if (!victory.open) return;
    victory.close();
    action?.();
  }

  const node = button(label, classes, activate);
  let touch = null;
  // A touch after the exit drag can reach the dialog without a synthesized click.
  node.addEventListener('pointerdown', event => {
    if (event.isPrimary && event.pointerType === 'touch') {
      touch = { pointer: event.pointerId, x: event.clientX, y: event.clientY };
    }
  });
  node.addEventListener('pointercancel', () => { touch = null; });
  node.addEventListener('pointerup', event => {
    const start = touch;
    touch = null;
    if (start?.pointer !== event.pointerId) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
    if (node.contains(document.elementFromPoint(event.clientX, event.clientY))) activate();
  });
  return node;
}

function showVictory({ completedTier = false, finale = false, stats = true } = {}) {
  if (victory.open) return;
  const title = element('h2', null, finale ? 'Todos os extras concluídos!' :
    completedTier ? `Nível ${tierInfo(level.tier).name} concluído!` : 'Desafio concluído!');
  title.id = 'victory-title';
  const content = get('victory-content');
  content.replaceChildren(title);
  if (finale) {
    const scene = element('div', 'celebration');
    scene.setAttribute('aria-hidden', 'true');
    for (const [color, motion] of [['red', 'red'], ['mint', 'block-top'], ['blue', 'block-bottom']]) {
      const sprite = element('div', `sprite ${motion}`);
      sprite.append(vehicleArt(color));
      scene.append(sprite);
    }
    content.append(scene);
    state.celebrated = celebrationKey;
    save();
  }
  if (stats) {
    const comparison = element('dl', 'result-stats');
    for (const [label, value] of [['Movimentos usados', run.moves], ['Mínimo', level.minimum]]) {
      const group = element('div');
      group.append(element('dt', null, label), element('dd', null, value));
      comparison.append(group);
    }
    content.append(comparison);
  }

  const actions = element('div', 'dialog-buttons');
  if (completedTier) {
    const currentTier = tierInfo(level.tier);
    const nextTier = DIFFICULTIES.slice(DIFFICULTIES.indexOf(currentTier) + 1)
      .find(tier => levelsIn(tier.id, 'normal').length);
    if (levelsIn(currentTier.id, 'extra').some(item => !won(state, item))) {
      content.append(element('p', 'victory-copy', `Os extras de ${currentTier.name} estão liberados.`));
      actions.append(victoryAction(`Jogar extras de ${currentTier.name}`, 'primary', () => startExtra(currentTier.id)));
    }
    if (nextTier) actions.append(victoryAction(`Ir para ${nextTier.name}`, actions.children.length ? 'secondary' : 'primary',
      () => openLevel(levelsIn(nextTier.id, 'normal')[0], true)));
  } else if (stats) {
    if (level.mode === 'normal') {
      const group = levelsIn(level.tier, 'normal');
      const next = group.slice(levelNumber(level)).find(item => isOpen(state, item) && !won(state, item))
        ?? group.find(item => isOpen(state, item) && !won(state, item));
      if (next) actions.append(victoryAction('Próximo desafio', 'primary', () => openLevel(next, true)));
    } else if (levelsIn(level.tier, 'extra').some(item => !won(state, item))) {
      actions.append(victoryAction('Sortear outro extra', 'primary', () => startExtra(level.tier)));
    }
  }
  if (stats && run.moves > level.minimum) {
    actions.append(victoryAction('Refazer desafio', actions.children.length ? 'secondary' : 'primary',
      () => restartRun(true)));
  }
  actions.append(victoryAction('Fechar', actions.children.length ? 'secondary' : 'primary'));
  content.append(actions);
  victory.showModal();
}

function cancelDrag() {
  if (!drag) return null;
  const finished = drag;
  drag = null;
  const { node, pointer } = finished;
  node.classList.remove('dragging');
  node.style.removeProperty('--drag-x');
  node.style.removeProperty('--drag-y');
  if (node.hasPointerCapture(pointer)) node.releasePointerCapture(pointer);
  return finished;
}

board.addEventListener('pointerdown', event => {
  const node = event.target.closest('.vehicle');
  if (!node || drag || !event.isPrimary || event.button !== 0 || run.positions[TARGET] === EXIT) return;
  const index = Number(node.dataset.vehicle);
  const horizontal = level.pieces[index].axis === 'h';
  node.getAnimations().forEach(animation => animation.cancel());
  const width = board.getBoundingClientRect().width / SIZE;
  const origin = run.positions[index];
  const { min, max, canExit } = limits(level.pieces, run.positions, index);
  drag = {
    node, pointer: event.pointerId, index, origin, width, min, max, canExit,
    horizontal, anchor: horizontal ? event.clientX : event.clientY, offset: 0
  };
  node.setPointerCapture(event.pointerId);
  node.classList.add('dragging');
});

function updateDrag(event) {
  if (drag?.pointer !== event.pointerId) return;
  const { horizontal, anchor, width, min, max, canExit, origin, node } = drag;
  const coordinate = horizontal ? event.clientX : event.clientY;
  const maxDrag = canExit ? EXIT : max;
  drag.offset = Math.min((maxDrag - origin) * width, Math.max((min - origin) * width, coordinate - anchor));
  node.style.setProperty(horizontal ? '--drag-x' : '--drag-y', `${drag.offset}px`);
}

board.addEventListener('pointermove', updateDrag);
board.addEventListener('pointerup', event => {
  if (drag?.pointer !== event.pointerId) return;
  updateDrag(event);
  const { index, origin, offset, width, max, canExit } = cancelDrag();
  const steps = offset / width;
  const exits = canExit && origin + steps >= max + .35;
  performMove(index, exits ? EXIT : Math.min(max, origin + Math.round(steps)), offset);
});

for (const eventName of ['pointercancel', 'lostpointercapture']) {
  board.addEventListener(eventName, event => {
    if (drag?.pointer === event.pointerId) {
      const { index, offset } = cancelDrag();
      animatePiece(index, offset, false);
    }
  });
}

board.addEventListener('keydown', event => {
  const node = event.target.closest('.vehicle');
  if (!node || drag || run.positions[TARGET] === EXIT) return;
  const index = Number(node.dataset.vehicle);
  const horizontal = level.pieces[index].axis === 'h';
  const before = horizontal ? 'ArrowLeft' : 'ArrowUp';
  const after = horizontal ? 'ArrowRight' : 'ArrowDown';
  if (![before, after].includes(event.key)) return;
  event.preventDefault();
  const { min, max, canExit } = limits(level.pieces, run.positions, index);
  const origin = run.positions[index];
  const positive = event.key === after;
  let destination = positive ? Math.min(origin + 1, max) : Math.max(origin - 1, min);
  if (event.shiftKey) destination = positive ? max : min;
  if (positive && canExit && (event.shiftKey || origin === max)) destination = EXIT;
  performMove(index, destination);
});

get('undo').addEventListener('click', () => {
  cancelDrag();
  const previous = run.positions;
  if (!undo(run)) return;
  const index = previous.findIndex((position, piece) => position !== run.positions[piece]);
  vehicles[index].getAnimations().forEach(animation => animation.cancel());
  placeVehicles();
  animatePiece(index, (previous[index] - run.positions[index]) * board.getBoundingClientRect().width / SIZE, false);
  updateControls();
  get('announcement').textContent = `Posição anterior restaurada. ${run.moves} movimentos usados.`;
  save();
});
get('restart').addEventListener('click', () => restartRun());
get('result').addEventListener('click', () => {
  if (!victoryPending) showVictory();
});
for (const mode of ['normal', 'extra']) {
  get(`${mode}-tab`).addEventListener('click', () => {
    displayedMode = mode;
    renderChallenges();
  });
}
get('settings-open').addEventListener('click', () => {
  if (victoryPending) return;
  setResetConfirmation(false);
  settings.querySelector(`input[value="${state.sequence}"]`).checked = true;
  settings.showModal();
});
settings.addEventListener('change', event => {
  if (event.target.name !== 'sequence') return;
  state.sequence = event.target.value;
  renderChallenges();
  save();
});

function setResetConfirmation(visible) {
  get('reset-confirmation').hidden = !visible;
  get('reset-open').setAttribute('aria-expanded', visible);
  get('reset-error').hidden = true;
}

get('reset-open').addEventListener('click', () => {
  setResetConfirmation(true);
  get('reset-cancel').focus();
});
get('reset-cancel').addEventListener('click', () => {
  setResetConfirmation(false);
  get('reset-open').focus();
});
get('reset-confirm').addEventListener('click', () => {
  const fresh = createProgress({ sequence: state.sequence });
  if (!save(fresh)) {
    get('reset-error').hidden = false;
    return;
  }
  state = fresh;
  settings.close();
  showLevel(levelsById.get(state.active));
  get('announcement').textContent = 'Progresso apagado.';
  focusPhase();
});

showGame();
renderChallenges();
if (!saved || restored.catalogChanged) save();
if (restored.catalogChanged) get('catalog-notice').hidden = false;
