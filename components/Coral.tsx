import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Vector3, MeshBasicMaterial } from 'three';
import { MarchingCubes } from 'three-stdlib';
import { useStore } from '../store';
import { CeramicMaterial } from './CeramicMaterial';

const dummy = new Object3D();
const tempVec = new Vector3();

// Simulation Constants
const SIM_RADIUS = 0.35;
const VISUAL_RADIUS = 0.9;
const CELL_SIZE = SIM_RADIUS * 3; 
const MC_SIZE = 120; // Bounding box size 

const getHash = (x: number, y: number, z: number) => {
  return `${Math.round(x / CELL_SIZE)},${Math.round(y / CELL_SIZE)},${Math.round(z / CELL_SIZE)}`;
};

export const Coral: React.FC = () => {
  const meshRef = useRef<InstancedMesh>(null);
  const { isPlaying, params, resetTrigger, viewMode } = useStore();
  
  // Simulation State
  const countRef = useRef(1);
  const positionsRef = useRef<Float32Array>(new Float32Array(100000 * 3));
  const gridRef = useRef<Set<string>>(new Set());
  
  // Stable Marching Cubes Instance
  // Re-create only when resolution changes
  const mcMesh = useMemo(() => {
    // Max poly count increased to support high res
    return new MarchingCubes(params.mcResolution, new MeshBasicMaterial({ color: 0x000000 }), true, true, 800000);
  }, [params.mcResolution]);

  // Clean up
  useEffect(() => {
    return () => {
        // @ts-ignore
        if (mcMesh.geometry) mcMesh.geometry.dispose();
    }
  }, [mcMesh]);

  // Initialize Simulation
  const initSimulation = () => {
    if (!meshRef.current) return;
    
    countRef.current = 1;
    gridRef.current.clear();
    positionsRef.current.fill(0);
    
    // Seed at origin (Ground level)
    positionsRef.current[0] = 0;
    positionsRef.current[1] = 0;
    positionsRef.current[2] = 0;
    gridRef.current.add(getHash(0, 0, 0));
    
    // Reset Instanced Mesh
    dummy.position.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.rotation.set(0,0,0);
    dummy.updateMatrix();
    meshRef.current.setMatrixAt(0, dummy.matrix);
    
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 1; i < params.complexity; i++) {
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.count = params.complexity;

    // Reset Marching Cubes
    if (mcMesh) {
        mcMesh.reset();
    }
  };

  useEffect(() => {
    initSimulation();
  }, [resetTrigger]);

  // Generate Solid Mesh (Shrinkwrap)
  const updateSolidMesh = () => {
    if (!mcMesh || countRef.current < 2) return;

    mcMesh.reset();

    const field = (mcMesh as any).field as Float32Array; 
    
    const strength = params.mcPointInfluence; 
    const resolution = params.mcResolution;
    
    // Helper to map world to grid
    const halfSize = MC_SIZE / 2;
    const factor = resolution / MC_SIZE;
    
    field.fill(0);

    const count = countRef.current;
    const pos = positionsRef.current;
    
    const limit = resolution - 1;

    // Optimization: Don't recalculate everything if particle count is huge
    // Only loop up to current count
    for (let i = 0; i < count; i++) {
        const x = pos[i * 3];
        const y = pos[i * 3 + 1];
        const z = pos[i * 3 + 2];

        // Map to Grid Coords
        const gx = Math.floor((x + halfSize) * factor);
        const gy = Math.floor((y + halfSize) * factor);
        const gz = Math.floor((z + halfSize) * factor);

        // Splat kernel - slightly wider reach for smoothness
        // 2-voxel radius search
        for(let dx = -2; dx <= 2; dx++) {
            for(let dy = -2; dy <= 2; dy++) {
                for(let dz = -2; dz <= 2; dz++) {
                     const ix = gx + dx;
                     const iy = gy + dy;
                     const iz = gz + dz;

                     if (ix >= 0 && ix < limit && iy >= 0 && iy < limit && iz >= 0 && iz < limit) {
                         const idx = ix + (iy * resolution) + (iz * resolution * resolution);
                         const distSq = dx*dx + dy*dy + dz*dz;
                         // Gaussian falloff
                         field[idx] += strength * Math.exp(-distSq * 0.5);
                     }
                }
            }
        }
    }

    // Optional blur to smooth edges further
    if (mcMesh.blur) {
       mcMesh.blur(2); 
    }

    mcMesh.isolation = params.mcIsolation; 
    mcMesh.update();
  };

  // Trigger solid generation when switching view modes or when parameters change
  // We debounce slightly or just run it. For 100k particles it might hitch.
  useEffect(() => {
    if (viewMode === 'solid') {
        const timeout = setTimeout(() => updateSolidMesh(), 50);
        return () => clearTimeout(timeout);
    }
  }, [viewMode, params.mcIsolation, params.mcPointInfluence, params.mcResolution, isPlaying]);


  // Growth Loop
  useFrame(() => {
    if (!isPlaying || !meshRef.current) return;
    
    if (countRef.current >= params.complexity) return;

    // ... (DLA Logic) ...
    const iterations = Math.floor(params.speed * 25); 
    let addedCount = 0;
    const maxParticles = params.complexity;
    const noiseFactor = params.noise * 0.8; 
    const growthStep = SIM_RADIUS * 2.0; 

    for (let i = 0; i < iterations; i++) {
      if (countRef.current >= maxParticles) break;

      let parentIndex: number;
      if (Math.random() < params.branching) {
        // Bias towards newer particles (tips)
        const window = Math.max(1, Math.floor(countRef.current * 0.15));
        parentIndex = countRef.current - 1 - Math.floor(Math.random() * window);
      } else {
        parentIndex = Math.floor(Math.random() * countRef.current);
      }
      parentIndex = Math.max(0, parentIndex);

      const px = positionsRef.current[parentIndex * 3];
      const py = positionsRef.current[parentIndex * 3 + 1];
      const pz = positionsRef.current[parentIndex * 3 + 2];

      // --- DIRECTIONAL GROWTH LOGIC ---

      // 1. Start with a random direction unit vector on sphere
      let dirX = (Math.random() - 0.5) * 2;
      let dirY = (Math.random() - 0.5) * 2;
      let dirZ = (Math.random() - 0.5) * 2;

      // 2. Apply Vertical Bias
      // params.verticalBias (0-1). 
      // 0 = random Y, 0.5 = moderate up, 1.0 = strong up
      // We add to the Y component to bias it upwards.
      dirY += params.verticalBias * 2.5; 

      // 3. Apply Horizontal Bias
      // params.horizontalBias (0-1).
      // 0 = narrow, 1 = wide spread.
      // We multiply X and Z to increase their influence relative to Y.
      dirX *= (0.5 + params.horizontalBias * 2.0);
      dirZ *= (0.5 + params.horizontalBias * 2.0);

      // 4. Add Random Noise from params
      dirX += (Math.random() - 0.5) * noiseFactor;
      dirY += (Math.random() - 0.5) * noiseFactor;
      dirZ += (Math.random() - 0.5) * noiseFactor;
      
      // 5. Normalize and Scale
      tempVec.set(dirX, dirY, dirZ).normalize().multiplyScalar(growthStep);
      
      const cx = px + tempVec.x;
      const cy = py + tempVec.y;
      const cz = pz + tempVec.z;
      
      // STRICT GROUND CONSTRAINT
      // If we try to go below floor, reject this attempt.
      if (cy < 0) continue; 
      
      const hash = getHash(cx, cy, cz);
      
      if (!gridRef.current.has(hash)) {
        const idx = countRef.current;
        positionsRef.current[idx * 3] = cx;
        positionsRef.current[idx * 3 + 1] = cy;
        positionsRef.current[idx * 3 + 2] = cz;
        
        gridRef.current.add(hash);
        
        // Update Particle Mesh
        dummy.position.set(cx, cy, cz);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        const scaleNoise = 0.8 + Math.random() * 0.4;
        dummy.scale.setScalar(scaleNoise);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(idx, dummy.matrix);
        
        countRef.current++;
        addedCount++;
      }
    }

    if (addedCount > 0) {
      meshRef.current.instanceMatrix.needsUpdate = true;
      meshRef.current.count = countRef.current;
    }
  });

  return (
    <group>
        {/* Particle View */}
        <instancedMesh
            visible={viewMode === 'particles'}
            ref={meshRef}
            args={[undefined, undefined, 100000]}
            frustumCulled={false}
            castShadow
            receiveShadow
        >
            <sphereGeometry args={[VISUAL_RADIUS, 16, 16]} />
            <CeramicMaterial color={params.color} useTexture={params.useTexture} />
        </instancedMesh>

        {/* Solid View (Marching Cubes) */}
        {/* We reuse the stable mcMesh object */}
        <primitive 
            visible={viewMode === 'solid'}
            object={mcMesh} 
            scale={[MC_SIZE/2, MC_SIZE/2, MC_SIZE/2]} // Scale MC box to match world coordinates
            castShadow
            receiveShadow
        >
           <CeramicMaterial attach="material" color={params.color} useTexture={params.useTexture} />
        </primitive>
    </group>
  );
};