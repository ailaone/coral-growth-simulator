import { SliderDef } from './simulation/types';

export interface CoralConfig {
  coralType: 1 | 2;
  paramsV1: Record<string, number>;
  paramsV2: Record<string, number>;
  mcResolution: number;
  mcThickness: number;
  blobiness: number;
  smoothing: number;
  noiseAmount: number;
  noiseScale: number;
  color: string;
  edgeColor: string;
  edgeThickness: number;
  useTexture: boolean;
}

// ─── Type 1: Classic L-system ────────────────────────────────────────────────

export const V1_SLIDERS: SliderDef[] = [
  { key: 'generations', label: 'Generations', min: 2, max: 6, step: 1 },
  { key: 'branchAngle', label: 'Branch Angle', min: 15, max: 60, step: 1 },
  { key: 'branchLength', label: 'Branch Length', min: 0.3, max: 1.0, step: 0.05 },
  { key: 'seed', label: 'Random Seed', min: 1, max: 999, step: 1 },
  { key: 'trunkThickness', label: 'Trunk Thickness', min: 0.3, max: 2, step: 0.1 },
  { key: 'taper', label: 'Taper', min: 0.3, max: 0.9, step: 0.05 },
  { key: 'anastomosis', label: 'Anastomosis', min: 0, max: 0.8, step: 0.05, desc: 'Chance of branches fusing into loops' },
];

export const DEFAULT_V1_PARAMS: Record<string, number> = {
  generations: 4,
  branchAngle: 35,
  branchLength: 0.65,
  seed: 42,
  trunkThickness: 1,
  taper: 0.6,
  anastomosis: 0.3,
};

// ─── Type 2: Kitaoka-inspired physics ────────────────────────────────────────

export const V2_SLIDERS: SliderDef[] = [
  { key: 'density', label: 'Density', min: 2, max: 8, step: 1, desc: 'Branch depth — higher = more sub-branches' },
  { key: 'diameterExponent', label: 'Diameter Exp.', min: 2.0, max: 3.5, step: 0.1, desc: "Murray's law exponent — higher = thinner side branches" },
  { key: 'asymmetry', label: 'Asymmetry', min: 0, max: 0.4, step: 0.05, desc: 'Flow split unevenness — 0 = symmetric, high = varied' },
  { key: 'branchLength', label: 'Branch Length', min: 7, max: 14, step: 0.1, desc: 'Length-to-diameter ratio per branch' },
  { key: 'seed', label: 'Random Seed', min: 1, max: 999, step: 1 },
  { key: 'trunkThickness', label: 'Trunk Thickness', min: 1, max: 3, step: 0.1 },
  { key: 'anastomosis', label: 'Anastomosis', min: 0, max: 0.8, step: 0.05, desc: 'Chance of branches fusing into loops' },
];

export const DEFAULT_V2_PARAMS: Record<string, number> = {
  density: 4,
  diameterExponent: 2.8,
  asymmetry: 0.15,
  branchLength: 7.0,
  seed: 42,
  trunkThickness: 1,
  anastomosis: 0.3,
};

// ─── Combined default config ─────────────────────────────────────────────────

export const DEFAULT_CONFIG: CoralConfig = {
  coralType: 1,
  paramsV1: { ...DEFAULT_V1_PARAMS },
  paramsV2: { ...DEFAULT_V2_PARAMS },
  mcResolution: 200,
  mcThickness: 75,
  blobiness: 0,
  smoothing: 0,
  noiseAmount: 0.5,
  noiseScale: 2.0,
  color: '#ffebc9',
  edgeColor: '#000000',
  edgeThickness: 0.5,
  useTexture: true,
};
