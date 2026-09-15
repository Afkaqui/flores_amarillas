import { test } from "node:test";
import assert from "node:assert/strict";
import { renderQuality, nextRenderBudget, FrameBudget } from "../js/render-quality.js";

test("known limited hardware and data saving keep the small scene budget", () => {
  for (const hints of [{ memory: 4, cores: 8 }, { cores: 4 }, { saveData: true }]) {
    const quality = renderQuality(hints);
    assert.equal(quality.light, true);
    assert.equal(quality.fps, 30);
    assert.ok(quality.grass < 2000);
    assert.ok(quality.pixelRatio <= 1);
  }
  assert.equal(renderQuality().light, false);
});

test("touch screens and Safari's missing memory hint retain high-density rendering", () => {
  for (const hints of [
    { width: 440, coarse: true, cores: 6, memory: undefined },
    { width: 440, coarse: true, cores: 2, memory: undefined },
    { width: 390 },
    { width: 1024, coarse: true, cores: 8 },
    { width: 412, coarse: true, cores: 8, memory: 8 },
  ]) {
    const q = renderQuality(hints);
    assert.equal(q.tier, "mobile");
    assert.equal(q.pixelRatio, 2);
    assert.equal(q.fps, 60);
    assert.equal(q.shadows, true);
    assert.equal(q.bloom, false);
    assert.ok(q.grass < renderQuality().grass);
  }
});

test("slow rendering drops cadence and effects before pixels and never goes below its floor", () => {
  let q = renderQuality({ width: 440, cores: 6 });
  q = nextRenderBudget(q);
  assert.equal(q.fps, 30);
  assert.equal(q.pixelRatio, 2);
  assert.equal(q.shadows, true);
  q = nextRenderBudget(q);
  assert.equal(q.shadows, false);
  assert.equal(q.pixelRatio, 2);
  q = nextRenderBudget(q);
  assert.equal(q.pixelRatio, 1.7);
  for (let i = 0; i < 12; i++) q = nextRenderBudget(q) || q;
  assert.equal(q.pixelRatio, 1.25);
  assert.equal(nextRenderBudget(q), null);
  assert.equal(nextRenderBudget(renderQuality({ memory: 4 })), null);
});

test("adaptive quality requires sustained slow frames and ignores resume gaps", () => {
  const budget = new FrameBudget();
  for (let i = 0; i < 180; i++) assert.equal(budget.sample(34, 30), false);
  assert.equal(budget.sample(5000, 30), false);
  for (let i = 0; i < 89; i++) assert.equal(budget.sample(55, 30), false);
  assert.equal(budget.sample(55, 30), true);
  budget.sample(100, 30);
  budget.reset();
  for (let i = 0; i < 90; i++) assert.equal(budget.sample(16.7, 60), false);
});
