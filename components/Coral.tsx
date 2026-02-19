import React, { useEffect, useState, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import {
  BufferAttribute,
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
import { generateTreeClassic, generateTreeKitaoka, fillDistanceField, fillJunctionSpheres, displaceVertices, Branch } from '../simulation/lsystem';

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
    const params = config.coralType === 1 ? config.paramsV1 : config.paramsV2;
    const generate = config.coralType === 1 ? generateTreeClassic : generateTreeKitaoka;
    setBranches(generate(params));
    setSolidGeo(null);
  }, [resetTrigger]);

  // Compute bounding box and grid sizing from branches
  const bounds = useMemo(() => {
    if (branches.length === 0) return { center: new Vector3(), mcSize: 30, floorY: 0 };

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
      const br = Math.max(b.startRadius, b.endRadius);
      if (br > maxRadius) maxRadius = br;
    }

    const pad = maxRadius * 4;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ) + pad * 2;

    return { center: new Vector3(cx, cy, cz), mcSize: size, floorY: minY - maxRadius };
  }, [branches]);

  const { center, mcSize } = bounds;

  // Push focus target to store in an effect (not during render)
  useEffect(() => {
    if (branches.length === 0) return;
    setFloorY(bounds.floorY);
    setFocusTarget([bounds.center.x, bounds.center.y - 15, bounds.center.z], bounds.mcSize / 2);
  }, [bounds]);

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
        color: 0x000000,
        linewidth,
        opacity,
        transparent: true,
      });

      return new LineSegments2(geo, mat);
    });
  }, [branches]);

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

  // Dispose old solid geometry when it changes
  useEffect(() => {
    return () => {
      if (solidGeo) solidGeo.dispose();
    };
  }, [solidGeo]);

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
    const actualResolution = Math.min(Math.round(config.mcResolution * mcSize / REFERENCE_SIZE), 280);

    // maxPolyCount is in VERTICES (not triangles). Buffer = maxPolyCount * 3 floats.
    // Scale with resolution to prevent buffer overflow that creates flat-plane artifacts.
    const maxPolyCount = Math.max(5000000, actualResolution * actualResolution * 30);

    // Create MC as a computation tool only (not rendered directly)
    const mc = new MarchingCubes(actualResolution, new MeshBasicMaterial(), true, true, maxPolyCount);
    mc.reset();
    const field = (mc as any).field as Float32Array;

    fillDistanceField(shiftedBranches, field, actualResolution, mcSize, INFLUENCE);
    fillJunctionSpheres(shiftedBranches, field, actualResolution, mcSize, INFLUENCE, config.blobiness);

    if (mc.blur) mc.blur(1);

    mc.isolation = isolation;
    mc.update();

    // Extract only the valid vertices (MC buffer is much larger than actual output)
    const mcCount = (mc as any).count as number;
    const rawGeo = (mc as any).geometry as BufferGeometry;
    if (!rawGeo || mcCount === 0) {
      setSolidGeo(null);
      setMeshGeometry(null);
      if ((mc as any).geometry) (mc as any).geometry.dispose();
      return;
    }

    // 1. Trim MC output to actual vertex count (buffer has millions of unused zeros)
    const trimmedGeo = new BufferGeometry();
    trimmedGeo.setAttribute('position', new BufferAttribute(
      (rawGeo.attributes.position.array as Float32Array).slice(0, mcCount * 3), 3
    ));
    trimmedGeo.setAttribute('normal', new BufferAttribute(
      (rawGeo.attributes.normal.array as Float32Array).slice(0, mcCount * 3), 3
    ));

    // 2. Weld vertices (while positions are still coincident)
    const welded = mergeVertices(trimmedGeo, 0.0001);
    welded.computeVertexNormals();

    // 3. Scale from MC normalized [-1,1] space to world size
    const positions = welded.attributes.position.array as Float32Array;
    const halfMC = mcSize / 2;
    for (let i = 0; i < positions.length; i++) {
      positions[i] *= halfMC;
    }
    welded.attributes.position.needsUpdate = true;

    // 4. Noise displacement (in world space)
    welded.computeVertexNormals();
    if (config.noiseAmount > 0) {
      const normals = welded.attributes.normal.array as Float32Array;
      const voxelWorldSize = mcSize / actualResolution;
      displaceVertices(positions, normals, config.noiseAmount, config.noiseScale, voxelWorldSize);
      welded.attributes.position.needsUpdate = true;
    }

    // 5. Laplacian smoothing (after noise — smooths out the texture)
    const smoothIters = Math.round(config.smoothing);
    if (smoothIters > 0 && welded.index) {
      const idx = welded.index.array;
      const vtxCount = positions.length / 3;

      // Build adjacency from index buffer
      const neighbors: Uint32Array[] = new Array(vtxCount);
      const neighborCounts = new Uint32Array(vtxCount);

      // First pass: count neighbors
      for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i], b = idx[i + 1], c = idx[i + 2];
        neighborCounts[a] += 2; neighborCounts[b] += 2; neighborCounts[c] += 2;
      }
      for (let i = 0; i < vtxCount; i++) {
        neighbors[i] = new Uint32Array(neighborCounts[i]);
        neighborCounts[i] = 0;
      }

      // Second pass: fill neighbors (may have duplicates, that's fine for averaging)
      for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i], b = idx[i + 1], c = idx[i + 2];
        neighbors[a][neighborCounts[a]++] = b; neighbors[a][neighborCounts[a]++] = c;
        neighbors[b][neighborCounts[b]++] = a; neighbors[b][neighborCounts[b]++] = c;
        neighbors[c][neighborCounts[c]++] = a; neighbors[c][neighborCounts[c]++] = b;
      }

      const temp = new Float32Array(positions.length);
      for (let iter = 0; iter < smoothIters; iter++) {
        for (let i = 0; i < vtxCount; i++) {
          const ns = neighbors[i];
          const count = neighborCounts[i];
          if (count === 0) {
            temp[i * 3] = positions[i * 3];
            temp[i * 3 + 1] = positions[i * 3 + 1];
            temp[i * 3 + 2] = positions[i * 3 + 2];
            continue;
          }
          let sx = 0, sy = 0, sz = 0;
          for (let j = 0; j < count; j++) {
            const ni = ns[j];
            sx += positions[ni * 3];
            sy += positions[ni * 3 + 1];
            sz += positions[ni * 3 + 2];
          }
          // Lambda = 0.5: blend halfway toward neighbor average
          temp[i * 3]     = positions[i * 3]     * 0.5 + (sx / count) * 0.5;
          temp[i * 3 + 1] = positions[i * 3 + 1] * 0.5 + (sy / count) * 0.5;
          temp[i * 3 + 2] = positions[i * 3 + 2] * 0.5 + (sz / count) * 0.5;
        }
        positions.set(temp);
      }
      welded.attributes.position.needsUpdate = true;
    }

    // 6. Ground plane clip: only flatten the stump bottom, not branches that dip below.
    // Stump is at (0,0,0) in original coords → (-center.x, -center.y, -center.z) in shifted.
    const baseY = -center.y;
    const stumpX = -center.x;
    const stumpZ = -center.z;
    const activeParams = config.coralType === 1 ? config.paramsV1 : config.paramsV2;
    const clipRadius = (activeParams.trunkThickness || 1) * 3;
    const clipRadiusSq = clipRadius * clipRadius;
    for (let i = 0; i < positions.length / 3; i++) {
      if (positions[i * 3 + 1] < baseY) {
        const dx = positions[i * 3] - stumpX;
        const dz = positions[i * 3 + 2] - stumpZ;
        if (dx * dx + dz * dz < clipRadiusSq) {
          positions[i * 3 + 1] = baseY;
        }
      }
    }
    welded.attributes.position.needsUpdate = true;

    // Final normals and bounds
    welded.computeVertexNormals();
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
    trimmedGeo.dispose();
  }, [meshTrigger, config.mcResolution, config.mcThickness, config.blobiness, config.smoothing, config.noiseAmount, config.noiseScale]);

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
