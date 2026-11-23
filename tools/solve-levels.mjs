import { catalogEntries, decodeCatalog, decodeLevel, encodeSolution } from '../src/catalog.js';
import { readCatalog, solveEntry, writeCatalog } from './catalog-file.mjs';

const ids = new Set(process.argv.slice(2));
if (!ids.size) throw new Error('Uso: npm run solve -- ID-DA-FASE [OUTRO-ID]');

const catalog = await readCatalog();
const entries = catalogEntries(catalog);
const found = entries.filter(({ entry }) => ids.has(entry?.id));
for (const id of ids) {
  if (found.filter(({ entry }) => entry.id === id).length !== 1) {
    throw new Error(`Informe um ID único e existente: ${id}.`);
  }
}

let changed = false;
for (const { entry, tier, mode } of found) {
  const level = decodeLevel(entry, tier, mode, { verifySolution: false });
  const steps = solveEntry(level);
  const solution = encodeSolution(level, entry.objects, steps);
  if (JSON.stringify(entry.solution) !== JSON.stringify(solution)) changed = true;
  entry.solution = solution;
  console.log(`${entry.id}: mínimo de ${steps.length} movimentos.`);
}

decodeCatalog(catalog);
if (changed) await writeCatalog(catalog);
