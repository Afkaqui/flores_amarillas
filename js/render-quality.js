// A touch screen is a layout hint, not evidence of a slow GPU. Safari does not
// expose deviceMemory; absence must not demote high-density iPhones/iPads.
export function renderQuality({ width = 1280, coarse = false, memory, cores, saveData = false } = {}) {
  const mobile = coarse || width < 820;
  const limited = saveData || (memory > 0 && memory <= 4) || (!mobile && cores > 0 && cores <= 4);
  if (limited) return {
    tier: "light", light: true, pixelRatio: 1, minPixelRatio: 1, fps: 30,
    shadows: false, bloom: false, shadowSize: 1024,
    grass: 1800, terrain: 48, field: 24, shrubs: 8, clouds: 4,
  };
  if (mobile) return {
    tier: "mobile", light: false, pixelRatio: 2, minPixelRatio: 1.25, fps: 60,
    shadows: true, bloom: false, shadowSize: 1024,
    grass: 5000, terrain: 96, field: 36, shrubs: 10, clouds: 5,
  };
  return {
    tier: "desktop", light: false, pixelRatio: 2, minPixelRatio: 1.25, fps: 60,
    shadows: true, bloom: true, shadowSize: 2048,
    grass: 14000, terrain: 160, field: 58, shrubs: 18, clouds: 9,
  };
}

// Each stage needs its own sustained slow window. Never trade away sharpness
// at the same time as lowering animation cadence or removing expensive effects.
export function nextRenderBudget(current) {
  if (current.fps > 30) return { ...current, fps: 30 };
  if (current.shadows || current.bloom)
    return { ...current, shadows: false, bloom: false };
  const floor = current.minPixelRatio ?? 1;
  if (current.pixelRatio <= floor) return null;
  return { ...current, pixelRatio: Math.max(floor, current.pixelRatio * 0.85) };
}

export class FrameBudget {
  constructor() { this.reset(); }
  reset() { this.samples = 0; this.total = 0; }
  sample(ms, fps) {
    // Ignore resume gaps. Require a sustained slow window, not a single shader compilation.
    if (ms <= 0 || ms > 1500) return false;
    this.total += Math.min(ms, 250);
    if (++this.samples < 90) return false;
    const slow = this.total / this.samples > (1000 / fps) * 1.45;
    this.reset();
    return slow;
  }
}
