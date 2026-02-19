import { Vector3 } from 'three';

// ─── Constants ────────────────────────────────────────────────────────────────
export const MC_SIZE = 120;
export const VISUAL_RADIUS = 0.9;

// ─── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Branch data ──────────────────────────────────────────────────────────────
export interface Branch {
  start: Vector3;
  end: Vector3;
  startRadius: number;  // radius at start (matches parent's end for smooth taper)
  endRadius: number;    // radius at end (this branch's computed radius)
  depth: number;
}

// ─── Classic tree generation (Type 1) ────────────────────────────────────────
// Original L-system with fixed branch angle, taper, and generation-based depth.
export function generateTreeClassic(params: Record<string, number>): Branch[] {
  const {
    generations = 4,
    branchAngle = 35,
    branchLength = 0.65,
    seed = 42,
    trunkThickness = 1,
    taper = 0.6,
    anastomosis = 0.3,
  } = params;

  const rand = mulberry32(seed);
  const branches: Branch[] = [];
  const angleRad = (branchAngle * Math.PI) / 180;

  const primaryLen = branchLength * 8;
  const stumpHeight = primaryLen * 0.15;

  function recurse(
    origin: Vector3,
    direction: Vector3,
    length: number,
    parentRadius: number,
    radius: number,
    depth: number,
  ) {
    const end = origin.clone().add(direction.clone().multiplyScalar(length));
    branches.push({ start: origin.clone(), end: end.clone(), startRadius: parentRadius, endRadius: radius, depth });

    if (depth >= generations) return;

    const childCount = rand() < 0.5 ? 2 : 3;

    for (let c = 0; c < childCount; c++) {
      const perp = randomPerpendicular(direction, rand);
      const azimuth = rand() * Math.PI * 2;
      const rotatedPerp = rotateAround(perp, direction, azimuth);
      const childDir = rotateAround(direction, rotatedPerp, angleRad * (0.8 + rand() * 0.4));
      childDir.normalize();

      const childLength = length * branchLength * (0.5 + rand() * 1.0);
      const childRadius = radius * taper;

      recurse(end, childDir, childLength, radius, childRadius, depth + 1);
    }
  }

  const base = new Vector3(0, 0, 0);
  const stumpTop = new Vector3(0, stumpHeight, 0);

  branches.push({ start: base.clone(), end: stumpTop.clone(), startRadius: trunkThickness, endRadius: trunkThickness, depth: 0 });

  const primaryCount = 5 + Math.floor(rand() * 3);
  const jitterRadius = stumpHeight * 0.3;

  for (let i = 0; i < primaryCount; i++) {
    const azimuth = (i / primaryCount) * Math.PI * 2 + (rand() - 0.5) * 0.6;
    const fanAngle = angleRad * (1.2 + rand() * 1.0);

    const dir = new Vector3(
      Math.sin(fanAngle) * Math.cos(azimuth),
      Math.cos(fanAngle),
      Math.sin(fanAngle) * Math.sin(azimuth),
    ).normalize();

    const startPos = stumpTop.clone().add(
      new Vector3(
        Math.cos(azimuth) * jitterRadius,
        (rand() - 0.5) * jitterRadius * 0.5,
        Math.sin(azimuth) * jitterRadius,
      )
    );

    const len = primaryLen * (0.7 + rand() * 0.6);
    const primaryRadius = trunkThickness * (0.6 + rand() * 0.3);

    recurse(startPos, dir, len, trunkThickness, primaryRadius, 1);
  }

  if (anastomosis > 0) {
    const fusionDist = primaryLen * 0.4;
    const nodes: { pos: Vector3; radius: number; depth: number }[] = [];

    for (const b of branches) {
      nodes.push({ pos: b.start, radius: b.startRadius, depth: b.depth });
    }

    const fused = new Set<number>();

    for (let i = 0; i < nodes.length; i++) {
      if (fused.has(i)) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        if (fused.has(j)) continue;
        const dist = nodes[i].pos.distanceTo(nodes[j].pos);
        if (dist < 0.5 || dist > fusionDist) continue;

        const avgDepth = (nodes[i].depth + nodes[j].depth) / 2;
        const depthFactor = 1 - (avgDepth / generations);
        const chance = anastomosis * depthFactor * depthFactor;

        if (rand() < chance) {
          const fusedR = Math.min(nodes[i].radius, nodes[j].radius);
          branches.push({
            start: nodes[i].pos.clone(),
            end: nodes[j].pos.clone(),
            startRadius: fusedR,
            endRadius: fusedR,
            depth: Math.max(nodes[i].depth, nodes[j].depth),
          });
          fused.add(i);
          fused.add(j);
          break;
        }
      }
    }
  }

  return branches;
}

