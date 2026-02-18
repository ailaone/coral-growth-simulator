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
  radius: number;
  depth: number;
}

// ─── Tree generation ──────────────────────────────────────────────────────────
export function generateTree(params: Record<string, number>): Branch[] {
  const {
    generations = 4,
    branchAngle = 35,
    branchLength = 0.65,
    seed = 42,
    trunkThickness = 3,
    taper = 0.6,
    anastomosis = 0.3,
  } = params;

  const rand = mulberry32(seed);
  const branches: Branch[] = [];
  const angleRad = (branchAngle * Math.PI) / 180;

  // Branch length at the first fan level
  const primaryLen = branchLength * 8;
  // Short stump height — just a pedestal
  const stumpHeight = primaryLen * 0.15;

  function recurse(
    origin: Vector3,
    direction: Vector3,
    length: number,
    radius: number,
    depth: number
  ) {
    const end = origin.clone().add(direction.clone().multiplyScalar(length));
    branches.push({ start: origin.clone(), end: end.clone(), radius, depth });

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

      recurse(end, childDir, childLength, childRadius, depth + 1);
    }
  }

  // ─── Build the coral: short stump → fan of primary branches ────────────
  const base = new Vector3(0, 0, 0);
  const up = new Vector3(0, 1, 0);
  const stumpTop = new Vector3(0, stumpHeight, 0);

  // Short stump
  branches.push({ start: base.clone(), end: stumpTop.clone(), radius: trunkThickness, depth: 0 });

  // Fan out 5-7 primary branches from stump top
  const primaryCount = 5 + Math.floor(rand() * 3);  // 5-7
  const jitterRadius = stumpHeight * 0.3;  // slight offset so branches don't all start at exact same point

  for (let i = 0; i < primaryCount; i++) {
    // Spread evenly around azimuth with some jitter
    const azimuth = (i / primaryCount) * Math.PI * 2 + (rand() - 0.5) * 0.6;
    // Fan angle from vertical: wide spread, biased outward and upward
    const fanAngle = angleRad * (1.2 + rand() * 1.0);

    const dir = new Vector3(
      Math.sin(fanAngle) * Math.cos(azimuth),
      Math.cos(fanAngle),
      Math.sin(fanAngle) * Math.sin(azimuth),
    ).normalize();

    // Jitter start position slightly outward from stump top
    const startPos = stumpTop.clone().add(
      new Vector3(
        Math.cos(azimuth) * jitterRadius,
        (rand() - 0.5) * jitterRadius * 0.5,
        Math.sin(azimuth) * jitterRadius,
      )
    );

    const len = primaryLen * (0.7 + rand() * 0.6);
    const radius = trunkThickness * (0.6 + rand() * 0.3);

    recurse(startPos, dir, len, radius, 1);
  }

  // ─── Anastomosis: fuse nearby branch junctions to create loops/voids ───
  if (anastomosis > 0) {
    const fusionDist = primaryLen * 0.4;
    const nodes: { pos: Vector3; radius: number; depth: number }[] = [];

    // Use branch start points (junctions), not end tips
    for (const b of branches) {
      nodes.push({ pos: b.start, radius: b.radius, depth: b.depth });
    }

    // Track which nodes have already been fused (max one connection each)
    const fused = new Set<number>();

    for (let i = 0; i < nodes.length; i++) {
      if (fused.has(i)) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        if (fused.has(j)) continue;
        const dist = nodes[i].pos.distanceTo(nodes[j].pos);
        if (dist < 0.5 || dist > fusionDist) continue;

        // Probability decays with depth: strong at base, rare at tips
        const avgDepth = (nodes[i].depth + nodes[j].depth) / 2;
        const depthFactor = 1 - (avgDepth / generations);  // 1.0 at root → 0.0 at leaves
        const chance = anastomosis * depthFactor * depthFactor;  // quadratic falloff

        if (rand() < chance) {
          branches.push({
            start: nodes[i].pos.clone(),
            end: nodes[j].pos.clone(),
            radius: Math.min(nodes[i].radius, nodes[j].radius),
            depth: Math.max(nodes[i].depth, nodes[j].depth),
          });
          fused.add(i);
          fused.add(j);
          break;  // move to next i
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

// ─── Analytical capsule distance field ──────────────────────────────────────
// Each branch is a capsule: cylinder + hemisphere caps at both ends.
// For each voxel in the MC grid within the branch's AABB, compute distance
// to the capsule surface and accumulate a smooth falloff into the scalar field.

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
    const r = branch.radius;

    // Segment direction vector
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const abLenSq = abx * abx + aby * aby + abz * abz;

    // Expand radius for falloff margin — field drops to 0 at 2× radius
    const margin = r * 2;

    // Axis-aligned bounding box of the capsule, in world coords
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
          // Clamp to [0,1] — this gives hemisphere caps at endpoints
          if (t < 0) t = 0;
          else if (t > 1) t = 1;

          // Closest point on segment
          const cx = ax + t * abx;
          const cy = ay + t * aby;
          const cz = az + t * abz;

          // Distance from P to closest point on segment
          const dx = wx - cx, dy = wy - cy, dz = wz - cz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // Capsule distance: negative means inside the capsule
          const capsuleDist = dist - r;

          if (capsuleDist < margin) {
            // Smooth quadratic falloff: 1 inside, tapering to 0 at margin
            const normalized = capsuleDist / margin;
            const falloff = normalized <= 0
              ? 1  // Inside the capsule — full contribution
              : (1 - normalized) * (1 - normalized);  // Quadratic outside
            const idx = ix + iyOff + izOff;
            field[idx] += influence * falloff;
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

// ─── Vertex displacement ──────────────────────────────────────────────────────
export function displaceVertices(
  positions: Float32Array,
  normals: Float32Array,
  noiseAmount: number,
  noiseScale: number,
  mcSize: number,
): void {
  const halfSize = mcSize / 2;
  const vertexCount = positions.length / 3;

  // Find max Y for height mask
  let maxY = 0;
  for (let i = 0; i < vertexCount; i++) {
    const worldY = positions[i * 3 + 1] * halfSize;
    if (worldY > maxY) maxY = worldY;
  }
  if (maxY < 0.01) maxY = 1;

  for (let i = 0; i < vertexCount; i++) {
    const idx = i * 3;
    // MC positions are in [-1,1] normalized space; convert to world
    const wx = positions[idx] * halfSize;
    const wy = positions[idx + 1] * halfSize;
    const wz = positions[idx + 2] * halfSize;

    // Height mask: more displacement at tips (higher Y)
    const heightMask = 0.3 + 0.7 * Math.max(0, wy / maxY);

    const n = simplex3(wx * noiseScale * 0.1, wy * noiseScale * 0.1, wz * noiseScale * 0.1);
    const displacement = n * noiseAmount * heightMask;

    // Displace along normal (in normalized MC space)
    const nx = normals[idx];
    const ny = normals[idx + 1];
    const nz = normals[idx + 2];

    positions[idx] += (nx * displacement) / halfSize;
    positions[idx + 1] += (ny * displacement) / halfSize;
    positions[idx + 2] += (nz * displacement) / halfSize;
  }
}
