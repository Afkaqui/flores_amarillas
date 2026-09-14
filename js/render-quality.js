// Device hints only choose the starting budget; actual frame times can lower it.
export function renderQuality({ width = 1280, coarse = false, memory = 8, cores = 8, saveData = false } = {}) {
  const light = coarse || width < 820 || memory <= 4 || cores <= 4 || saveData;
  return light
    ? { light: true, pixelRatio: 1, fps: 30, grass: 1800, terrain: 48, field: 24, shrubs: 8, clouds: 4 }
    : { light: false, pixelRatio: 1.75, fps: 60, grass: 14000, terrain: 160, field: 58, shrubs: 18, clouds: 9 };
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
