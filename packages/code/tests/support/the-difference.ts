/**
 * WHAT TO SAY WHEN TWO LISTS DIFFER, for the message of a guard that compares them.
 *
 * The assertion stays the guard's own (`expect(found, message).toEqual(listed)`); this only
 * computes, for the message, which entries are on one side and not on the other, and prefixes each
 * side with what the person reading the red is to do about it.
 */
export function theDifference(
  found: readonly string[],
  listed: readonly string[],
  whenFoundOnly: string,
  whenListedOnly: string,
): string {
  const foundOnly = found.filter((entry) => !listed.includes(entry));
  const listedOnly = listed.filter((entry) => !found.includes(entry));
  const lines: string[] = [];
  if (foundOnly.length > 0) lines.push(`${whenFoundOnly}: ${foundOnly.join(', ')}`);
  if (listedOnly.length > 0) lines.push(`${whenListedOnly}: ${listedOnly.join(', ')}`);
  return lines.length > 0
    ? lines.join('\n')
    : 'the two lists hold the same entries in another order';
}