// ─── Kamiya's angle-flow equation (Eq. 6 from Kitaoka et al. 1999) ───────────
// Given a flow fraction f for one daughter (relative to parent),
// returns the branching angle (radians) from the parent direction.
// Derived from minimizing total bifurcation volume (Kamiya et al. 1974).
function kamiyaAngle(f: number, n: number): number {
  const e = 4 / n;  // exponent ratio
  const e2 = 2 / n;
  const fE = Math.pow(f, e);
  const fE2 = Math.pow(f, e2);
  const oneMinusFE = Math.pow(1 - f, e);
  // cos(θ) = [1 + f^(4/n) - (1-f)^(4/n)] / [2 · f^(2/n)]
  const cosTheta = (1 + fE - oneMinusFE) / (2 * fE2);
  // Clamp to [-1, 1] for numerical safety
  return Math.acos(Math.max(-1, Math.min(1, cosTheta)));
}

// ─── Kitaoka-inspired tree generation (Type 2) ──────────────────────────────
// Uses Murray's law for diameter sizing, Kamiya's equations for branching
// angles, 90° branching plane rotation, and flow-based termination.
export function generateTreeKitaoka(params: Record<string, number>): Branch[] {
  const {
    density = 4,
    diameterExponent = 2.8,
    asymmetry = 0.15,
    branchLength = 3.0,
    seed = 42,
    trunkThickness = 1,
    anastomosis = 0.3,
  } = params;

  const rand = mulberry32(seed);
  const branches: Branch[] = [];
  const n = diameterExponent;
  const MAX_DEPTH = 20;

  // Flow threshold: density controls how deep branches go
  // density=2 → threshold=0.25 (~3 levels), density=6 → threshold=0.015 (~7 levels)
  const flowThreshold = Math.pow(2, -density);

  // Primary branch base length (scales with trunk thickness for consistent proportions)
  const primaryLen = trunkThickness * branchLength * 2.5;
  const stumpHeight = primaryLen * 0.15;

  function recurse(
    origin: Vector3,
    direction: Vector3,
    parentRadius: number,
    radius: number,
    depth: number,
    flow: number,
    planeNormal: Vector3,  // normal of the current branching plane
  ) {
    // Length from Kitaoka's length-to-diameter ratio (with jitter)
    const length = radius * branchLength * (0.7 + rand() * 0.6);
    const end = origin.clone().add(direction.clone().multiplyScalar(length));
    branches.push({ start: origin.clone(), end: end.clone(), startRadius: parentRadius, endRadius: radius, depth });

    // Flow-based termination (Kitaoka Rule 9) + safety depth cap
    if (flow < flowThreshold || depth >= MAX_DEPTH) return;

    const childCount = rand() < 0.5 ? 2 : 3;

    // Generate flow fractions for each child
    const fractions: number[] = [];
    if (childCount === 2) {
      // Binary split: r is the minor fraction
      const r = (0.5 - asymmetry) + rand() * asymmetry;  // [0.5-asym, 0.5]
      fractions.push(r, 1 - r);
    } else {
      // Ternary split: 3 random fractions summing to 1, with one dominant child
      let a = 1 + rand(), b = rand(), c = rand();  // bias a to be largest
      const sum = a + b + c;
      fractions.push(a / sum, b / sum, c / sum);
    }

    // Sort descending so largest flow child is first (main continuation)
    fractions.sort((a, b) => b - a);

    // 90° branching plane rotation (Kitaoka Rule 8):
    // New branching plane is perpendicular to the current one
    const newPlaneNormal = new Vector3().crossVectors(direction, planeNormal).normalize();
    // Fallback if direction is parallel to planeNormal
    if (newPlaneNormal.lengthSq() < 0.001) {
      newPlaneNormal.copy(randomPerpendicular(direction, rand));
    }

    // Place children in the branching plane
    for (let c = 0; c < childCount; c++) {
      const f = fractions[c];
      const childFlow = f * flow;

      // Murray's law: d_child = d_parent * f^(1/n)
      const childRadius = radius * Math.pow(f, 1 / n);

      // Kamiya's angle: derived from flow fraction
      const angle = kamiyaAngle(f, n);

      // Direction: rotate parent direction by the Kamiya angle
      // For 2 children: one goes +angle, other goes -angle in the branching plane
      // For 3 children: spread around the plane
      let deflectionAxis: Vector3;
      if (childCount === 2) {
        deflectionAxis = c === 0
          ? newPlaneNormal.clone()
          : newPlaneNormal.clone().negate();
      } else {
        // For 3 children: spread at 0°, 120°, 240° around the branch axis
        const azimuth = (c / childCount) * Math.PI * 2 + (rand() - 0.5) * 0.4;
        deflectionAxis = rotateAround(newPlaneNormal, direction, azimuth).normalize();
      }

      const childDir = rotateAround(direction, deflectionAxis, angle).normalize();

      recurse(end, childDir, radius, childRadius, depth + 1, childFlow, newPlaneNormal);
    }
  }

  // ─── Build the coral: short stump → fan of primary branches ────────────
  const base = new Vector3(0, 0, 0);
  const stumpTop = new Vector3(0, stumpHeight, 0);

  // Short stump
  branches.push({ start: base.clone(), end: stumpTop.clone(), startRadius: trunkThickness, endRadius: trunkThickness, depth: 0 });

  // Fan out 5-7 primary branches from stump top
  const primaryCount = 5 + Math.floor(rand() * 3);
  const jitterRadius = stumpHeight * 0.3;

  // Assign flow fractions to primaries using Murray's law
  const primaryFlows: number[] = [];
  let flowSum = 0;
  for (let i = 0; i < primaryCount; i++) {
    const f = 0.7 + rand() * 0.6;  // random weight
    primaryFlows.push(f);
    flowSum += f;
  }

  // Fan angle range for primaries (30°–60° from vertical)
  const minFanAngle = Math.PI / 6;
  const maxFanAngle = Math.PI / 3;

  for (let i = 0; i < primaryCount; i++) {
    const azimuth = (i / primaryCount) * Math.PI * 2 + (rand() - 0.5) * 0.6;
    const fanAngle = minFanAngle + rand() * (maxFanAngle - minFanAngle);

    const dir = new Vector3(
      Math.sin(fanAngle) * Math.cos(azimuth),
      Math.cos(fanAngle),
      Math.sin(fanAngle) * Math.sin(azimuth),
    ).normalize();

    const startPos = stumpTop.clone().add(
      new Vector3(
        Math.cos(azimuth) * jitterRadius,
        (rand() - 0.5) * jitterRadius * 0.5,
        Math.sin(azimuth) * jitterRadius,
      )
    );

    // Murray's law: primary radius from its flow fraction
    const fraction = primaryFlows[i] / flowSum;
    const primaryRadius = trunkThickness * Math.pow(fraction, 1 / n);
    const primaryFlow = fraction;  // normalized to 1.0 total

    // Initial branching plane: perpendicular to the branch direction
    const planeNormal = randomPerpendicular(dir, rand);

    recurse(startPos, dir, trunkThickness, primaryRadius, 1, primaryFlow, planeNormal);
  }

  // ─── Anastomosis: fuse nearby branch junctions to create loops/voids ───
  if (anastomosis > 0) {
    const fusionDist = primaryLen * 0.4;
    const nodes: { pos: Vector3; radius: number; depth: number }[] = [];

    for (const b of branches) {
      nodes.push({ pos: b.start, radius: b.startRadius, depth: b.depth });
    }

    const fused = new Set<number>();
    // Use MAX_DEPTH as reference for depth normalization in anastomosis
    const maxObservedDepth = branches.reduce((m, b) => Math.max(m, b.depth), 1);

    for (let i = 0; i < nodes.length; i++) {
      if (fused.has(i)) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        if (fused.has(j)) continue;
        const dist = nodes[i].pos.distanceTo(nodes[j].pos);
        if (dist < 0.5 || dist > fusionDist) continue;

        const avgDepth = (nodes[i].depth + nodes[j].depth) / 2;
        const depthFactor = 1 - (avgDepth / maxObservedDepth);
        const chance = anastomosis * depthFactor * depthFactor;

        if (rand() < chance) {
          const fusedR = Math.min(nodes[i].radius, nodes[j].radius);
          branches.push({
            start: nodes[i].pos.clone(),
            end: nodes[j].pos.clone(),
            startRadius: fusedR,
            endRadius: fusedR,
            depth: Math.max(nodes[i].depth, nodes[j].depth),
          });
          fused.add(i);
          fused.add(j);
          break;
        }
      }
    }
  }

  return branches;
}

