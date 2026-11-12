/**
 * WHAT TO SAY WHEN TWO LISTS DIFFER, for the message of a guard that compares them.
 *
 * The assertion stays the guard's own (`expect(found, message).toEqual(listed)`); this only
 * computes, for the message, which entries are on one side and not on the other (and which
 * appear a different number of times on each), and prefixes each side with what the person
 * reading the red is to do about it.
 */
function countsOf(entries: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry, (counts.get(entry) ?? 0) + 1);
  return counts;
}

export function theDifference(
  found: readonly string[],
  listed: readonly string[],
  whenFoundOnly: string,
  whenListedOnly: string,
): string {
  const inFound = countsOf(found);
  const inListed = countsOf(listed);
  const foundOnly = [...inFound.keys()].filter((entry) => !inListed.has(entry));
  const listedOnly = [...inListed.keys()].filter((entry) => !inFound.has(entry));
  const lines: string[] = [];
  if (foundOnly.length > 0) lines.push(`${whenFoundOnly}: ${foundOnly.join(', ')}`);
  if (listedOnly.length > 0) lines.push(`${whenListedOnly}: ${listedOnly.join(', ')}`);
  for (const [entry, times] of inFound) {
    const other = inListed.get(entry);
    if (other !== undefined && other !== times) {
      lines.push(`${entry} appears ${times} times on one side and ${other} on the other`);
    }
  }
  return lines.length > 0
    ? lines.join('\n')
    : 'the two lists hold the same entries in another order';
}
