import { SliderDef, CoralPreset } from './simulation/types';

export type CoralType = 'staghorn' | 'brain' | 'fox';

export const PRESETS: Record<CoralType, CoralPreset> = {
  staghorn: {
    name: 'Staghorn',
    strategy: 'staghorn',
    params: {
      speed: 4,
      maxParticles: 30000,
      tipAttraction: 0.5,
      walkerRandomness: 0.5,
    },
    sliders: [
      { key: 'speed', label: 'Growth Speed', min: 1, max: 10, step: 0.5 },
      { key: 'maxParticles', label: 'Max Particles', min: 5000, max: 80000, step: 1000 },
      { key: 'tipAttraction', label: 'Tip Attraction', min: 0, max: 1, step: 0.05, desc: 'How much walkers seek branch tips' },
      { key: 'walkerRandomness', label: 'Walker Randomness', min: 0.1, max: 1, step: 0.05, desc: 'Randomness of walker paths' },
    ],
    mcResolution: 128,
    mcIsolation: 85,
    mcPointInfluence: 9,
    color: '#F5E6D3',
    useTexture: true,
  },
  brain: {
    name: 'Grooved Brain',
    strategy: 'brain',
    params: {
      speed: 8,
      maxParticles: 80000,
      surfaceNoise: 0.5,
      density: 0.5,
    },
    sliders: [
      { key: 'speed', label: 'Growth Speed', min: 1, max: 10, step: 0.5 },
      { key: 'maxParticles', label: 'Max Particles', min: 5000, max: 100000, step: 1000 },
      { key: 'surfaceNoise', label: 'Surface Noise', min: 0, max: 1, step: 0.05, desc: 'Noise in growth direction (creates grooves)' },
      { key: 'density', label: 'Density', min: 0, max: 1, step: 0.05, desc: 'Interior fill threshold' },
    ],
    mcResolution: 110,
    mcIsolation: 55,
    mcPointInfluence: 18,
    color: '#C4A06A',
    useTexture: true,
  },
  fox: {
    name: 'Fox',
    strategy: 'fox',
    params: {
      speed: 6,
      maxParticles: 50000,
      ruffleAmount: 0.6,
      petalCount: 5,
    },
    sliders: [
      { key: 'speed', label: 'Growth Speed', min: 1, max: 10, step: 0.5 },
      { key: 'maxParticles', label: 'Max Particles', min: 5000, max: 80000, step: 1000 },
      { key: 'ruffleAmount', label: 'Ruffle Amount', min: 0.1, max: 1, step: 0.05, desc: 'How wavy the petal folds are' },
      { key: 'petalCount', label: 'Petal Count', min: 3, max: 8, step: 1, desc: 'Number of ruffled petal folds' },
    ],
    mcResolution: 120,
    mcIsolation: 65,
    mcPointInfluence: 14,
    color: '#E8C8D8',
    useTexture: true,
  },
};
