/**
 * THE SEED EVERY PROPERTY TEST RUNS ON, spelled once.
 *
 * The default is fixed so a failing property run can be replayed from its report alone, and
 * `FC_SEED` in the environment overrides it when another seed is wanted on purpose. Every vitest
 * configuration of the workspace loads this file before any test, and a property test reads
 * `Number(process.env.FC_SEED)`, so a test in any package reads the same seed without importing
 * anything from another package (the core's boundary refuses a relative path out of it).
 */
process.env.FC_SEED ??= '20261007';
