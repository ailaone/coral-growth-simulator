export enum SimulationType {
  DLA = 'DLA',
  SpaceColonization = 'SpaceColonization' // Placeholder for future
}

export interface SimulationParams {
  speed: number;        // 1-10
  complexity: number;   // Max particles 1k - 100k
  branching: number;    // 0-1 (Affects noise/directionality)
  noise: number;        // 0-1 (Randomness in walker)
  
  // Growth Direction
  verticalBias: number;   // 0-1 (Influence on growing up)
  horizontalBias: number; // 0-1 (Influence on spreading out)

  // Rendering / Marching Cubes
  mcResolution: number;    // Grid resolution (32-200)
  mcIsolation: number;     // Threshold (10-200)
  mcPointInfluence: number; // Size/Influence of each particle (1-50)

  // Material
  color: string;          // Hex color
  useTexture: boolean;    // Toggle speckles
}

export interface Preset {
  name: string;
  params: SimulationParams;
}

export const PRESETS: Record<string, Preset> = {
  delicate: { 
    name: 'Delicate', 
    params: { 
      complexity: 25000, 
      branching: 0.85, 
      speed: 3, 
      noise: 0.3,
      verticalBias: 0.8,
      horizontalBias: 0.3,
      mcResolution: 128,
      mcIsolation: 80,
      mcPointInfluence: 10,
      color: '#EDE8DC',
      useTexture: true
    } 
  },
  dense: { 
    name: 'Dense', 
    params: { 
      complexity: 80000, 
      branching: 0.4, 
      speed: 10, 
      noise: 0.1,
      verticalBias: 0.6,
      horizontalBias: 0.6,
      mcResolution: 100,
      mcIsolation: 60,
      mcPointInfluence: 15,
      color: '#8B7E74',
      useTexture: true
    } 
  },
  minimal: { 
    name: 'Minimal', 
    params: { 
      complexity: 10000, 
      branching: 0.1, 
      speed: 2, 
      noise: 0.1,
      verticalBias: 0.9,
      horizontalBias: 0.1,
      mcResolution: 80,
      mcIsolation: 40,
      mcPointInfluence: 20,
      color: '#F5F5F0',
      useTexture: false
    } 
  },
  organic: { 
    name: 'Organic', 
    params: { 
      complexity: 45000, 
      branching: 0.65, 
      speed: 6, 
      noise: 0.5,
      verticalBias: 0.7,
      horizontalBias: 0.5,
      mcResolution: 140,
      mcIsolation: 90,
      mcPointInfluence: 8,
      color: '#E6E2D3',
      useTexture: true
    } 
  },
};