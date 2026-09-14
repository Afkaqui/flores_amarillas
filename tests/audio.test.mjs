import { test } from "node:test";
import assert from "node:assert/strict";
import { Musica } from "../js/audio.js";

test("hidden pages cannot start music, and delayed YouTube play events are paused", async () => {
  const original = { document: globalThis.document, window: globalThis.window, cancel: globalThis.cancelAnimationFrame };
  const calls = [];
  let events;
  globalThis.document = { hidden: false };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.window = { YT: { Player: class {
    constructor(_id, options) { events = options.events; queueMicrotask(events.onReady); }
    unMute() { calls.push("unmute"); }
    mute() { calls.push("mute"); }
    setVolume() {}
    playVideo() { calls.push("play"); events.onStateChange({ data: 1 }); }
    pauseVideo() { calls.push("pause"); events.onStateChange({ data: 2 }); }
  } } };
  try {
    const music = new Musica("test");
    await music.preparar();
    music.reproducir();
    assert.equal(music.sonando, true);
    document.hidden = true;
    music.suspender(true);
    assert.equal(music.sonando, false);
    assert.deepEqual(calls.slice(-2), ["mute", "pause"]);
    calls.length = 0;
    music.reproducir();
    assert.deepEqual(calls, []);
    events.onStateChange({ data: 1 });
    assert.deepEqual(calls, ["mute", "pause"]);
    document.hidden = false;
    calls.length = 0;
    music.reproducir();
    assert.deepEqual(calls, [], "pagehide suspension survives until pageshow");
    music.suspender(false);
    assert.deepEqual(calls, [], "resuming the page alone must not override the mute preference");
    music.reproducir();
    assert.equal(music.sonando, true);
  } finally {
    globalThis.document = original.document;
    globalThis.window = original.window;
    globalThis.cancelAnimationFrame = original.cancel;
  }
});
