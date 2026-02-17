import { Vector3 } from 'three';
import { GrowthStrategy } from './types';
import { GrowthState, GrowthResult, SIM_RADIUS, tryAddParticle } from './common';

const dirVec = new Vector3();

/**
 * Fox Coral (Nemenzophyllia turbida) — soft, ruffled petal-like growth.
 *
 * Particles grow radially outward from a central cluster.  A sinusoidal
 * Y-displacement keyed to the angular position around the Y axis produces
 * the characteristic wavy ruffle.  Amplitude scales with distance from
 * center so the outer edges flare more than the interior.
 */
export const foxStrategy: GrowthStrategy = {
  name: 'Fox',

  init: (_params) => {
    // Small central cluster — 1 center + hexagonal ring
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
    const ruffleAmount = params.ruffleAmount ?? 0.6;
    const petalCount = Math.round(params.petalCount ?? 5);
    const growthStep = SIM_RADIUS * 2.0;

    // Ruffle wave parameters derived from sliders
    const baseAmplitude = 0.5 + ruffleAmount * 2.5;   // how tall the ruffles get
    const waveFreq = petalCount;                        // angular frequency

    for (let i = 0; i < iterations; i++) {
      if (state.count >= state.maxParticles) break;

      // Pick a recent parent (bias toward outer/newer particles)
      const window = Math.max(1, Math.floor(state.count * 0.35));
      const parentIdx = Math.max(0, state.count - 1 - Math.floor(Math.random() * window));

      const px = state.positions[parentIdx * 3];
      const py = state.positions[parentIdx * 3 + 1];
      const pz = state.positions[parentIdx * 3 + 2];

      // Radial outward direction in XZ plane
      const distXZ = Math.sqrt(px * px + pz * pz) + 0.001;
      const outX = px / distXZ;
      const outZ = pz / distXZ;

      // Angular position of this particle around Y axis
      const angle = Math.atan2(pz, px);

      // Ruffle displacement: sinusoidal wave keyed to angle, amplitude grows with radius
      const radiusFactor = Math.min(distXZ / 5, 1); // ramp up over first 5 units
      const ruffleY = baseAmplitude * radiusFactor * Math.sin(angle * waveFreq + distXZ * 0.4);

      // Growth direction: outward + slight upward + ruffle + noise
      dirVec.set(
        outX * 0.7 + (Math.random() - 0.5) * 0.6,
        0.15 + ruffleY * 0.3 + (Math.random() - 0.5) * 0.3,
        outZ * 0.7 + (Math.random() - 0.5) * 0.6
      ).normalize().multiplyScalar(growthStep);

      const cx = px + dirVec.x;
      const cy = py + dirVec.y;
      const cz = pz + dirVec.z;

      // Keep growth mostly above ground
      if (cy < -1) continue;

      if (tryAddParticle(cx, cy, cz, state)) {
        added.push([cx, cy, cz]);
      }
    }

    return { newCount: state.count, addedPositions: added };
  }
};
