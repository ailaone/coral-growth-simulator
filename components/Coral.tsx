import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, MeshBasicMaterial, MeshStandardMaterial, EdgesGeometry, LineSegments, LineBasicMaterial, BufferGeometry } from 'three';
import { MarchingCubes } from 'three-stdlib';
import { useStore } from '../store';
import { CeramicMaterial } from './CeramicMaterial';
import { GrowthState } from '../simulation/common';
import { GrowthStrategy } from '../simulation/types';
import { MC_SIZE, VISUAL_RADIUS, getHash } from '../simulation/common';
import { staghornStrategy } from '../simulation/staghorn';
import { brainStrategy } from '../simulation/brain';
import { foxStrategy } from '../simulation/fox';

const dummy = new Object3D();

const STRATEGIES: Record<string, GrowthStrategy> = {
  staghorn: staghornStrategy,
  brain: brainStrategy,
  fox: foxStrategy,
};

const MAX_PARTICLES = 100000;

export const Coral: React.FC = () => {
  const meshRef = useRef<InstancedMesh>(null);
  const edgesRef = useRef<LineSegments>(null);
  const edgesGeoRef = useRef<EdgesGeometry | null>(null);
  const { isPlaying, preset, resetTrigger, viewMode, showWireframe } = useStore();

  const edgeMaterial = useMemo(() => new LineBasicMaterial({ color: 0x000000, opacity: 0.3, transparent: true }), []);

  // Simulation state refs
  const stateRef = useRef<GrowthState>({
    positions: new Float32Array(MAX_PARTICLES * 3),
    count: 0,
    grid: new Set(),
    maxParticles: MAX_PARTICLES,
  });

  // Marching Cubes
  const mcMesh = useMemo(() => {
    return new MarchingCubes(preset.mcResolution, new MeshBasicMaterial({ color: 0x000000 }), true, true, 800000);
  }, [preset.mcResolution]);

  useEffect(() => {
    return () => {
      // @ts-ignore
      if (mcMesh.geometry) mcMesh.geometry.dispose();
      if (edgesGeoRef.current) edgesGeoRef.current.dispose();
    };
  }, [mcMesh]);

  // Initialize simulation
  const initSimulation = () => {
    if (!meshRef.current) return;

    const state = stateRef.current;
    state.count = 0;
    state.grid.clear();
    state.positions.fill(0);
    state.maxParticles = preset.params.maxParticles ?? 30000;

    const strategy = STRATEGIES[preset.strategy];
    if (!strategy) return;

    // Place seed particles from strategy
    const seeds = strategy.init(preset.params);
    for (const [x, y, z] of seeds) {
      const idx = state.count;
      state.positions[idx * 3] = x;
      state.positions[idx * 3 + 1] = y;
      state.positions[idx * 3 + 2] = z;
      state.grid.add(getHash(x, y, z));
      state.count++;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(idx, dummy.matrix);
    }

    // Clear remaining instances
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = state.count; i < MAX_PARTICLES; i++) {
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.count = MAX_PARTICLES;

    if (mcMesh) mcMesh.reset();
  };

  useEffect(() => {
    initSimulation();
  }, [resetTrigger]);

  // Solid mesh generation (unchanged logic)
  const updateSolidMesh = () => {
    if (!mcMesh || stateRef.current.count < 2) return;

    mcMesh.reset();
    const field = (mcMesh as any).field as Float32Array;
    const strength = preset.mcPointInfluence;
    const resolution = preset.mcResolution;
    const halfSize = MC_SIZE / 2;
    const factor = resolution / MC_SIZE;

    field.fill(0);

    const count = stateRef.current.count;
    const pos = stateRef.current.positions;
    const limit = resolution - 1;

    for (let i = 0; i < count; i++) {
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];

      const gx = Math.floor((x + halfSize) * factor);
      const gy = Math.floor((y + halfSize) * factor);
      const gz = Math.floor((z + halfSize) * factor);

      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dz = -2; dz <= 2; dz++) {
            const ix = gx + dx;
            const iy = gy + dy;
            const iz = gz + dz;
            if (ix >= 0 && ix < limit && iy >= 0 && iy < limit && iz >= 0 && iz < limit) {
              const idx = ix + (iy * resolution) + (iz * resolution * resolution);
              const distSq = dx * dx + dy * dy + dz * dz;
              field[idx] += strength * Math.exp(-distSq * 0.5);
            }
          }
        }
      }
    }

    if (mcMesh.blur) mcMesh.blur(2);
    mcMesh.isolation = preset.mcIsolation;
    mcMesh.update();

    // Rebuild edges geometry from the updated marching cubes mesh
    if (edgesRef.current) {
      if (edgesGeoRef.current) edgesGeoRef.current.dispose();
      const srcGeo = (mcMesh as any).geometry as BufferGeometry;
      if (srcGeo && srcGeo.attributes.position && srcGeo.attributes.position.count > 0) {
        edgesGeoRef.current = new EdgesGeometry(srcGeo, 30);
        edgesRef.current.geometry = edgesGeoRef.current;
      }
    }
  };

  useEffect(() => {
    if (viewMode === 'solid') {
      const timeout = setTimeout(() => updateSolidMesh(), 50);
      return () => clearTimeout(timeout);
    }
  }, [viewMode, preset.mcIsolation, preset.mcPointInfluence, preset.mcResolution, isPlaying]);

  // Growth loop — dispatch to active strategy
  useFrame(() => {
    if (!isPlaying || !meshRef.current) return;

    const state = stateRef.current;
    if (state.count >= state.maxParticles) return;

    const strategy = STRATEGIES[preset.strategy];
    if (!strategy) return;

    const iterations = Math.floor((preset.params.speed ?? 5) * 25);
    const prevCount = state.count;

    const result = strategy.grow(state, preset.params, iterations);

    // Update instanced mesh for newly added particles
    if (result.addedPositions.length > 0) {
      for (let i = 0; i < result.addedPositions.length; i++) {
        const idx = prevCount + i;
        const [x, y, z] = result.addedPositions[i];
        dummy.position.set(x, y, z);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        dummy.scale.setScalar(0.8 + Math.random() * 0.4);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(idx, dummy.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
      meshRef.current.count = state.count;
    }
  });

  return (
    <group>
      <instancedMesh
        visible={viewMode === 'particles'}
        ref={meshRef}
        args={[undefined, undefined, MAX_PARTICLES]}
        frustumCulled={false}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[VISUAL_RADIUS, 16, 16]} />
        <CeramicMaterial color={preset.color} useTexture={preset.useTexture} />
      </instancedMesh>

      <primitive
        visible={viewMode === 'solid'}
        object={mcMesh}
        scale={[MC_SIZE / 2, MC_SIZE / 2, MC_SIZE / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          attach="material"
          color={preset.color}
          roughness={0.6}
          metalness={0.0}
          flatShading={true}
        />
      </primitive>

      {/* Edge overlay on solid mesh */}
      <lineSegments
        ref={edgesRef}
        visible={viewMode === 'solid' && showWireframe}
        scale={[MC_SIZE / 2, MC_SIZE / 2, MC_SIZE / 2]}
        material={edgeMaterial}
      >
        <bufferGeometry />
      </lineSegments>
    </group>
  );
};
