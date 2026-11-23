import { readFile, rename, writeFile } from 'node:fs/promises';
import { shortestSolution } from '../src/rules.js';

export const catalogFile = new URL('../src/levels.json', import.meta.url);
export const readCatalog = async () => JSON.parse((await readFile(catalogFile, 'utf8')).replace(/^\uFEFF/, ''));

export function solveEntry(level) {
  const solution = shortestSolution(level.pieces, level.initial);
  if (!solution) throw new Error(`Fase ${level.id}: o tabuleiro não tem solução.`);
  return solution;
}

function formatCatalog(catalog) {
  // Keep each vehicle and move on one line, so the two lists are easy to edit.
  return JSON.stringify(catalog, null, 2).replace(/\{\n\s+"(?:id|object)":[^{}]*?\n\s+\}/g, block => {
    const fields = JSON.parse(block);
    return '{' + Object.entries(fields).map(([key, value]) =>
      `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(', ') + '}';
  }) + '\n';
}

export async function writeCatalog(catalog) {
  const temporary = new URL(`./levels-${process.pid}.tmp`, catalogFile);
  await writeFile(temporary, formatCatalog(catalog), 'utf8');
  await rename(temporary, catalogFile);
}