// ─── Rodrigues' rotation ──────────────────────────────────────────────────────
function rotateAround(v: Vector3, axis: Vector3, angle: number): Vector3 {
  const k = axis.clone().normalize();
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // v_rot = v*cos + (k x v)*sin + k*(k.v)*(1-cos)
  const cross = new Vector3().crossVectors(k, v);
  const dot = k.dot(v);
  return v.clone().multiplyScalar(cos)
    .add(cross.multiplyScalar(sin))
    .add(k.multiplyScalar(dot * (1 - cos)));
}

// Find a random vector perpendicular to dir
function randomPerpendicular(dir: Vector3, rand: () => number): Vector3 {
  // Pick an arbitrary vector not parallel to dir
  const arbitrary = Math.abs(dir.y) < 0.9
    ? new Vector3(0, 1, 0)
    : new Vector3(1, 0, 0);
  const perp = new Vector3().crossVectors(dir, arbitrary).normalize();
  return perp;
}

// ─── Analytical tapered-cone distance field ─────────────────────────────────
// Each branch is a tapered cone (frustum): radius interpolates linearly from
// startRadius at branch.start to endRadius at branch.end.
// For each voxel in the MC grid within the branch's AABB, compute distance
// to the cone surface and take the MAX into the scalar field.

export function fillDistanceField(
  branches: Branch[],
  field: Float32Array,
  resolution: number,
  mcSize: number,
  influence: number
): void {
  const halfSize = mcSize / 2;
  const voxelSize = mcSize / resolution;
  const limit = resolution - 1;

  field.fill(0);

  for (const branch of branches) {
    const ax = branch.start.x, ay = branch.start.y, az = branch.start.z;
    const bx = branch.end.x, by = branch.end.y, bz = branch.end.z;
    const rStart = branch.startRadius;
    const rEnd = branch.endRadius;
    const maxR = Math.max(rStart, rEnd);

    // Segment direction vector
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const abLenSq = abx * abx + aby * aby + abz * abz;

    // Expand radius for falloff margin — field drops to 0 at edge of margin.
    // Guarantee at least 2 voxels of spread so thin branches are captured.
    const margin = Math.max(maxR * 2, voxelSize * 2);

    // Axis-aligned bounding box of the tapered cone, in world coords
    const minX = Math.min(ax, bx) - margin;
    const maxX = Math.max(ax, bx) + margin;
    const minY = Math.min(ay, by) - margin;
    const maxY = Math.max(ay, by) + margin;
    const minZ = Math.min(az, bz) - margin;
    const maxZ = Math.max(az, bz) + margin;

    // Convert AABB to grid indices
    const ix0 = Math.max(0, Math.floor((minX + halfSize) / voxelSize));
    const ix1 = Math.min(limit, Math.ceil((maxX + halfSize) / voxelSize));
    const iy0 = Math.max(0, Math.floor((minY + halfSize) / voxelSize));
    const iy1 = Math.min(limit, Math.ceil((maxY + halfSize) / voxelSize));
    const iz0 = Math.max(0, Math.floor((minZ + halfSize) / voxelSize));
    const iz1 = Math.min(limit, Math.ceil((maxZ + halfSize) / voxelSize));

    for (let iz = iz0; iz <= iz1; iz++) {
      const wz = iz * voxelSize - halfSize;
      const izOff = iz * resolution * resolution;

      for (let iy = iy0; iy <= iy1; iy++) {
        const wy = iy * voxelSize - halfSize;
        const iyOff = iy * resolution;

        for (let ix = ix0; ix <= ix1; ix++) {
          const wx = ix * voxelSize - halfSize;

          // Vector from A to point P
          const apx = wx - ax, apy = wy - ay, apz = wz - az;

          // Project P onto line AB: t = dot(AP, AB) / |AB|²
          let t = abLenSq > 0
            ? (apx * abx + apy * aby + apz * abz) / abLenSq
            : 0;
          // Clamp to [0,1] — hemisphere caps at endpoints
          if (t < 0) t = 0;
          else if (t > 1) t = 1;

          // Interpolated radius at parameter t (linear taper)
          const rAtT = rStart + t * (rEnd - rStart);

          // Closest point on segment
          const cx = ax + t * abx;
          const cy = ay + t * aby;
          const cz = az + t * abz;

          // Distance from P to closest point on segment (axis distance)
          const dx = wx - cx, dy = wy - cy, dz = wz - cz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // Cone distance: negative means inside the tapered cone
          const coneDist = dist - rAtT;

          // Use local margin based on interpolated radius
          const localMargin = Math.max(rAtT * 2, voxelSize * 2);

          if (coneDist < localMargin) {
            // Smooth quadratic falloff: 1 inside, tapering to 0 at margin
            const normalized = coneDist / localMargin;
            const falloff = normalized <= 0
              ? 1  // Inside the cone — full contribution
              : (1 - normalized) * (1 - normalized);  // Quadratic outside
            const idx = ix + iyOff + izOff;
            const val = influence * falloff;
            if (val > field[idx]) field[idx] = val;
          }
        }
      }
    }
  }
}

