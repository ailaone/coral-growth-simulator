import { Vector3 } from 'three';

// Simulation constants
export const SIM_RADIUS = 0.35;
export const VISUAL_RADIUS = 0.9;
export const CELL_SIZE = SIM_RADIUS * 2;
export const MC_SIZE = 120;

export const getHash = (x: number, y: number, z: number): string => {
  return `${Math.round(x / CELL_SIZE)},${Math.round(y / CELL_SIZE)},${Math.round(z / CELL_SIZE)}`;
};

// Find neighbors within a radius by checking surrounding grid cells
export const countNeighbors = (
  x: number, y: number, z: number,
  positions: Float32Array, count: number,
  radius: number
): number => {
  const rSq = radius * radius;
  let neighbors = 0;
  for (let i = 0; i < count; i++) {
    const dx = positions[i * 3] - x;
    const dy = positions[i * 3 + 1] - y;
    const dz = positions[i * 3 + 2] - z;
    if (dx * dx + dy * dy + dz * dz < rSq) {
      neighbors++;
    }
  }
  return neighbors;
};

// Compute centroid of neighbors within radius, returns direction away from centroid (surface normal approximation)
export const getSurfaceNormal = (
  x: number, y: number, z: number,
  positions: Float32Array, count: number,
  radius: number,
  out: Vector3
): boolean => {
  const rSq = radius * radius;
  let cx = 0, cy = 0, cz = 0, n = 0;
  for (let i = 0; i < count; i++) {
    const dx = positions[i * 3] - x;
    const dy = positions[i * 3 + 1] - y;
    const dz = positions[i * 3 + 2] - z;
    if (dx * dx + dy * dy + dz * dz < rSq) {
      cx += positions[i * 3];
      cy += positions[i * 3 + 1];
      cz += positions[i * 3 + 2];
      n++;
    }
  }
  if (n === 0) return false;
  cx /= n; cy /= n; cz /= n;
  out.set(x - cx, y - cy, z - cz);
  if (out.lengthSq() < 0.0001) {
    out.set(0, 1, 0);
  }
  out.normalize();
  return true;
};

// Get the current max radius of the structure from origin
export const getMaxRadius = (positions: Float32Array, count: number): number => {
  let maxSq = 0;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const dSq = x * x + y * y + z * z;
    if (dSq > maxSq) maxSq = dSq;
  }
  return Math.sqrt(maxSq);
};

// Get the max Y of the structure (for tip tracking)
export const getMaxY = (positions: Float32Array, count: number): number => {
  let maxY = 0;
  for (let i = 0; i < count; i++) {
    const y = positions[i * 3 + 1];
    if (y > maxY) maxY = y;
  }
  return maxY;
};

// Shared growth state that strategies can use
export interface GrowthState {
  positions: Float32Array;
  count: number;
  grid: Set<string>;
  maxParticles: number;
}

// Result of a growth step
export interface GrowthResult {
  newCount: number;
  addedPositions: Array<[number, number, number]>;
}

// Try to add a particle at (x,y,z). Returns true if added.
export const tryAddParticle = (
  x: number, y: number, z: number,
  state: GrowthState
): boolean => {
  if (y < 0) return false;
  if (state.count >= state.maxParticles) return false;
  const hash = getHash(x, y, z);
  if (state.grid.has(hash)) return false;

  const idx = state.count;
  state.positions[idx * 3] = x;
  state.positions[idx * 3 + 1] = y;
  state.positions[idx * 3 + 2] = z;
  state.grid.add(hash);
  state.count++;
  return true;
};
