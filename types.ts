import { SliderDef } from './simulation/types';

export interface CoralConfig {
  params: Record<string, number>;
  sliders: SliderDef[];
  mcResolution: number;
  mcThickness: number;
  color: string;
  edgeColor: string;
  edgeThickness: number;
  useTexture: boolean;
}

export const DEFAULT_CONFIG: CoralConfig = {
  params: {
    generations: 4,
    branchAngle: 35,
    branchLength: 0.65,
    seed: 42,
    trunkThickness: 1,
    taper: 0.6,
    noiseAmount: 0.5,
    noiseScale: 2.0,
    anastomosis: 0.3,
  },
  sliders: [
    { key: 'generations', label: 'Generations', min: 2, max: 6, step: 1 },
    { key: 'branchAngle', label: 'Branch Angle', min: 15, max: 60, step: 1 },
    { key: 'branchLength', label: 'Branch Length', min: 0.3, max: 1.0, step: 0.05 },
    { key: 'seed', label: 'Random Seed', min: 1, max: 999, step: 1 },
    { key: 'trunkThickness', label: 'Trunk Thickness', min: 0.3, max: 3, step: 0.1 },
    { key: 'taper', label: 'Taper', min: 0.3, max: 0.9, step: 0.05 },
    { key: 'anastomosis', label: 'Anastomosis', min: 0, max: 0.8, step: 0.05, desc: 'Chance of branches fusing into loops' },
    { key: 'noiseAmount', label: 'Noise Amount', min: 0, max: 2, step: 0.1 },
    { key: 'noiseScale', label: 'Noise Scale', min: 0.5, max: 5, step: 0.1 },
  ],
  mcResolution: 200,
  mcThickness: 75,
  color: '#8B4513',
  edgeColor: '#000000',
  edgeThickness: 0.5,
  useTexture: true,
};