// ─── Junction fillet spheres ─────────────────────────────────────────────────
// Place extra metaball spheres at every branch junction to create smooth,
// blobby fillets where branches meet. The sphere radius at each junction is
// proportional to the thickest branch meeting there, scaled by "blobiness".

export function fillJunctionSpheres(
  branches: Branch[],
  field: Float32Array,
  resolution: number,
  mcSize: number,
  influence: number,
  blobiness: number,
): void {
  if (blobiness <= 0) return;

  const halfSize = mcSize / 2;
  const voxelSize = mcSize / resolution;
  const limit = resolution - 1;

  // Collect junction points: snap positions to a small grid to find shared points.
  // Key = rounded position string, value = max radius at that point.
  const junctionMap = new Map<string, { x: number; y: number; z: number; maxR: number; count: number }>();
  const snap = voxelSize * 0.5; // snap tolerance

  function addPoint(px: number, py: number, pz: number, r: number) {
    const kx = Math.round(px / snap) * snap;
    const ky = Math.round(py / snap) * snap;
    const kz = Math.round(pz / snap) * snap;
    const key = `${kx},${ky},${kz}`;
    const existing = junctionMap.get(key);
    if (existing) {
      existing.maxR = Math.max(existing.maxR, r);
      existing.count++;
    } else {
      junctionMap.set(key, { x: px, y: py, z: pz, maxR: r, count: 1 });
    }
  }

  for (const branch of branches) {
    addPoint(branch.start.x, branch.start.y, branch.start.z, branch.startRadius);
    addPoint(branch.end.x, branch.end.y, branch.end.z, branch.endRadius);
  }

  // Only place spheres at actual junctions (2+ branches meeting)
  for (const jn of junctionMap.values()) {
    if (jn.count < 2) continue;

    const sphereR = jn.maxR * (1 + blobiness);
    const margin = Math.max(sphereR * 2, voxelSize * 2);

    // AABB for the sphere
    const ix0 = Math.max(0, Math.floor((jn.x - margin + halfSize) / voxelSize));
    const ix1 = Math.min(limit, Math.ceil((jn.x + margin + halfSize) / voxelSize));
    const iy0 = Math.max(0, Math.floor((jn.y - margin + halfSize) / voxelSize));
    const iy1 = Math.min(limit, Math.ceil((jn.y + margin + halfSize) / voxelSize));
    const iz0 = Math.max(0, Math.floor((jn.z - margin + halfSize) / voxelSize));
    const iz1 = Math.min(limit, Math.ceil((jn.z + margin + halfSize) / voxelSize));

    for (let iz = iz0; iz <= iz1; iz++) {
      const wz = iz * voxelSize - halfSize;
      const izOff = iz * resolution * resolution;

      for (let iy = iy0; iy <= iy1; iy++) {
        const wy = iy * voxelSize - halfSize;
        const iyOff = iy * resolution;

        for (let ix = ix0; ix <= ix1; ix++) {
          const wx = ix * voxelSize - halfSize;

          const dx = wx - jn.x, dy = wy - jn.y, dz = wz - jn.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const sphereDist = dist - sphereR;

          if (sphereDist < margin) {
            const normalized = sphereDist / margin;
            const falloff = normalized <= 0
              ? 1
              : (1 - normalized) * (1 - normalized);
            const idx = ix + iyOff + izOff;
            field[idx] += influence * blobiness * falloff;
          }
        }
      }
    }
  }
}

