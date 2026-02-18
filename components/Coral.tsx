import React, { useEffect, useState, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import {
  BufferGeometry,
  Color,
  MeshBasicMaterial,
  WireframeGeometry,
  Vector3,
} from 'three';
import { MarchingCubes } from 'three-stdlib';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
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
    setFloorY,
    setFocusTarget,
  } = useStore();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [solidGeo, setSolidGeo] = useState<BufferGeometry | null>(null);
  const [wirePositions, setWirePositions] = useState<Float32Array | null>(null);

  const { size } = useThree();

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

    // Set floor at the bottom of branches (adjusted for capsule radius)
    setFloorY(minY - maxRadius);
    // Store world-space focus target (coral group is offset by [0, -15, 0])
    setFocusTarget([cx, cy - 15, cz], size / 2);

    return { center: new Vector3(cx, cy, cz), mcSize: size };
  }, [branches]);

  // ─── Line2 rendering: depth-tapered width + opacity fade ──────────────
  const lineObjects = useMemo(() => {
    if (branches.length === 0) return [];

    const maxDepth = branches.reduce((m, b) => Math.max(m, b.depth), 0);
    const byDepth = new Map<number, Branch[]>();
    for (const b of branches) {
      const arr = byDepth.get(b.depth);
      if (arr) arr.push(b);
      else byDepth.set(b.depth, [b]);
    }

    const baseColor = new Color(config.color);

    return Array.from(byDepth.entries()).map(([depth, bs]) => {
      const t = maxDepth > 0 ? depth / maxDepth : 0;

      const positions = new Float32Array(bs.length * 6);
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];
        const off = i * 6;
        positions[off]     = b.start.x;
        positions[off + 1] = b.start.y;
        positions[off + 2] = b.start.z;
        positions[off + 3] = b.end.x;
        positions[off + 4] = b.end.y;
        positions[off + 5] = b.end.z;
      }

      const geo = new LineSegmentsGeometry();
      geo.setPositions(positions);

      const linewidth = 4 - t * 3;     // 4px → 1px
      const opacity = 1.0 - t * 0.5;   // 1.0 → 0.5

      const mat = new LineMaterial({
        color: baseColor.getHex(),
        linewidth,
        opacity,
        transparent: true,
      });

      return new LineSegments2(geo, mat);
    });
  }, [branches, config.color]);

  // Update LineMaterial resolution on resize
  useEffect(() => {
    for (const obj of lineObjects) {
      (obj.material as LineMaterial).resolution.set(size.width, size.height);
    }
  }, [lineObjects, size.width, size.height]);

  // Dispose Line2 objects on change/unmount
  useEffect(() => {
    return () => {
      for (const obj of lineObjects) {
        obj.geometry.dispose();
        (obj.material as LineMaterial).dispose();
      }
    };
  }, [lineObjects]);

  // ─── Stage 2: Build welded mesh (triggered by Make 3D) ────────────────
  useEffect(() => {
    if (meshTrigger === 0 || branches.length === 0) {
      setSolidGeo(null);
      setWirePositions(null);
      setMeshGeometry(null);
      return;
    }

    // Shift branches so tree center is at grid origin
    const shiftedBranches: Branch[] = branches.map(b => ({
      ...b,
      start: b.start.clone().sub(center),
      end: b.end.clone().sub(center),
    }));

    // Convert thickness (0–100) to isolation: high thickness = low isolation = fatter mesh
    const INFLUENCE = 100;
    const isolation = 150 - config.mcThickness * 1.4; // 150 → 10

    // Scale resolution by bounding box so voxel density stays consistent
    // At reference size 20, slider value = actual resolution. Larger corals get more voxels.
    const REFERENCE_SIZE = 20;
    const actualResolution = Math.min(Math.round(config.mcResolution * mcSize / REFERENCE_SIZE), 350);

    // Create MC as a computation tool only (not rendered directly)
    const mc = new MarchingCubes(actualResolution, new MeshBasicMaterial(), true, true, 1200000);
    mc.reset();
    const field = (mc as any).field as Float32Array;

    fillDistanceField(shiftedBranches, field, actualResolution, mcSize, INFLUENCE);

    if (mc.blur) mc.blur(1);
    mc.isolation = isolation;
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

    // Build wireframe positions from final welded geometry
    const wireGeo = new WireframeGeometry(welded);
    const wireArr = wireGeo.attributes.position.array as Float32Array;
    setWirePositions(new Float32Array(wireArr));
    wireGeo.dispose();

    setSolidGeo(welded);
    setMeshGeometry(welded, 1); // already in world scale, no extra scaling needed

    // Dispose temporary objects
    if ((mc as any).geometry) (mc as any).geometry.dispose();
    cloned.dispose();
  }, [meshTrigger, config.mcResolution, config.mcThickness, config.params.noiseAmount, config.params.noiseScale]);

  // ─── Wireframe overlay (Line2 for thickness control) ─────────────────
  const wireObject = useMemo(() => {
    if (!wirePositions) return null;

    const geo = new LineSegmentsGeometry();
    geo.setPositions(wirePositions);

    const mat = new LineMaterial({
      color: new Color(config.edgeColor).getHex(),
      linewidth: config.edgeThickness,
      transparent: true,
      opacity: 0.6,
    });

    return new LineSegments2(geo, mat);
  }, [wirePositions, config.edgeColor, config.edgeThickness]);

  // Update wire resolution on resize
  useEffect(() => {
    if (wireObject) {
      (wireObject.material as LineMaterial).resolution.set(size.width, size.height);
    }
  }, [wireObject, size.width, size.height]);

  // Dispose wire on change/unmount
  useEffect(() => {
    return () => {
      if (wireObject) {
        wireObject.geometry.dispose();
        (wireObject.material as LineMaterial).dispose();
      }
    };
  }, [wireObject]);

  const hasMesh = meshTrigger > 0 && solidGeo !== null;

  return (
    <group>
      {/* Lines: visible when no mesh, or when mesh is toggled off */}
      {(!hasMesh || !showMesh) && lineObjects.map((line, i) => (
        <primitive key={i} object={line} />
      ))}

      {/* Solid mesh: rendered as a regular mesh with welded geometry */}
      {hasMesh && showMesh && solidGeo && (
        <group position={[center.x, center.y, center.z]}>
          <mesh geometry={solidGeo}>
            <CeramicMaterial
              color={config.color}
              useTexture={config.useTexture}
            />
          </mesh>

          {showWireframe && wireObject && (
            <primitive object={wireObject} />
          )}
        </group>
      )}
    </group>
  );
};
