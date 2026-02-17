import { create } from 'zustand';
import { SimulationParams, SimulationType, PRESETS } from './types';

export type ViewMode = 'particles' | 'solid';

interface AppState {
  isPlaying: boolean;
  simulationType: SimulationType;
  params: SimulationParams;
  resetTrigger: number; // Increment to trigger reset
  viewMode: ViewMode;
  
  // Actions
  setIsPlaying: (isPlaying: boolean) => void;
  setParams: (params: Partial<SimulationParams>) => void;
  setPreset: (presetName: string) => void;
  resetSimulation: () => void;
  togglePlay: () => void;
  setViewMode: (mode: ViewMode) => void;
}

export const useStore = create<AppState>((set) => ({
  isPlaying: false,
  simulationType: SimulationType.DLA,
  params: PRESETS.organic.params,
  resetTrigger: 0,
  viewMode: 'particles',

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  
  setParams: (newParams) => set((state) => ({
    params: { ...state.params, ...newParams }
  })),

  setPreset: (presetName) => {
    const preset = PRESETS[presetName];
    if (preset) {
      set({ params: preset.params });
    }
  },

  resetSimulation: () => set((state) => ({ 
    resetTrigger: state.resetTrigger + 1,
    isPlaying: true,
    viewMode: 'particles' // Reset to particles on new sim
  })),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  setViewMode: (mode) => set({ viewMode: mode }),
}));