// ─── 3D Simplex noise ─────────────────────────────────────────────────────────
// Based on Stefan Gustavson's simplex noise implementation

const grad3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

const perm = new Uint8Array(512);
const permMod12 = new Uint8Array(512);

// Initialize permutation table
(function initPerm() {
  const p = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
    140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
    247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
    57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
    74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
    60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
    65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
    200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
    52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
    207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213,
    119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
    129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
    218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
    81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
    184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
    222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
  ];
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }
})();

const F3 = 1 / 3;
const G3 = 1 / 6;

export function simplex3(xin: number, yin: number, zin: number): number {
  const s = (xin + yin + zin) * F3;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const k = Math.floor(zin + s);
  const t = (i + j + k) * G3;
  const X0 = i - t;
  const Y0 = j - t;
  const Z0 = k - t;
  const x0 = xin - X0;
  const y0 = yin - Y0;
  const z0 = zin - Z0;

  let i1: number, j1: number, k1: number;
  let i2: number, j2: number, k2: number;

  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }

  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2 * G3;
  const y2 = y0 - j2 + 2 * G3;
  const z2 = z0 - k2 + 2 * G3;
  const x3 = x0 - 1 + 3 * G3;
  const y3 = y0 - 1 + 3 * G3;
  const z3 = z0 - 1 + 3 * G3;

  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;

  let n0 = 0, n1 = 0, n2 = 0, n3 = 0;

  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 >= 0) {
    const gi0 = permMod12[ii + perm[jj + perm[kk]]];
    t0 *= t0;
    n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0 + grad3[gi0][2] * z0);
  }

  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 >= 0) {
    const gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]];
    t1 *= t1;
    n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1 + grad3[gi1][2] * z1);
  }

  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 >= 0) {
    const gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]];
    t2 *= t2;
    n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2 + grad3[gi2][2] * z2);
  }

  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 >= 0) {
    const gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]];
    t3 *= t3;
    n3 = t3 * t3 * (grad3[gi3][0] * x3 + grad3[gi3][1] * y3 + grad3[gi3][2] * z3);
  }

  return 32 * (n0 + n1 + n2 + n3);
}

