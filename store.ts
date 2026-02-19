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
  floorY: number;
  focusCenter: [number, number, number];
  focusRadius: number;
  paramsDirty: boolean;
  zoomTrigger: number;

  // Actions
  setCoralType: (type: 1 | 2) => void;
  setParam: (key: string, value: number) => void;
  setRenderParam: (params: Partial<Pick<CoralConfig, 'mcResolution' | 'mcThickness' | 'blobiness' | 'smoothing' | 'noiseAmount' | 'noiseScale' | 'color' | 'edgeColor' | 'edgeThickness' | 'useTexture'>>) => void;
  resetSimulation: () => void;
  triggerMesh: () => void;
  toggleWireframe: () => void;
  toggleShowMesh: () => void;
  setMeshGeometry: (geo: BufferGeometry | null, scale?: number) => void;
  setFloorY: (y: number) => void;
  setFocusTarget: (center: [number, number, number], radius: number) => void;
  zoomExtents: () => void;
}

const initialSeed = Math.floor(Math.random() * 999) + 1;

export const useStore = create<AppState>((set) => ({
  config: {
    ...DEFAULT_CONFIG,
    paramsV1: { ...DEFAULT_CONFIG.paramsV1, seed: initialSeed },
    paramsV2: { ...DEFAULT_CONFIG.paramsV2, seed: initialSeed },
  },
  resetTrigger: 0,
  meshTrigger: 0,
  showWireframe: true,
  showMesh: true,
  meshGeometry: null,
  meshScale: 1,
  floorY: 0,
  focusCenter: [0, -15, 0],
  focusRadius: 20,
  paramsDirty: false,
  zoomTrigger: 0,

  setCoralType: (type) => set((state) => ({
    paramsDirty: true,
    config: { ...state.config, coralType: type },
  })),

  setParam: (key, value) => set((state) => {
    const activeKey = state.config.coralType === 1 ? 'paramsV1' : 'paramsV2';
    return {
      paramsDirty: true,
      config: {
        ...state.config,
        [activeKey]: { ...state.config[activeKey], [key]: value },
      },
    };
  }),

  setRenderParam: (params) => set((state) => ({
    config: { ...state.config, ...params }
  })),

  // Run: new tree, clear any existing mesh
  resetSimulation: () => set((state) => {
    const newSeed = Math.floor(Math.random() * 999) + 1;
    const activeKey = state.config.coralType === 1 ? 'paramsV1' : 'paramsV2';
    return {
      paramsDirty: false,
      resetTrigger: state.resetTrigger + 1,
      meshTrigger: 0,
      meshGeometry: null,
      meshScale: 1,
      config: {
        ...state.config,
        [activeKey]: {
          ...state.config[activeKey],
          seed: newSeed,
        },
      },
    };
  }),

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
  setFloorY: (y) => set({ floorY: y }),
  setFocusTarget: (center, radius) => set({ focusCenter: center, focusRadius: radius }),
  zoomExtents: () => set((state) => ({ zoomTrigger: state.zoomTrigger + 1 })),
}));
