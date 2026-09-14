import { test } from "node:test";
import assert from "node:assert/strict";
import { renderQuality, FrameBudget } from "../js/render-quality.js";

test("mobile, modest eight-core phones and data saving get a light starting budget", () => {
  for (const hints of [{ width: 390 }, { coarse: true, width: 900 }, { memory: 4, cores: 8 }, { cores: 4 }, { saveData: true }]) {
    const quality = renderQuality(hints);
    assert.equal(quality.light, true);
    assert.equal(quality.fps, 30);
    assert.ok(quality.grass < 2000);
    assert.ok(quality.pixelRatio <= 1);
  }
  assert.equal(renderQuality().light, false);
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