// ─── Vertex displacement (world space) ───────────────────────────────────────
// Positions are already in world-space (shifted) coordinates.
export function displaceVertices(
  positions: Float32Array,
  normals: Float32Array,
  noiseAmount: number,
  noiseScale: number,
  voxelWorldSize: number,
): void {
  // Clamp displacement so it never exceeds 1.5 voxels — prevents thin branches inverting
  const maxDisp = voxelWorldSize * 1.5;
  const vertexCount = positions.length / 3;

  // Find max Y for height mask
  let maxY = 0;
  for (let i = 0; i < vertexCount; i++) {
    if (positions[i * 3 + 1] > maxY) maxY = positions[i * 3 + 1];
  }
  if (maxY < 0.01) maxY = 1;

  for (let i = 0; i < vertexCount; i++) {
    const idx = i * 3;
    const wx = positions[idx];
    const wy = positions[idx + 1];
    const wz = positions[idx + 2];

    // Height mask: more displacement at tips (higher Y)
    const heightMask = 0.3 + 0.7 * Math.max(0, wy / maxY);

    // Multi-octave fractal noise: broad bumps + medium detail + fine per-vertex texture
    const f1 = noiseScale * 0.1;   // broad regional variation
    const f2 = noiseScale * 0.5;   // medium detail
    const f3 = noiseScale * 2.0;   // fine per-vertex texture
    const n = simplex3(wx * f1, wy * f1, wz * f1) * 0.4
            + simplex3(wx * f2 + 31.7, wy * f2 + 31.7, wz * f2 + 31.7) * 0.35
            + simplex3(wx * f3 + 67.1, wy * f3 + 67.1, wz * f3 + 67.1) * 0.25;
    let displacement = n * noiseAmount * heightMask;

    // Clamp to prevent self-intersection on thin branches
    if (displacement > maxDisp) displacement = maxDisp;
    else if (displacement < -maxDisp) displacement = -maxDisp;

    // Displace along normal (already in world space)
    positions[idx]     += normals[idx] * displacement;
    positions[idx + 1] += normals[idx + 1] * displacement;
    positions[idx + 2] += normals[idx + 2] * displacement;
  }
}
