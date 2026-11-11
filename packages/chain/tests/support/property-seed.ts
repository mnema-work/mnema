/**
 * THE SEED EVERY PROPERTY TEST RUNS ON: one rule, spelled once. The default seed is fixed so
 * a failing run can be replayed from the report alone; `FC_SEED` in the environment overrides
 * it when a different seed is wanted on purpose. Test files in chain, code and core all read
 * the seed through here, so the default and the override's name change in one place.
 */
export function propertySeed(): number {
  return Number(process.env.FC_SEED ?? 20_261_007);
}
