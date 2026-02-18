import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  MeshBasicMaterial,
  EdgesGeometry,
  LineSegments as ThreeLineSegments,
  Vector3,
} from 'three';
import { MarchingCubes } from 'three-stdlib';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useStore } from '../store';
import { CeramicMaterial } from './CeramicMaterial';
import { generateTree, fillDistanceField, displaceVertices, Branch } from '../simulation/lsystem';

export const Coral: React.FC = () => {
  const {
    config,
    resetTrigger,
    meshTrigger,
    showWireframe,
    showMesh,
    setMeshGeometry,
  } = useStore();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [solidGeo, setSolidGeo] = useState<BufferGeometry | null>(null);
  const edgesRef = useRef<ThreeLineSegments>(null);
  const edgesGeoRef = useRef<EdgesGeometry | null>(null);

  const edgeMaterial = useMemo(
    () => new LineBasicMaterial({ color: 0x000000, opacity: 0.3, transparent: true }),
    []
  );

  // ─── Stage 1: Generate tree on Run ─────────────────────────────────────
  useEffect(() => {
    setBranches(generateTree(config.params));
    setSolidGeo(null);
  }, [resetTrigger]);

  // Compute bounding box and grid sizing from branches
  const { center, mcSize } = useMemo(() => {
    if (branches.length === 0) return { center: new Vector3(), mcSize: 30 };

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let maxRadius = 0;

    for (const b of branches) {
      for (const p of [b.start, b.end]) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
      }
      if (b.radius > maxRadius) maxRadius = b.radius;
    }

    const pad = maxRadius * 3;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ) + pad * 2;

    return { center: new Vector3(cx, cy, cz), mcSize: size };
  }, [branches]);

  // Line geometry from branches
  const lineGeometry = useMemo(() => {
    const geo = new BufferGeometry();
    if (branches.length === 0) return geo;

    const positions = new Float32Array(branches.length * 6);
    for (let i = 0; i < branches.length; i++) {
      const b = branches[i];
      const off = i * 6;
      positions[off] = b.start.x;
      positions[off + 1] = b.start.y;
      positions[off + 2] = b.start.z;
      positions[off + 3] = b.end.x;
      positions[off + 4] = b.end.y;
      positions[off + 5] = b.end.z;
    }

    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return geo;
  }, [branches]);

  const lineMaterial = useMemo(
    () => new LineBasicMaterial({ color: config.color }),
    [config.color]
  );

  // ─── Stage 2: Build welded mesh (triggered by Make 3D) ────────────────
  useEffect(() => {
    if (meshTrigger === 0 || branches.length === 0) {
      setSolidGeo(null);
      setMeshGeometry(null);
      return;
    }

    // Shift branches so tree center is at grid origin
    const shiftedBranches: Branch[] = branches.map(b => ({
      ...b,
      start: b.start.clone().sub(center),
      end: b.end.clone().sub(center),
    }));

    // Create MC as a computation tool only (not rendered directly)
    const mc = new MarchingCubes(config.mcResolution, new MeshBasicMaterial(), true, true, 800000);
    mc.reset();
    const field = (mc as any).field as Float32Array;

    fillDistanceField(shiftedBranches, field, config.mcResolution, mcSize, config.mcPointInfluence);

    if (mc.blur) mc.blur(1);
    mc.isolation = config.mcIsolation;
    mc.update();

    const rawGeo = (mc as any).geometry as BufferGeometry;
    if (!rawGeo || !rawGeo.attributes.position || rawGeo.attributes.position.count === 0) {
      setSolidGeo(null);
      setMeshGeometry(null);
      if ((mc as any).geometry) (mc as any).geometry.dispose();
      return;
    }

    // 1. Clone the raw MC output (triangle soup)
    const cloned = rawGeo.clone();

    // 2. Weld vertices FIRST (while positions are still coincident)
    const welded = mergeVertices(cloned, 0.0001);
    welded.computeVertexNormals();

    // 3. Displace AFTER welding (shared vertices now have averaged normals)
    const positions = welded.attributes.position.array as Float32Array;
    const normals = welded.attributes.normal.array as Float32Array;
    displaceVertices(positions, normals, config.params.noiseAmount, config.params.noiseScale, mcSize);
    welded.attributes.position.needsUpdate = true;
    welded.computeVertexNormals();

    // Scale from MC normalized [-1,1] space to world size
    const halfMC = mcSize / 2;
    for (let i = 0; i < positions.length; i++) {
      positions[i] *= halfMC;
    }
    welded.attributes.position.needsUpdate = true;
    welded.computeBoundingSphere();
    welded.computeBoundingBox();

    setSolidGeo(welded);
    setMeshGeometry(welded, 1); // already in world scale, no extra scaling needed

    // Rebuild edges from welded geometry
    if (edgesRef.current) {
      if (edgesGeoRef.current) edgesGeoRef.current.dispose();
      edgesGeoRef.current = new EdgesGeometry(welded, 30);
      edgesRef.current.geometry = edgesGeoRef.current;
    }

    // Dispose temporary objects
    if ((mc as any).geometry) (mc as any).geometry.dispose();
    cloned.dispose();
  }, [meshTrigger, config.mcResolution, config.mcIsolation, config.mcPointInfluence, config.params.noiseAmount, config.params.noiseScale]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (edgesGeoRef.current) edgesGeoRef.current.dispose();
    };
  }, []);

  const hasMesh = meshTrigger > 0 && solidGeo !== null;

  return (
    <group>
      {/* Lines: visible when no mesh, or when mesh is toggled off */}
      {(!hasMesh || !showMesh) && (
        <lineSegments geometry={lineGeometry} material={lineMaterial} />
      )}

      {/* Solid mesh: rendered as a regular mesh with welded geometry */}
      {hasMesh && showMesh && solidGeo && (
        <group position={[center.x, center.y, center.z]}>
          <mesh geometry={solidGeo} castShadow receiveShadow>
            <CeramicMaterial
              color={config.color}
              useTexture={config.useTexture}
            />
          </mesh>

          <lineSegments
            ref={edgesRef}
            visible={showWireframe}
            material={edgeMaterial}
          >
            <bufferGeometry />
          </lineSegments>
        </group>
      )}
    </group>
  );
};
