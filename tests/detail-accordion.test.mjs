import { test } from "node:test";
import assert from "node:assert/strict";
import { mountDetailAccordions } from "../js/detail-accordion.js";

function fixture(t, reduced = false) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const previousDocument = globalThis.document;
  const previousMatchMedia = globalThis.matchMedia;
  const document = new EventTarget();
  const preference = Object.assign(new EventTarget(), { matches: reduced });
  globalThis.document = document;
  globalThis.matchMedia = () => preference;
  t.after(() => {
    globalThis.document = previousDocument;
    globalThis.matchMedia = previousMatchMedia;
  });
  const makeDetail = () => {
    const summary = Object.assign(new EventTarget(), {
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
    });
    const body = { inert: false };
    return {
      open: false,
      style: { height: "" },
      children: [summary, body],
      animations: [],
      querySelector: () => summary,
      getBoundingClientRect() {
        return { height: this.style.height ? parseFloat(this.style.height) : this.open ? 500 : 70 };
      },
      animate(frames, options) {
        const motion = { frames, options, cancel() {}, onfinish: null };
        this.animations.push(motion);
        return motion;
      },
    };
  };
  const details = [makeDetail(), makeDetail()];
  const controller = mountDetailAccordions({ querySelectorAll: () => details });
  return { ...controller, details, document, preference };
}

test("closing keeps content mounted for the transition but removes it from keyboard navigation", async (t) => {
  const f = fixture(t), detail = f.details[0];
  await f.setOpen(detail, true, { immediate: true });
  const closing = f.setOpen(detail, false);
  assert.equal(detail.open, true);
  assert.equal(detail.children[1].inert, true);
  assert.equal(detail.children[0].attributes["aria-expanded"], "false");
  detail.animations.at(-1).onfinish();
  assert.equal(await closing, true);
  assert.equal(detail.open, false);
  assert.equal(detail.style.height, "");
});

test("the drawing has a slower opening without slowing other details or shortening its fallback", async (t) => {
  const f = fixture(t), [drawing, other] = f.details;
  drawing.id = "drawing-detail";
  const opening = f.setOpen(drawing, true);
  const otherOpening = f.setOpen(other, true);
  assert.equal(drawing.animations.at(-1).options.duration, 800);
  assert.equal(other.animations.at(-1).options.duration, 380);
  t.mock.timers.tick(500);
  await otherOpening;
  assert.notEqual(drawing.style.height, "", "the old fallback must not cut the longer animation short");
  t.mock.timers.tick(420);
  await opening;
  assert.equal(drawing.style.height, "");
  const closing = f.setOpen(drawing, false);
  assert.equal(drawing.animations.at(-1).options.duration, 380);
  t.mock.timers.runAll();
  await closing;
});

test("rapid reversals settle on the latest choice, including a late callback from the old animation", async (t) => {
  const f = fixture(t), detail = f.details[0];
  const opening = f.setOpen(detail, true);
  const oldMotion = detail.animations.at(-1);
  detail.style.height = "240px";
  const closing = f.setOpen(detail, false);
  assert.equal(await opening, false);
  oldMotion.onfinish();
  assert.equal(detail.children[0].attributes["aria-expanded"], "false");
  detail.animations.at(-1).onfinish();
  assert.equal(await closing, true);
  assert.equal(detail.open, false);
});

test("opening another detail preserves the first one and background fallback releases fixed heights", async (t) => {
  const f = fixture(t);
  const pending = f.details.map((detail) => f.setOpen(detail, true));
  t.mock.timers.runAll();
  assert.deepEqual(await Promise.all(pending), [true, true]);
  for (const detail of f.details) {
    assert.equal(detail.open, true);
    assert.equal(detail.style.height, "");
    assert.equal(detail.children[1].inert, false);
  }
});

test("reduced motion and hiding the page leave no unfinished accordion", async (t) => {
  const f = fixture(t, true), detail = f.details[0];
  await f.setOpen(detail, true);
  assert.equal(detail.animations.length, 0);
  f.preference.matches = false;
  const closing = f.setOpen(detail, false);
  f.document.hidden = true;
  f.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(await closing, true);
  assert.equal(detail.open, false);
  assert.equal(detail.style.height, "");
});
