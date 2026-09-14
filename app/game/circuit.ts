// World units are metres. The closed spline is shared by physics and rendering.
export type Vec2 = { x: number; z: number };
export type TrackPoint = Vec2 & { s: number; yaw: number };
export const ROAD_HALF_WIDTH = 12;
export const CHECKPOINTS = 8;
export const LAPS = 3;
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const wrap = (n: number, max: number) => ((n % max) + max) % max;
export const angleDelta = (a: number, b: number) => wrap(a - b + Math.PI, Math.PI * 2) - Math.PI;
const controls: Vec2[] = [
  { x: 0, z: 0 }, { x: 0, z: 125 }, { x: -65, z: 215 },
  { x: -180, z: 235 }, { x: -255, z: 160 }, { x: -235, z: 55 },
  { x: -160, z: 0 }, { x: -165, z: -95 }, { x: -60, z: -150 },
  { x: 65, z: -105 }, { x: 80, z: -30 },
];
function catmull(a: number, b: number, c: number, d: number, t: number) {
  return .5 * (2 * b + (-a + c) * t + (2*a - 5*b + 4*c - d) * t*t + (-a + 3*b - 3*c + d)*t*t*t);
}
const points: TrackPoint[] = [];
for (let i = 0; i < controls.length; i++) {
  const p = [-1, 0, 1, 2].map(offset => controls[wrap(i + offset, controls.length)]);
  for (let step = 0; step < 48; step++) {
    const t = step / 48;
    const x = catmull(p[0].x, p[1].x, p[2].x, p[3].x, t);
    const z = catmull(p[0].z, p[1].z, p[2].z, p[3].z, t);
    const last = points.at(-1);
    points.push({ x, z, s: last ? last.s + Math.hypot(x-last.x, z-last.z) : 0, yaw: 0 });
  }
}
const last = points[points.length - 1];
export const TRACK_LENGTH = last.s + Math.hypot(last.x - points[0].x, last.z - points[0].z);
points.forEach((p, i) => {
  const next = points[(i+1)%points.length];
  p.yaw = Math.atan2(next.x-p.x, next.z-p.z);
});
export const TRACK = points;
export function atDistance(distance: number, offset = 0): TrackPoint {
  const s = wrap(distance, TRACK_LENGTH);
  let lo = 0, hi = points.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (points[mid].s <= s) lo = mid; else hi = mid - 1; }
  const a = points[lo], b = points[(lo+1)%points.length];
  const length = lo === points.length - 1 ? TRACK_LENGTH - a.s : b.s - a.s;
  const t = (s-a.s)/length;
  return { x: a.x + (b.x-a.x)*t + Math.cos(a.yaw)*offset, z: a.z+(b.z-a.z)*t - Math.sin(a.yaw)*offset, yaw: a.yaw, s };
}
export function nearestTrack(x: number, z: number) {
  let best = Infinity, found = { ...points[0], offset: 0, distance: 0 };
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i+1)%points.length];
    const dx = b.x-a.x, dz = b.z-a.z, length2 = dx*dx+dz*dz;
    const t = clamp(((x-a.x)*dx+(z-a.z)*dz)/length2,0,1);
    const px = a.x+dx*t, pz = a.z+dz*t, d2 = (x-px)**2+(z-pz)**2;
    if (d2 < best) {
      best = d2;
      found = { x:px, z:pz, yaw:a.yaw, s:wrap(a.s+Math.sqrt(length2)*t,TRACK_LENGTH), offset:(x-px)*Math.cos(a.yaw)-(z-pz)*Math.sin(a.yaw), distance:Math.sqrt(d2) };
    }
  }
  return found;
}
export const BOOST_PADS = [.08, .33, .59, .83].map((fraction,i) => ({ ...atDistance(fraction*TRACK_LENGTH, i%2 ? -5 : 5), id:i, offset:i%2 ? -5 : 5 }));
export const PICKUPS = [.045, .22, .47, .72, .92].flatMap((fraction, row) => [-6,0,6].map((offset,col) => ({ ...atDistance(fraction*TRACK_LENGTH,offset), id:row*3+col, offset })));
export const OBSTACLES = [.16, .4, .65, .89].map((fraction,i) => ({ ...atDistance(fraction*TRACK_LENGTH,i%2 ? 6 : -6), id:i }));
