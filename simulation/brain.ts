import { Vector3 } from 'three';
import { GrowthStrategy } from './types';
import { GrowthState, GrowthResult, getSurfaceNormal, SIM_RADIUS, tryAddParticle } from './common';

const normalVec = new Vector3();

export const brainStrategy: GrowthStrategy = {
  name: 'Grooved Brain',

  init: (_params) => {
    const seeds: Array<[number, number, number]> = [[0, 0, 0]];
    const r = SIM_RADIUS * 2;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      seeds.push([Math.cos(angle) * r, 0, Math.sin(angle) * r]);
    }
    return seeds;
  },

  grow: (state: GrowthState, params: Record<string, number>, iterations: number): GrowthResult => {
    const added: Array<[number, number, number]> = [];
    const surfaceNoise = params.surfaceNoise ?? 0.5;
    const density = params.density ?? 0.5;
    const growthStep = SIM_RADIUS * 2.0;
    const neighborRadius = SIM_RADIUS * 5;
    const maxNeighborsForSurface = Math.floor(3 + density * 10);

    for (let i = 0; i < iterations; i++) {
      if (state.count >= state.maxParticles) break;

      const parentIdx = Math.floor(Math.random() * state.count);
      const px = state.positions[parentIdx * 3];
      const py = state.positions[parentIdx * 3 + 1];
      const pz = state.positions[parentIdx * 3 + 2];

      const neighbors = countNeighborsSampled(
        px, py, pz, state.positions, state.count, neighborRadius, 200
      );

      if (neighbors > maxNeighborsForSurface) continue;

      const hasNormal = getSurfaceNormal(
        px, py, pz, state.positions, state.count, neighborRadius, normalVec
      );
      if (!hasNormal) continue;

      normalVec.x += (Math.random() - 0.5) * surfaceNoise * 2;
      normalVec.y += (Math.random() - 0.5) * surfaceNoise * 2;
      normalVec.z += (Math.random() - 0.5) * surfaceNoise * 2;
      normalVec.y += 0.3;
      normalVec.normalize().multiplyScalar(growthStep);

      const cx = px + normalVec.x;
      const cy = py + normalVec.y;
      const cz = pz + normalVec.z;

      if (tryAddParticle(cx, cy, cz, state)) {
        added.push([cx, cy, cz]);
      }
    }

    return { newCount: state.count, addedPositions: added };
  }
};

function countNeighborsSampled(
  x: number, y: number, z: number,
  positions: Float32Array, count: number,
  radius: number, maxSamples: number
): number {
  const rSq = radius * radius;
  let neighbors = 0;
  const step = Math.max(1, Math.floor(count / maxSamples));
  for (let i = 0; i < count; i += step) {
    const dx = positions[i * 3] - x;
    const dy = positions[i * 3 + 1] - y;
    const dz = positions[i * 3 + 2] - z;
    if (dx * dx + dy * dy + dz * dz < rSq) {
      neighbors++;
    }
  }
  if (step > 1) neighbors = Math.round(neighbors * step);
  return neighbors;
}
