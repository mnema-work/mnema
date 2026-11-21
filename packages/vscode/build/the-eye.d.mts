export type Point = readonly [number, number];
export const EYE: Readonly<{
  almond: readonly (readonly Point[])[];
  iris: Readonly<{ cx: number; cy: number; r: number }>;
  lines: readonly Readonly<{ d: string; width: number; curves: readonly (readonly Point[])[] }>[];
}>;
export const almondEdges: Readonly<{
  left: number;
  right: number;
  top: (x: number) => number;
  bottom: (x: number) => number;
}>;
export const lineEdges: readonly Readonly<{
  from: number;
  to: number;
  top: (x: number) => number;
  bottom: (x: number) => number;
}>[];
export function paintAt(x: number, y: number): 'line' | 'iris' | undefined;
export function drawActivityIcon(): string;
