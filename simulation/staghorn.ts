import { Vector3 } from 'three';
import { GrowthStrategy } from './types';
import { GrowthState, GrowthResult, getHash, getMaxRadius, CELL_SIZE, SIM_RADIUS, tryAddParticle } from './common';

const walkerPos = new Vector3();
const stepVec = new Vector3();

export const staghornStrategy: GrowthStrategy = {
  name: 'Staghorn',

  init: (_params) => {
    return [[0, 0, 0]];
  },

  grow: (state: GrowthState, params: Record<string, number>, iterations: number): GrowthResult => {
    const added: Array<[number, number, number]> = [];
    const tipAttraction = params.tipAttraction ?? 0.5;
    const walkerRandomness = params.walkerRandomness ?? 0.5;
    const stepSize = SIM_RADIUS * 1.5;
    const maxSteps = 300;

    const structRadius = getMaxRadius(state.positions, state.count);
    const spawnRadius = Math.max(structRadius + 8, 15);
    const killRadius = spawnRadius * 2.5;

    const recentStart = Math.max(0, Math.floor(state.count * 0.8));
    let tipX = 0, tipY = 0, tipZ = 0, tipCount = 0;
    for (let i = recentStart; i < state.count; i++) {
      tipX += state.positions[i * 3];
      tipY += state.positions[i * 3 + 1];
      tipZ += state.positions[i * 3 + 2];
      tipCount++;
    }
    if (tipCount > 0) {
      tipX /= tipCount; tipY /= tipCount; tipZ /= tipCount;
    }

    for (let w = 0; w < iterations; w++) {
      if (state.count >= state.maxParticles) break;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(1 - Math.random() * 1.5);
      walkerPos.set(
        spawnRadius * Math.sin(phi) * Math.cos(theta),
        Math.abs(spawnRadius * Math.cos(phi)),
        spawnRadius * Math.sin(phi) * Math.sin(theta)
      );

      for (let step = 0; step < maxSteps; step++) {
        stepVec.set(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        );

        if (tipCount > 0 && tipAttraction > 0) {
          const toTipX = tipX - walkerPos.x;
          const toTipY = tipY - walkerPos.y;
          const toTipZ = tipZ - walkerPos.z;
          const dist = Math.sqrt(toTipX * toTipX + toTipY * toTipY + toTipZ * toTipZ);
          if (dist > 0.1) {
            stepVec.x += (toTipX / dist) * tipAttraction * 1.5;
            stepVec.y += (toTipY / dist) * tipAttraction * 1.5;
            stepVec.z += (toTipZ / dist) * tipAttraction * 1.5;
          }
        }

        const randomScale = 0.3 + walkerRandomness * 1.5;
        stepVec.normalize().multiplyScalar(stepSize * randomScale);
        walkerPos.add(stepVec);

        if (walkerPos.lengthSq() > killRadius * killRadius) break;
        if (walkerPos.y < 0) break;

        const hash = getHash(walkerPos.x, walkerPos.y, walkerPos.z);
        const gx = Math.round(walkerPos.x / CELL_SIZE);
        const gy = Math.round(walkerPos.y / CELL_SIZE);
        const gz = Math.round(walkerPos.z / CELL_SIZE);

        let hasNeighbor = false;
        outer:
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (state.grid.has(`${gx + dx},${gy + dy},${gz + dz}`)) {
                hasNeighbor = true;
                break outer;
              }
            }
          }
        }

        if (hasNeighbor && !state.grid.has(hash)) {
          if (tryAddParticle(walkerPos.x, walkerPos.y, walkerPos.z, state)) {
            added.push([walkerPos.x, walkerPos.y, walkerPos.z]);
          }
          break;
        }
      }
    }

    return { newCount: state.count, addedPositions: added };
  }
};
