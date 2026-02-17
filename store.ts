import { create } from 'zustand';
import { PRESETS, CoralType } from './types';
import { CoralPreset } from './simulation/types';

export type ViewMode = 'particles' | 'solid';

interface AppState {
  isPlaying: boolean;
  activePresetKey: CoralType;
  preset: CoralPreset;
  resetTrigger: number;
  viewMode: ViewMode;
  showWireframe: boolean;

  // Actions
  setIsPlaying: (isPlaying: boolean) => void;
  setParam: (key: string, value: number) => void;
  setPreset: (presetKey: CoralType) => void;
  setRenderParam: (params: Partial<Pick<CoralPreset, 'mcResolution' | 'mcIsolation' | 'mcPointInfluence' | 'color' | 'useTexture'>>) => void;
  resetSimulation: () => void;
  togglePlay: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleWireframe: () => void;
}

export const useStore = create<AppState>((set) => ({
  isPlaying: false,
  activePresetKey: 'staghorn',
  preset: { ...PRESETS.staghorn, params: { ...PRESETS.staghorn.params } },
  resetTrigger: 0,
  viewMode: 'particles',
  showWireframe: false,

  setIsPlaying: (isPlaying) => set({ isPlaying }),

  setParam: (key, value) => set((state) => ({
    preset: {
      ...state.preset,
      params: { ...state.preset.params, [key]: value }
    }
  })),

  setPreset: (presetKey) => {
    const preset = PRESETS[presetKey];
    if (preset) {
      set({
        activePresetKey: presetKey,
        preset: { ...preset, params: { ...preset.params } },
      });
    }
  },

  setRenderParam: (params) => set((state) => ({
    preset: { ...state.preset, ...params }
  })),

  resetSimulation: () => set((state) => ({
    resetTrigger: state.resetTrigger + 1,
    isPlaying: true,
    viewMode: 'particles',
  })),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setViewMode: (mode) => set({ viewMode: mode }),

  toggleWireframe: () => set((state) => ({ showWireframe: !state.showWireframe })),
}));
