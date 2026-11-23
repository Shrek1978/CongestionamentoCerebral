// Lengths of the printed solutions, in card order, including the exit.
// Only counts are used. The catalog's boards and solution paths are generated independently.
export const REFERENCE_COUNTS = {
  iniciante: [8, 8, 14, 9, 9, 9, 13, 12, 12, 17],
  intermediario: [25, 17, 16, 17, 23, 21, 24, 25, 22, 10],
  avancado: [21, 26, 29, 25, 27, 28, 28, 30, 31, 32],
  especialista: [37, 37, 40, 43, 43, 44, 47, 48, 50, 51]
};

export function campaignCounts(tier) {
  const counts = REFERENCE_COUNTS[tier.id];
  // The last two independently generated expert boards are one move below their cards.
  if (tier.id === 'especialista') return [...counts.slice(0, -2), 49, 50];
  return tier.sortByMinimum ? [...counts].sort((a, b) => a - b) : counts;
}
