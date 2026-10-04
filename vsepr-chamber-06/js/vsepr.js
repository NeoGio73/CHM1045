// VSEPR model: electron domains are points on a sphere that repel each other.
// Lone pairs repel harder than bonding pairs, which is what bends real molecules
// away from the ideal angles. Directions are plain [x, y, z] unit arrays so this
// file has no dependencies and can be tested on its own.

export const LONE = 'lone';
export const BOND = 'bond';

// How hard each kind of pair pushes: bond-bond is the baseline, lone pairs push
// harder, and two lone pairs push hardest of all. POWER sets how quickly the
// push fades with distance (energy ~ strength / distance^POWER).
export const PARAMS = { power: 4, bondLone: 1.4, loneLone: 2.6 };

const strength = (a, b, p) => (a === LONE ? (b === LONE ? p.loneLone : p.bondLone) : (b === LONE ? p.bondLone : 1));

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function angleBetween(a, b) {
  return (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180) / Math.PI;
}

export function energy(dirs, types, p = PARAMS) {
  let e = 0;
  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      const d = sub(dirs[i], dirs[j]);
      const r = Math.sqrt(dot(d, d)) + 1e-4;
      e += strength(types[i], types[j], p) / Math.pow(r, p.power);
    }
  }
  return e;
}

// Slide every domain along the sphere until the pushes balance.
export function relax(dirs, types, iterations = 1500, p = PARAMS) {
  const n = dirs.length;
  const out = dirs.map(norm);
  const vel = out.map(() => [0, 0, 0]);
  for (let it = 0; it < iterations; it++) {
    let biggest = 0;
    for (let i = 0; i < n; i++) {
      const f = [0, 0, 0];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const d = sub(out[i], out[j]);
        const r = Math.sqrt(dot(d, d)) + 1e-3;
        const k = strength(types[i], types[j], p) / Math.pow(r, p.power + 2);
        f[0] += d[0] * k; f[1] += d[1] * k; f[2] += d[2] * k;
      }
      // keep only the part of the push that runs along the sphere's surface
      const radial = dot(f, out[i]);
      const v = vel[i];
      for (let c = 0; c < 3; c++) v[c] = 0.85 * v[c] + 0.05 * (f[c] - radial * out[i][c]);
      const len = Math.hypot(v[0], v[1], v[2]);
      if (len > 0.1) { v[0] *= 0.1 / len; v[1] *= 0.1 / len; v[2] *= 0.1 / len; }
      biggest = Math.max(biggest, Math.min(len, 0.1));
    }
    for (let i = 0; i < n; i++) {
      out[i] = norm([out[i][0] + vel[i][0], out[i][1] + vel[i][1], out[i][2] + vel[i][2]]);
    }
    if (biggest < 1e-7 && it > 20) break;
  }
  return out;
}

function combinations(n, k) {
  const res = [];
  const pick = (start, chosen) => {
    if (chosen.length === k) { res.push(chosen.slice()); return; }
    for (let i = start; i < n; i++) { chosen.push(i); pick(i + 1, chosen); chosen.pop(); }
  };
  pick(0, []);
  return res;
}

// Given the current domains, return where each one should end up.
// Simply relaxing can get stuck (e.g. two lone pairs side by side on an
// octahedron when they belong on opposite sides), so every way of handing the
// lone pairs to the available sites is tried and the lowest-energy one wins.
export function settle(dirs, types, p = PARAMS) {
  const n = dirs.length;
  if (n === 0) return [];
  if (n === 1) return [norm(dirs[0])];

  const base = relax(dirs, types, 1500, p);
  const loneIdx = types.map((t, i) => (t === LONE ? i : -1)).filter((i) => i >= 0);
  const k = loneIdx.length;
  if (k === 0 || k === n) return base;

  const current = energy(base, types, p);
  let best = { e: current, sites: base, lone: loneIdx };
  for (const combo of combinations(n, k)) {
    const trialTypes = Array(n).fill(BOND);
    combo.forEach((i) => { trialTypes[i] = LONE; });
    const sites = relax(base, trialTypes, 1500, p);
    const e = energy(sites, trialTypes, p);
    if (e < best.e - 1e-4 * current) best = { e, sites, lone: combo };
  }
  if (best.sites === base) return base;

  // Hand sites to domains of the matching type, moving each as little as possible.
  const result = Array(n);
  const assign = (domainIdx, siteIdx) => {
    const free = new Set(siteIdx);
    // domains already sitting on a site of their own type keep it
    const waiting = [];
    for (const d of domainIdx) {
      if (free.has(d)) { result[d] = best.sites[d]; free.delete(d); } else waiting.push(d);
    }
    for (const d of waiting) {
      let pick = null; let bestDot = -Infinity;
      for (const s of free) {
        const c = dot(base[d], best.sites[s]);
        if (c > bestDot) { bestDot = c; pick = s; }
      }
      result[d] = best.sites[pick];
      free.delete(pick);
    }
  };
  const loneSites = best.lone;
  const bondSites = [...Array(n).keys()].filter((i) => !loneSites.includes(i));
  assign(loneIdx, loneSites);
  assign([...Array(n).keys()].filter((i) => types[i] === BOND), bondSites);
  return result;
}

// Names for every arrangement a student can build with up to six domains.
const SHAPES = {
  '1,0': 'Linear', '0,1': 'Lone pair only',
  '2,0': 'Linear', '1,1': 'Linear',
  '3,0': 'Trigonal planar', '2,1': 'Bent', '1,2': 'Linear',
  '4,0': 'Tetrahedral', '3,1': 'Trigonal pyramidal', '2,2': 'Bent', '1,3': 'Linear',
  '5,0': 'Trigonal bipyramidal', '4,1': 'Seesaw', '3,2': 'T-shaped', '2,3': 'Linear',
  '6,0': 'Octahedral', '5,1': 'Square pyramidal', '4,2': 'Square planar', '3,3': 'T-shaped', '2,4': 'Linear',
};
const ELECTRON_GEOMETRY = ['', 'Linear', 'Linear', 'Trigonal planar', 'Tetrahedral', 'Trigonal bipyramidal', 'Octahedral'];

export function shapeName(bonds, lone) { return SHAPES[`${bonds},${lone}`] || '—'; }
export function electronGeometry(total) { return ELECTRON_GEOMETRY[total] || '—'; }
