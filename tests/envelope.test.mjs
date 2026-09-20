import { test } from "node:test";
import assert from "node:assert/strict";
import { openEnvelope } from "../js/envelope.js";

function fixture() {
  const paper = new EventTarget();
  let finished = 0;
  const envelope = {
    querySelector: () => paper,
    closest: () => ({ classList: new Set() }),
    classList: new Set(),
    style: { setProperty() {} },
    getAnimations: () => [{ finish() { finished++; } }],
  };
  const end = (animationName) => {
    const event = new Event("animationend");
    event.animationName = animationName;
    paper.dispatchEvent(event);
  };
  return { envelope, end, finished: () => finished };
}

test("the reveal waits for the paper, not an early timeout or the flap", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  let revealed = false;
  const opening = openEnvelope(f.envelope).then(() => { revealed = true; });
  t.mock.timers.tick(1000);
  f.end("envelope-unfold");
  await Promise.resolve();
  assert.equal(revealed, false);
  f.end("letter-leaves-envelope");
  await opening;
  assert.equal(revealed, true);
  assert.equal(f.finished(), 1);
  t.mock.timers.runAll();
  assert.equal(f.finished(), 1, "finishing the paper cancels the fallback");
});

test("suspended animation events cannot leave the gift stuck opening", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  const opening = openEnvelope(f.envelope);
  t.mock.timers.runAll();
  await opening;
  assert.equal(f.finished(), 1);
  assert.equal(f.envelope.classList.has("opening"), true);
});

test("reduced motion opens immediately without waiting for animation events", async () => {
  const f = fixture();
  await openEnvelope(f.envelope, true);
  assert.equal(f.envelope.classList.has("opening"), true);
  assert.equal(f.finished(), 0);
});
