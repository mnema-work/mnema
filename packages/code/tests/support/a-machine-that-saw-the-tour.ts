/**
 * A MACHINE THAT HAS SEEN THE TOUR: the state a test plants so the bare name asks its question instead of
 * opening the tour, which is what the first run on a machine does.
 *
 * It is planted THROUGH THE PRODUCT'S OWN WRITE (`writeMachineState`), in the directory the product keeps it
 * in for that environment, and not by JSON written here: a file shaped by hand would go on being planted
 * after the product changed what it reads. There is no switch in the binary for this, by design; the only
 * way past the tour is a machine that has been through it.
 */

import { resolveTrees } from '@mnema/core';
import { discoveryEnv } from '../../src/env.js';
import { readMachineState, writeMachineState } from '../../src/machine-state.js';

/** Plants the state in the machine `environment` describes, and returns that machine's global directory. */
export function aMachineThatSawTheTour(environment: NodeJS.ProcessEnv, cwd: string): string {
  const dir = resolveTrees(cwd, discoveryEnv(environment)).global;
  writeMachineState(dir, { ...readMachineState(dir), tourSeen: true });
  return dir;
}
