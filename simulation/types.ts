import { GrowthState, GrowthResult } from './common';

// Each strategy implements this interface
export interface GrowthStrategy {
  name: string;
  // Called once when simulation resets. Returns seed positions.
  init: (params: Record<string, number>) => Array<[number, number, number]>;
  // Called each frame. Mutates state, returns what was added.
  grow: (state: GrowthState, params: Record<string, number>, iterations: number) => GrowthResult;
}

// Slider definition for dynamic UI
export interface SliderDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  desc?: string;
}

// Full preset definition
export interface CoralPreset {
  name: string;
  strategy: string; // key into strategy registry
  params: Record<string, number>;
  sliders: SliderDef[];
  // Rendering
  mcResolution: number;
  mcIsolation: number;
  mcPointInfluence: number;
  color: string;
  useTexture: boolean;
}
