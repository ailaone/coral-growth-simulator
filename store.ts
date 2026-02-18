import { create } from 'zustand';
import { BufferGeometry } from 'three';
import { DEFAULT_CONFIG, CoralConfig } from './types';

interface AppState {
  config: CoralConfig;
  resetTrigger: number;
  meshTrigger: number;
  showWireframe: boolean;
  showMesh: boolean;
  meshGeometry: BufferGeometry | null;
  meshScale: number;

  // Actions
  setParam: (key: string, value: number) => void;
  setRenderParam: (params: Partial<Pick<CoralConfig, 'mcResolution' | 'mcIsolation' | 'mcPointInfluence' | 'color' | 'useTexture'>>) => void;
  resetSimulation: () => void;
  triggerMesh: () => void;
  toggleWireframe: () => void;
  toggleShowMesh: () => void;
  setMeshGeometry: (geo: BufferGeometry | null, scale?: number) => void;
}

export const useStore = create<AppState>((set) => ({
  config: { ...DEFAULT_CONFIG, params: { ...DEFAULT_CONFIG.params } },
  resetTrigger: 0,
  meshTrigger: 0,
  showWireframe: false,
  showMesh: true,
  meshGeometry: null,
  meshScale: 1,

  setParam: (key, value) => set((state) => ({
    config: {
      ...state.config,
      params: { ...state.config.params, [key]: value }
    }
  })),

  setRenderParam: (params) => set((state) => ({
    config: { ...state.config, ...params }
  })),

  // Run: new tree, clear any existing mesh
  resetSimulation: () => set((state) => ({
    resetTrigger: state.resetTrigger + 1,
    meshTrigger: 0,
    meshGeometry: null,
    meshScale: 1,
    config: {
      ...state.config,
      params: {
        ...state.config.params,
        seed: Math.floor(Math.random() * 999) + 1,
      }
    }
  })),

  // Make 3D: trigger mesh build from current branches
  triggerMesh: () => set((state) => ({
    meshTrigger: state.meshTrigger + 1,
  })),

  toggleWireframe: () => set((state) => ({ showWireframe: !state.showWireframe })),
  toggleShowMesh: () => set((state) => ({ showMesh: !state.showMesh })),

  setMeshGeometry: (geo, scale) => set({
    meshGeometry: geo,
    ...(scale !== undefined ? { meshScale: scale } : {}),
  }),
}));
