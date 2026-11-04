// PRECOG / Trend Radar · Seeded random walks with injected spikes for DEMO DATA mode.
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}
export function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function makeSim(seed) {
  const rng = mulberry32(hashSeed(seed));
  const gauss = () => {
    let u = 0;
    while (!u) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  };
  const base = Math.log(120 + rng() * 1900);
  return { rng, gauss, base, log: base + (rng() - 0.5) * 0.4, trend: 0, vol: 0.025 + rng() * 0.03, spike: 0 };
}
export function simStep(s) {
  s.trend = s.trend * 0.96 + s.gauss() * 0.004;
  s.log += s.trend + s.gauss() * s.vol - 0.03 * (s.log - s.base);
  s.spike *= 0.7;
  if (s.rng() < 0.008) s.spike += 0.45 + s.rng() * 0.9;
  return Math.max(1, Math.exp(s.log) * (1 + s.spike));
}
